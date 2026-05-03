# =============================================================================
# backend/app/services/ai_analyzer.py
#
# [파트 C] 백승훈 담당
# Gemini API 기반 뉴스 감성분석 + 폴리마켓 차트 이벤트 생성
#
# 주요 함수
#   load_candidates()             DB → 후보자 목록 (DB 실패 시 CSV 폴백)
#   get_candidates_by_address()   주소 → 7종 후보자 필터 (신규)
#   keyword_match_candidates()    키워드 매칭 랭킹 (신규)
#   analyze_sentiment()           뉴스 1건 → 감성점수 + 요약
#   analyze_batch()               뉴스 여러 건 → 일괄 처리
#   build_chart_events()          폴리마켓 차트용 이벤트 필터
#   create_combined_chart()       폴리마켓 확률 + 뉴스 마커 통합 차트
# =============================================================================

import os
import json
import time
import pandas as pd
import plotly.graph_objects as go
from dotenv import load_dotenv

# google.generativeai → google.genai 마이그레이션 대응
try:
    import google.generativeai as genai
    _GENAI_MODE = "legacy"
except ImportError:
    import google.genai as genai
    _GENAI_MODE = "new"

# DB import — FastAPI 패키지 내부 실행 vs 단독 실행 양쪽 대응
try:
    from .database import SessionLocal
    from .models import Candidate
except ImportError:
    try:
        from database import SessionLocal
        from models import Candidate
    except ImportError:
        SessionLocal = None
        Candidate = None

load_dotenv()

# ── Gemini 초기화 ─────────────────────────────────────────────────────────────
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


# =============================================================================
# 1. 후보자 데이터 로드 (DB 실패 시 CSV 폴백)
# =============================================================================

def load_candidates(
    region: str = None,
    sg_type: str = None,
    registered_only: bool = True
) -> pd.DataFrame:
    """
    DB에서 후보자 목록 로드. DB 연결 실패 시 CSV 자동 폴백.

    Args:
        region         : 시도명 필터 (예: "대구광역시"). None이면 전체
        sg_type        : 선거 유형 필터 (예: "광역단체장"). None이면 전체
        registered_only: True면 '등록' 상태만 반환
    """

    def _load_from_csv(region, sg_type, registered_only):
        """CSV 파일에서 후보자 데이터 로드"""
        import glob
        # 현재 폴더 또는 하위 폴더에서 candidates_2026*.csv 탐색
        csv_files = (
            glob.glob("candidates_2026*.csv")
            or glob.glob("**/*.csv", recursive=True)
        )
        if not csv_files:
            print("[ai_analyzer] CSV 파일 없음 — 빈 DataFrame 반환")
            return pd.DataFrame()

        df = pd.read_csv(csv_files[0], encoding="utf-8-sig")
        print(f"[ai_analyzer] CSV 로드: {csv_files[0]} ({len(df)}행)")

        if registered_only and "reg_status" in df.columns:
            df = df[df["reg_status"] == "등록"]
        if region and "sd_name" in df.columns:
            df = df[df["sd_name"] == region]
        if sg_type and "sg_type_label" in df.columns:
            df = df[df["sg_type_label"] == sg_type]

        cols = ["name", "party", "sd_name", "sgg_name",
                "sg_type_label", "career1", "career2", "reg_status"]
        for c in cols:
            if c not in df.columns:
                df[c] = ""
        return df[cols].reset_index(drop=True)

    # DB 시도 → 실패 시 CSV 폴백
    if SessionLocal is None or Candidate is None:
        print("[ai_analyzer] DB 모듈 없음 → CSV 폴백")
        return _load_from_csv(region, sg_type, registered_only)

    try:
        db = SessionLocal()
        try:
            query = db.query(Candidate)
            if registered_only:
                query = query.filter(Candidate.reg_status == "등록")
            if region:
                query = query.filter(Candidate.sd_name == region)
            if sg_type:
                query = query.filter(Candidate.sg_type_label == sg_type)
            rows = query.all()
        finally:
            db.close()

        return pd.DataFrame([{
            "name":          r.name,
            "party":         r.party,
            "sd_name":       r.sd_name,
            "sgg_name":      r.sgg_name,
            "sg_type_label": r.sg_type_label,
            "career1":       r.career1,
            "career2":       r.career2,
            "reg_status":    r.reg_status,
        } for r in rows])

    except Exception as e:
        print(f"[ai_analyzer] DB 연결 실패 → CSV 폴백: {e}")
        return _load_from_csv(region, sg_type, registered_only)


def get_candidate_names(region: str = None, sg_type: str = "광역단체장") -> list:
    """지역 + 선거유형 기준 후보자 이름 목록 반환"""
    df = load_candidates(region=region, sg_type=sg_type)
    return df["name"].tolist()


# =============================================================================
# 1-B. 주소 기반 후보자 필터 (신규)
# =============================================================================

_SD_MAP = {
    "서울": "서울특별시",   "부산": "부산광역시",   "대구": "대구광역시",
    "인천": "인천광역시",   "광주": "광주광역시",   "대전": "대전광역시",
    "울산": "울산광역시",   "세종": "세종특별자치시", "경기": "경기도",
    "강원": "강원특별자치도", "충북": "충청북도",    "충남": "충청남도",
    "전북": "전북특별자치도", "전남": "전라남도",    "경북": "경상북도",
    "경남": "경상남도",     "제주": "제주특별자치도",
}


def _parse_sd_name(address: str) -> str:
    """주소 문자열 → 시도명 변환. 예) '대구 달서구' → '대구광역시'"""
    for short, full in _SD_MAP.items():
        if short in address or full in address:
            return full
    return address.split()[0] if address.strip() else ""


def get_candidates_by_address(address: str) -> dict:
    """
    주소 입력 → 해당 지역 선거 5종 후보자 전체 반환

    Returns:
        {
          "sd_name"      : "대구광역시",
          "address_input": "대구 달서구",
          "elections"    : {"광역단체장": DataFrame, ...},
          "total_count"  : int,
          "message"      : str
        }
    """
    sd_name = _parse_sd_name(address)
    election_types = ["광역단체장", "광역의회의원", "기초단체장", "기초의회의원", "교육감"]

    elections = {}
    total = 0
    for sg_type in election_types:
        df = load_candidates(region=sd_name, sg_type=sg_type)
        elections[sg_type] = df
        total += len(df)

    return {
        "sd_name"      : sd_name,
        "address_input": address,
        "elections"    : elections,
        "total_count"  : total,
        "message"      : (
            f"'{address}' 기준 {sd_name} 선거 후보자 총 {total}명"
            if total > 0 else
            f"'{sd_name}' 지역 후보자를 찾을 수 없습니다."
        )
    }


# =============================================================================
# 1-C. 키워드 매칭 후보자 랭킹 (신규)
# =============================================================================

def keyword_match_candidates(
    candidates_df: pd.DataFrame,
    keyword: str,
    news_list: list = None,
    top_n: int = 5
) -> pd.DataFrame:
    """
    career1/career2 텍스트 + 뉴스 제목 키워드 매칭 → 관련도 점수 TOP N 반환

    Args:
        candidates_df : load_candidates() 결과 DataFrame
        keyword       : 검색어 (예: "청년취업", "실버산업", "창업")
        news_list     : 뉴스 목록 (없으면 경력 텍스트만 사용)
        top_n         : 반환 상위 수
    """
    if candidates_df.empty:
        return pd.DataFrame()

    KEYWORD_EXPAND = {
        "청년취업": ["청년", "일자리", "취업", "고용", "청년정책", "인턴"],
        "실버산업": ["노인", "고령", "실버", "요양", "복지", "경로", "시니어"],
        "창업":     ["창업", "소상공인", "자영업", "벤처", "스타트업", "중소기업"],
        "부동산":   ["주택", "부동산", "아파트", "재개발", "재건축", "분양"],
        "교육":     ["교육", "학교", "학원", "입시", "교육청", "학생"],
        "환경":     ["환경", "기후", "탄소", "미세먼지", "녹색", "에너지"],
    }
    search_terms = KEYWORD_EXPAND.get(keyword, [keyword])

    results = []
    for _, row in candidates_df.iterrows():
        career_text = " ".join(filter(None, [
            str(row.get("career1", "") or ""),
            str(row.get("career2", "") or ""),
        ])).lower()

        career_score = 0
        match_reasons = []
        for term in search_terms:
            count = career_text.count(term.lower())
            if count > 0:
                career_score += min(count * 15, 30)
                match_reasons.append(f"경력:{term}")
        career_score = min(career_score, 50)

        news_score = 0
        if news_list:
            cand_news = filter_news_by_candidate(news_list, row["name"])
            for news in cand_news:
                for term in search_terms:
                    if term.lower() in news.get("title", "").lower():
                        news_score += 10
                        match_reasons.append(f"뉴스:{term}")
            news_score = min(news_score, 50)

        total_score = career_score + news_score
        if total_score > 0:
            results.append({
                "name"         : row["name"],
                "party"        : row.get("party", ""),
                "sd_name"      : row.get("sd_name", ""),
                "sgg_name"     : row.get("sgg_name", ""),
                "sg_type_label": row.get("sg_type_label", ""),
                "career_score" : career_score,
                "news_score"   : news_score,
                "total_score"  : total_score,
                "match_reason" : ", ".join(set(match_reasons)),
            })

    if not results:
        result_df = candidates_df[["name","party","sd_name","sgg_name","sg_type_label"]].copy()
        result_df["career_score"] = 0
        result_df["news_score"]   = 0
        result_df["total_score"]  = 0
        result_df["match_reason"] = "관련 경력 없음"
        return result_df.head(top_n)

    result_df = pd.DataFrame(results)
    return result_df.sort_values("total_score", ascending=False).head(top_n)


# =============================================================================
# 1-D. Gemini 매칭 근거 한 줄 설명 (할루시네이션 방지)
# =============================================================================

def explain_match_with_gemini(
    keyword: str,
    candidate_name: str,
    party: str,
    raw_text: str,
    match_pct: int,
) -> str:
    """
    후보자 원문(경력/공약) + 키워드 → Gemini가 매칭 이유 한 줄 생성
    - raw_text 에 있는 내용만 근거 (할루시네이션 0%)
    - 실패 시 빈 문자열 반환
    """
    if not raw_text or not raw_text.strip():
        return ""

    text_snippet = raw_text.strip()[:500]

    prompt = f"""다음은 2026 지방선거 후보자의 경력/공약 원문입니다.
이 원문만을 근거로 '{keyword}' 키워드와의 관련성을 한 문장(40자 이내)으로 설명하세요.

후보자: {candidate_name} ({party})
매칭도: {match_pct}%
원문:
{text_snippet}

규칙:
1. 원문에 없는 내용은 절대 추가하지 마세요.
2. 원문에 관련 내용이 없으면 "경력 데이터에 관련 내용 없음" 이라고만 답하세요.
3. 한 문장, 40자 이내로만 답하세요. 설명이나 인사말 없이 바로 답하세요."""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        return text[:80] if len(text) > 80 else text
    except Exception as e:
        print(f"[Gemini explain_match] {e}")
        return ""


def explain_top_candidates(
    result_df: "pd.DataFrame",
    keyword: str,
    top_n: int = 3,
) -> "pd.DataFrame":
    """
    result_df 상위 top_n 명에게 Gemini 설명 생성 → ai_explain 컬럼 추가.
    Gemini API 키 없거나 실패해도 원본 df 그대로 반환.
    """
    if result_df is None or result_df.empty:
        return result_df

    df = result_df.copy()
    df["ai_explain"] = ""

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        print("[explain_top_candidates] GEMINI_API_KEY 없음 — 스킵")
        return df

    for i in range(min(top_n, len(df))):
        row = df.iloc[i]
        raw = str(row.get("원문", "") or "")
        explanation = explain_match_with_gemini(
            keyword=keyword,
            candidate_name=str(row.get("후보명", "")),
            party=str(row.get("정당", "")),
            raw_text=raw,
            match_pct=int(row.get("매칭도", 0)),
        )
        df.at[df.index[i], "ai_explain"] = explanation
        time.sleep(0.5)

    return df


# =============================================================================
# 2. 뉴스 감성 분석
# =============================================================================

def analyze_sentiment(
    title: str,
    content: str,
    candidate: str,
    candidate_list: list = None
) -> dict:
    """뉴스 1건 → Gemini 감성분석"""
    candidates_str = ", ".join(candidate_list) if candidate_list else candidate

    prompt = f"""
다음 뉴스 기사를 분석하세요.
분석 대상 후보자: {candidate}
참고 후보자 목록: {candidates_str}

[뉴스 제목]
{title}

[뉴스 본문]
{content[:1500]}

아래 JSON 형식으로만 답하세요. 다른 텍스트는 절대 포함하지 마세요.

{{
  "is_relevant": true 또는 false,
  "sentiment_score": -1.0 에서 1.0 사이 소수점 한 자리,
  "sentiment_label": "긍정" 또는 "부정" 또는 "중립",
  "importance": 1 에서 5 사이 정수,
  "one_line": "20자 이내 핵심 내용",
  "summary": "2~3문장으로 후보자에게 미치는 영향 설명"
}}

판단 기준:
- is_relevant: {candidate} 이름이 직접 언급되거나 명확히 관련된 경우만 true
- sentiment_score: {candidate}에게 유리하면 양수(+), 불리하면 음수(-)
- importance 5=스캔들/지지율급변, 4=주요정책발표, 3=당내이슈, 2=단순일정, 1=단순언급
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if "```" in text:
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else parts[0]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text.strip())
        result.setdefault("is_relevant", False)
        result.setdefault("sentiment_score", 0.0)
        result.setdefault("sentiment_label", "중립")
        result.setdefault("importance", 1)
        result.setdefault("one_line", title[:20])
        result.setdefault("summary", "분석 결과 없음")
        result["sentiment_score"] = max(-1.0, min(1.0, float(result["sentiment_score"])))
        result["importance"] = max(1, min(5, int(result["importance"])))
        return result

    except json.JSONDecodeError as e:
        print(f"[ai_analyzer] JSON 파싱 실패: {e}")
        return _default_result(title)
    except Exception as e:
        print(f"[ai_analyzer] API 오류: {e}")
        return _default_result(title)


def _default_result(title: str = "") -> dict:
    return {
        "is_relevant": False, "sentiment_score": 0.0,
        "sentiment_label": "중립", "importance": 1,
        "one_line": title[:20] if title else "분석 실패",
        "summary": "AI 분석 중 오류가 발생했습니다."
    }


# =============================================================================
# 3. 일괄 분석
# =============================================================================

def analyze_batch(
    news_list: list,
    candidate: str,
    candidate_list: list = None,
    importance_threshold: int = 3,
    delay_seconds: float = 0.5
) -> list:
    """뉴스 여러 건 일괄 분석"""
    results = []
    total = len(news_list)

    for i, news in enumerate(news_list):
        print(f"[ai_analyzer] 분석 중 {i+1}/{total}: {news.get('title', '')[:40]}")
        analysis = analyze_sentiment(
            title=news.get("title", ""),
            content=news.get("content", news.get("description", "")),
            candidate=candidate,
            candidate_list=candidate_list
        )
        if not analysis.get("is_relevant", False):
            continue
        if analysis.get("importance", 0) < importance_threshold:
            continue

        results.append({
            "date":            news.get("date", ""),
            "candidate":       candidate,
            "title":           news.get("title", ""),
            "url":             news.get("url", ""),
            "sentiment_score": analysis["sentiment_score"],
            "sentiment_label": analysis["sentiment_label"],
            "importance":      analysis["importance"],
            "one_line":        analysis["one_line"],
            "summary":         analysis["summary"]
        })
        if i < total - 1:
            time.sleep(delay_seconds)

    return results


# =============================================================================
# 4. 폴리마켓 차트용 이벤트 생성
# =============================================================================

def build_chart_events(
    news_list: list,
    candidate: str,
    candidate_list: list = None,
    importance_threshold: int = 3
) -> list:
    return analyze_batch(
        news_list=news_list,
        candidate=candidate,
        candidate_list=candidate_list,
        importance_threshold=importance_threshold
    )


# =============================================================================
# 5. 폴리마켓 + 뉴스 통합 차트 생성 (Plotly)
# =============================================================================

def create_combined_chart(
    polymarket_data: list,
    events: list,
    candidate: str,
    region: str = ""
) -> go.Figure:
    """폴리마켓 확률 라인 + 뉴스 이벤트 마커 통합 차트"""
    df_market = pd.DataFrame(polymarket_data)
    df_market["date"] = pd.to_datetime(df_market["date"])
    df_market = df_market.sort_values("date")

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_market["date"],
        y=(df_market["probability"] * 100).round(1),
        mode="lines", name="당선 확률 (%)",
        line=dict(color="#3B82F6", width=2.5),
        hovertemplate="%{x|%m/%d}<br>확률: <b>%{y:.1f}%</b><extra></extra>"
    ))

    if events:
        df_events = pd.DataFrame(events)
        df_events["date"] = pd.to_datetime(df_events["date"])
        market_lookup = df_market.set_index("date")["probability"] * 100

        def get_prob_at_date(dt):
            if len(market_lookup) == 0:
                return 50.0
            idx = market_lookup.index.get_indexer([dt], method="nearest")[0]
            return float(market_lookup.iloc[idx])

        for sentiment_filter, color, name, threshold in [
            (lambda df: df[df["sentiment_score"] >= 0.1],  "#22C55E", "📗 긍정 뉴스", None),
            (lambda df: df[df["sentiment_score"] < -0.1],  "#EF4444", "📕 부정 뉴스", None),
            (lambda df: df[(df["sentiment_score"] >= -0.1) & (df["sentiment_score"] < 0.1) & (df["importance"] >= 4)],
             "#94A3B8", "📘 중립 뉴스", None),
        ]:
            subset = sentiment_filter(df_events).copy()
            if not subset.empty:
                subset["prob"] = subset["date"].apply(get_prob_at_date)
                fig.add_trace(go.Scatter(
                    x=subset["date"], y=subset["prob"],
                    mode="markers", name=name,
                    marker=dict(color=color, size=subset["importance"] * 4 + 4,
                                symbol="circle", line=dict(color="white", width=1.5), opacity=0.9),
                    customdata=subset[["one_line", "summary", "title"]].values,
                    hovertemplate=(
                        f"<b>{name}</b><br>%{{x|%m/%d}}<br>"
                        "<b>%{customdata[0]}</b><br>%{customdata[1]}<br>"
                        "<i>%{customdata[2]}</i><extra></extra>"
                    )
                ))

    fig.update_layout(
        title=dict(text=f"{region} {candidate} — 당선 확률 + 주요 뉴스 이벤트", font=dict(size=16)),
        xaxis=dict(title="날짜", tickformat="%m/%d", showgrid=True, gridcolor="#F1F5F9"),
        yaxis=dict(title="당선 확률 (%)", range=[0, 100], showgrid=True, gridcolor="#F1F5F9"),
        hovermode="closest",
        legend=dict(orientation="h", yanchor="bottom", y=-0.25, xanchor="center", x=0.5),
        plot_bgcolor="white", paper_bgcolor="white", height=460,
        margin=dict(l=60, r=30, t=60, b=80)
    )
    fig.add_annotation(
        text="● 마커 크기 = 중요도 (1~5)", xref="paper", yref="paper",
        x=1.0, y=1.02, showarrow=False, font=dict(size=10, color="#94A3B8"), xanchor="right"
    )
    return fig


# =============================================================================
# 6. 지역별 분석 요약 (FastAPI 라우터용)
# =============================================================================

def get_region_analysis(
    region: str,
    news_list: list,
    polymarket_data: list,
    sg_type: str = "광역단체장"
) -> dict:
    """지역 전체 후보자 분석 요약 → GET /api/analysis/{region} 에서 호출"""
    df_candidates = load_candidates(region=region, sg_type=sg_type)
    candidate_names = df_candidates["name"].tolist()

    def get_latest_prob(candidate_name: str) -> float:
        for item in reversed(polymarket_data):
            if item.get("candidate") == candidate_name:
                return item.get("probability", 0.0)
        return 0.0

    results = []
    for _, row in df_candidates.iterrows():
        candidate = row["name"]
        events = build_chart_events(
            news_list=news_list, candidate=candidate,
            candidate_list=candidate_names, importance_threshold=3
        )
        cand_market = [d for d in polymarket_data if d.get("candidate") == candidate]
        chart = create_combined_chart(
            polymarket_data=cand_market, events=events,
            candidate=candidate, region=region
        )
        results.append({
            "name":               candidate,
            "party":              row.get("party", ""),
            "latest_probability": get_latest_prob(candidate),
            "event_count":        len(events),
            "positive_count":     sum(1 for e in events if e["sentiment_score"] >= 0.1),
            "negative_count":     sum(1 for e in events if e["sentiment_score"] < -0.1),
            "events":             events,
            "chart":              chart.to_dict()
        })

    results.sort(key=lambda x: x["latest_probability"], reverse=True)
    return {"region": region, "candidates": results}


# =============================================================================
# 7. 챗봇 후보자 뉴스 조회
# =============================================================================

def extract_candidate_from_query(user_input: str):
    """챗봇 입력에서 [후보자명] 패턴 추출"""
    import re
    match = re.search(r"\[([^\]]+)\]", user_input)
    return match.group(1).strip() if match else None


def filter_news_by_candidate(news_list: list, candidate: str) -> list:
    """AI 호출 전 문자열 기반 1차 필터"""
    return [
        news for news in news_list
        if candidate in news.get("title", "")
        or candidate in news.get("content", news.get("description", ""))
    ]


def chatbot_query(
    user_input: str,
    news_list: list,
    candidate_list: list = None,
    importance_threshold: int = 2,
    delay_seconds: float = 0.5
) -> dict:
    """챗봇 입력 처리: [후보자명] 입력 시 관련 뉴스 감성분석 결과 반환"""
    candidate = extract_candidate_from_query(user_input)

    if not candidate:
        return {"candidate": None, "found": False, "pre_filtered_count": 0,
                "analyzed_count": 0, "events": [],
                "message": "[후보자명] 형식으로 입력해주세요. 예: [김부겸]"}

    if candidate_list and candidate not in candidate_list:
        similar = [c for c in candidate_list if candidate in c or c in candidate]
        hint = f" 혹시 이 분을 찾으셨나요? {similar[:3]}" if similar else ""
        return {"candidate": candidate, "found": False, "pre_filtered_count": 0,
                "analyzed_count": 0, "events": [],
                "message": f"'{candidate}' 후보를 목록에서 찾을 수 없습니다.{hint}"}

    pre_filtered = filter_news_by_candidate(news_list, candidate)
    if not pre_filtered:
        return {"candidate": candidate, "found": True, "pre_filtered_count": 0,
                "analyzed_count": 0, "events": [],
                "message": f"'{candidate}' 관련 뉴스가 없습니다."}

    events = analyze_batch(
        news_list=pre_filtered, candidate=candidate,
        candidate_list=candidate_list,
        importance_threshold=importance_threshold,
        delay_seconds=delay_seconds
    )
    pos = sum(1 for e in events if e["sentiment_score"] >= 0.1)
    neg = sum(1 for e in events if e["sentiment_score"] < -0.1)

    return {
        "candidate": candidate, "found": True,
        "pre_filtered_count": len(pre_filtered),
        "analyzed_count": len(events), "events": events,
        "message": (
            f"'{candidate}' 관련 뉴스 {len(pre_filtered)}건 중 "
            f"중요도 {importance_threshold} 이상 {len(events)}건 분석 완료 "
            f"(긍정 {pos}건 / 부정 {neg}건)"
        )
    }


# =============================================================================
# 8. 단독 테스트 (터미널에서 python ai_analyzer.py 실행)
# =============================================================================

if __name__ == "__main__":

    print("=" * 60)
    print("STEP 1: 후보자 목록 로드 테스트 (DB 없으면 CSV 자동 폴백)")
    print("=" * 60)
    df = load_candidates(region="대구광역시", sg_type="광역단체장")
    if df.empty:
        print("⚠️  후보자 데이터 없음 — candidates_2026*.csv 파일 확인 필요")
    else:
        print(df[["name", "party"]].to_string())
    candidates = df["name"].tolist()
    print(f"\n대구 광역단체장 후보: {candidates}")

    print("\n" + "=" * 60)
    print("STEP 1-B: 주소 기반 후보자 필터 테스트")
    print("=" * 60)
    addr_result = get_candidates_by_address("대구 달서구")
    print(addr_result["message"])
    for sg_type, sdf in addr_result["elections"].items():
        if not sdf.empty:
            print(f"  {sg_type}: {sdf['name'].tolist()[:3]} ...")

    print("\n" + "=" * 60)
    print("STEP 1-C: 키워드 매칭 테스트")
    print("=" * 60)
    all_df = load_candidates(region="대구광역시")
    if not all_df.empty:
        matched = keyword_match_candidates(all_df, keyword="창업", top_n=3)
        print(matched[["name", "party", "sg_type_label", "total_score", "match_reason"]].to_string())
    else:
        print("⚠️  데이터 없음")

    print("\n" + "=" * 60)
    print("STEP 2: 뉴스 감성분석 테스트 (Gemini API 호출)")
    print("=" * 60)
    sample_news = {
        "date": "2026-04-28",
        "title": "김부겸 후보, 대구 동성로 유세서 3만 인파 집결",
        "content": (
            "더불어민주당 김부겸 대구시장 후보가 27일 대구 동성로에서 "
            "대규모 유세를 진행했다. 약 3만 명의 시민이 운집했다."
        ),
        "url": "https://example.com/1"
    }

    if os.getenv("GEMINI_API_KEY"):
        result = analyze_sentiment(
            title=sample_news["title"],
            content=sample_news["content"],
            candidate="김부겸",
            candidate_list=candidates
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("⚠️  GEMINI_API_KEY 없음 — .env 파일 확인 필요 (감성분석 스킵)")

    print("\n" + "=" * 60)
    print("STEP 3: 폴리마켓 차트 테스트 (mock 데이터)")
    print("=" * 60)
    mock_polymarket = [
        {"date": f"2026-04-{d}", "candidate": "김부겸", "probability": 0.35 + d * 0.01}
        for d in range(21, 29)
    ]
    fig = create_combined_chart(
        polymarket_data=mock_polymarket, events=[],
        candidate="김부겸", region="대구광역시"
    )
    fig.write_html("test_chart.html")
    print("차트 저장 완료: test_chart.html (브라우저에서 열어 확인)")

    print("\n✅ 모든 테스트 완료")