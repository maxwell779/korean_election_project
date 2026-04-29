# backend/app/services/ai_analyzer.py
# [파트 C] 백승훈 담당

import os
import re
import json
import time
import pandas as pd
import plotly.graph_objects as go
from dotenv import load_dotenv
import google.generativeai as genai
from app.database import SessionLocal
from app.models import Candidate

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


# =============================================================================
# 1. 후보자 데이터 로드
# =============================================================================

def load_candidates(region: str = None, sg_type: str = None, registered_only: bool = True) -> pd.DataFrame:
    db = SessionLocal()
    try:
        q = db.query(Candidate)
        if registered_only:
            q = q.filter(Candidate.reg_status == "등록")
        if region:
            q = q.filter(Candidate.sd_name == region)
        if sg_type:
            q = q.filter(Candidate.sg_type_label == sg_type)
        rows = q.all()
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


def get_candidate_names(region: str = None, sg_type: str = "광역단체장") -> list:
    df = load_candidates(region=region, sg_type=sg_type)
    return df["name"].tolist() if not df.empty else []


# =============================================================================
# 2. 뉴스 감성 분석
# =============================================================================

def analyze_sentiment(title: str, content: str, candidate: str, candidate_list: list = None) -> dict:
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
- importance:
    5 = 스캔들, 지지율 급변, 중대 발언
    4 = 주요 정책 발표, 대규모 유세
    3 = 당 내부 이슈, 지역 현안 입장
    2 = 단순 일정, 행사 참여
    1 = 단순 언급, 간접 관련
"""

    # [수정] text 변수 초기화 — except 블록에서 UnboundLocalError 방지
    text = ""
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
        result["importance"]      = max(1, min(5, int(result["importance"])))

        return result

    except json.JSONDecodeError as e:
        print(f"[ai_analyzer] JSON 파싱 실패: {e}\n원문: {text[:200]}")
        return _default_result(title)

    except Exception as e:
        print(f"[ai_analyzer] API 오류: {e}")
        return _default_result(title)


def _default_result(title: str = "") -> dict:
    return {
        "is_relevant":     False,
        "sentiment_score": 0.0,
        "sentiment_label": "중립",
        "importance":      1,
        "one_line":        title[:20] if title else "분석 실패",
        "summary":         "AI 분석 중 오류가 발생했습니다."
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
    results = []
    total   = len(news_list)

    for i, news in enumerate(news_list):
        print(f"[ai_analyzer] 분석 중 {i+1}/{total}: {news.get('title', '')[:40]}")

        analysis = analyze_sentiment(
            title          = news.get("title", ""),
            content        = news.get("content", news.get("description", "")),
            candidate      = candidate,
            candidate_list = candidate_list,
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
            "summary":         analysis["summary"],
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
    importance_threshold: int = 3,
) -> list:
    return analyze_batch(
        news_list            = news_list,
        candidate            = candidate,
        candidate_list       = candidate_list,
        importance_threshold = importance_threshold,
    )


# =============================================================================
# 5. 폴리마켓 + 뉴스 통합 차트 생성
# =============================================================================

def create_combined_chart(
    polymarket_data: list,
    events: list,
    candidate: str,
    region: str = "",
) -> go.Figure:
    # [수정] 빈 리스트이면 빈 Figure 반환 — KeyError 방지
    if not polymarket_data:
        fig = go.Figure()
        fig.update_layout(
            title=f"{region} {candidate} — 데이터 수집 중",
            height=460,
        )
        return fig

    df_market = pd.DataFrame(polymarket_data)

    # [수정] 필수 컬럼 없으면 빈 Figure 반환
    if "date" not in df_market.columns or "probability" not in df_market.columns:
        return go.Figure()

    df_market["date"] = pd.to_datetime(df_market["date"])
    df_market = df_market.sort_values("date")

    fig = go.Figure()

    # 폴리마켓 확률 라인
    fig.add_trace(go.Scatter(
        x             = df_market["date"],
        y             = (df_market["probability"] * 100).round(1),
        mode          = "lines",
        name          = "당선 확률 (%)",
        line          = dict(color="#3B82F6", width=2.5),
        hovertemplate = "%{x|%m/%d}<br>확률: <b>%{y:.1f}%</b><extra></extra>",
    ))

    # 뉴스 마커
    if events:
        df_events = pd.DataFrame(events)
        df_events["date"] = pd.to_datetime(df_events["date"])

        market_lookup = df_market.set_index("date")["probability"] * 100

        def get_prob_at_date(dt):
            if len(market_lookup) == 0:
                return 50.0
            idx = market_lookup.index.get_indexer([dt], method="nearest")[0]
            return float(market_lookup.iloc[idx])

        for sentiment_filter, color, label in [
            (lambda df: df[df["sentiment_score"] >= 0.1],   "#22C55E", "📗 긍정 뉴스"),
            (lambda df: df[df["sentiment_score"] < -0.1],   "#EF4444", "📕 부정 뉴스"),
        ]:
            subset = sentiment_filter(df_events).copy()
            if subset.empty:
                continue
            subset["prob"] = subset["date"].apply(get_prob_at_date)
            fig.add_trace(go.Scatter(
                x            = subset["date"],
                y            = subset["prob"],
                mode         = "markers",
                name         = label,
                marker       = dict(
                    color   = color,
                    size    = subset["importance"] * 4 + 4,
                    symbol  = "circle",
                    line    = dict(color="white", width=1.5),
                    opacity = 0.9,
                ),
                customdata   = subset[["one_line", "summary", "title"]].values,
                hovertemplate = (
                    f"<b>{label}</b><br>"
                    "%{x|%m/%d}<br>"
                    "<b>%{customdata[0]}</b><br>"
                    "%{customdata[1]}<br>"
                    "<i>%{customdata[2]}</i>"
                    "<extra></extra>"
                ),
            ))

    fig.update_layout(
        title       = dict(text=f"{region} {candidate} — 당선 확률 + 주요 뉴스 이벤트", font=dict(size=16)),
        xaxis       = dict(title="날짜", tickformat="%m/%d", showgrid=True, gridcolor="#F1F5F9"),
        yaxis       = dict(title="당선 확률 (%)", range=[0, 100], showgrid=True, gridcolor="#F1F5F9"),
        hovermode   = "closest",
        legend      = dict(orientation="h", yanchor="bottom", y=-0.25, xanchor="center", x=0.5),
        plot_bgcolor  = "white",
        paper_bgcolor = "white",
        height        = 460,
        margin        = dict(l=60, r=30, t=60, b=80),
    )

    return fig


# =============================================================================
# 6. 지역별 분석 요약 (FastAPI 라우터용)
# =============================================================================

def get_region_analysis(
    region: str,
    news_list: list,
    polymarket_data: list,
    sg_type: str = "광역단체장",
) -> dict:
    """
    지역 전체 후보자 분석 요약.
    polymarket_data 의 candidate 는 영문 또는 한글일 수 있음.
    """
    df_candidates   = load_candidates(region=region, sg_type=sg_type)
    candidate_names = df_candidates["name"].tolist()

    # [수정] 폴리마켓 데이터에서 한글명으로 확률 조회
    # candidate_ko 있으면 사용, 없으면 candidate(영문) 그대로
    def get_latest_prob(korean_name: str) -> float:
        for item in reversed(polymarket_data):
            ko = item.get("candidate_ko") or item.get("candidate", "")
            if ko == korean_name:
                return item.get("probability", 0.0)
        return 0.0

    def get_market_data_for_candidate(korean_name: str) -> list:
        result = []
        for item in polymarket_data:
            ko = item.get("candidate_ko") or item.get("candidate", "")
            if ko == korean_name:
                result.append(item)
        return result

    results = []
    for _, row in df_candidates.iterrows():
        candidate = row["name"]

        events = build_chart_events(
            news_list            = news_list,
            candidate            = candidate,
            candidate_list       = candidate_names,
            importance_threshold = 3,
        )

        cand_market = get_market_data_for_candidate(candidate)

        # [수정] 차트용 polymarket_data 형식 통일
        chart_data = [
            {
                "date":        d.get("fetched_at", "")[:10] if d.get("fetched_at") else "",
                "probability": d.get("probability", 0),
            }
            for d in cand_market
        ]

        chart = create_combined_chart(
            polymarket_data = chart_data,
            events          = events,
            candidate       = candidate,
            region          = region,
        )

        results.append({
            "name":               candidate,
            "party":              row.get("party", ""),
            "latest_probability": get_latest_prob(candidate),
            "event_count":        len(events),
            "positive_count":     sum(1 for e in events if e["sentiment_score"] >= 0.1),
            "negative_count":     sum(1 for e in events if e["sentiment_score"] < -0.1),
            "events":             events,
            "chart":              chart.to_dict(),
        })

    results.sort(key=lambda x: x["latest_probability"], reverse=True)
    return {"region": region, "candidates": results}


# =============================================================================
# 7. 챗봇
# =============================================================================

def extract_candidate_from_query(user_input: str):
    match = re.search(r"\[([^\]]+)\]", user_input)
    return match.group(1).strip() if match else None


def filter_news_by_candidate(news_list: list, candidate: str) -> list:
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
    delay_seconds: float = 0.5,
) -> dict:
    candidate = extract_candidate_from_query(user_input)

    if not candidate:
        return {
            "candidate": None, "found": False,
            "pre_filtered_count": 0, "analyzed_count": 0, "events": [],
            "message": "[후보자명] 형식으로 입력해주세요. 예: [정원오]",
        }

    if candidate_list and candidate not in candidate_list:
        similar = [c for c in candidate_list if candidate in c or c in candidate]
        hint = f" 혹시 이 분을 찾으셨나요? {similar[:3]}" if similar else ""
        return {
            "candidate": candidate, "found": False,
            "pre_filtered_count": 0, "analyzed_count": 0, "events": [],
            "message": f"'{candidate}' 후보를 찾을 수 없습니다.{hint}",
        }

    pre_filtered = filter_news_by_candidate(news_list, candidate)

    if not pre_filtered:
        return {
            "candidate": candidate, "found": True,
            "pre_filtered_count": 0, "analyzed_count": 0, "events": [],
            "message": f"'{candidate}' 관련 뉴스가 없습니다.",
        }

    events = analyze_batch(
        news_list            = pre_filtered,
        candidate            = candidate,
        candidate_list       = candidate_list,
        importance_threshold = importance_threshold,
        delay_seconds        = delay_seconds,
    )

    pos = sum(1 for e in events if e["sentiment_score"] >= 0.1)
    neg = sum(1 for e in events if e["sentiment_score"] < -0.1)

    return {
        "candidate":          candidate,
        "found":              True,
        "pre_filtered_count": len(pre_filtered),
        "analyzed_count":     len(events),
        "events":             events,
        "message": (
            f"'{candidate}' 관련 뉴스 {len(pre_filtered)}건 중 "
            f"중요도 {importance_threshold} 이상 {len(events)}건 분석 완료 "
            f"(긍정 {pos}건 / 부정 {neg}건)"
        ),
    }