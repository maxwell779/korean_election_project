# =============================================================================
# backend/app/services/ai_analyzer.py
#
# [파트 C] 백승훈 담당
# Gemini API 기반 뉴스 감성분석 + 폴리마켓 차트 이벤트 생성
#
# 주요 함수
#   load_candidates()         CSV → 후보자 목록
#   analyze_sentiment()       뉴스 1건 → 감성점수 + 요약
#   analyze_batch()           뉴스 여러 건 → 일괄 처리
#   build_chart_events()      폴리마켓 차트용 이벤트 필터
#   create_combined_chart()   폴리마켓 확률 + 뉴스 마커 통합 차트
# =============================================================================

import os
import json
import time
import pandas as pd
import plotly.graph_objects as go
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# ── Gemini 초기화 ─────────────────────────────────────────────────────────────
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

# ── CSV 경로 (프로젝트 루트 기준) ─────────────────────────────────────────────
CANDIDATE_CSV = os.path.join(
    os.path.dirname(__file__),
    "candidates_2026_20260428_122644.csv"
)


# =============================================================================
# 1. 후보자 데이터 로드
# =============================================================================

def load_candidates(
    region: str = None,
    sg_type: str = None,
    registered_only: bool = True
) -> pd.DataFrame:
    """
    CSV에서 후보자 목록 로드

    Args:
        region        : 시도명 필터 (예: "대구광역시"). None이면 전체
        sg_type       : 선거 유형 필터 (예: "광역단체장"). None이면 전체
        registered_only: True면 '등록' 상태만 반환

    Returns:
        DataFrame — columns: name, party, sd_name, sgg_name,
                              sg_type_label, career1, career2, reg_status
    """
    df = pd.read_csv(CANDIDATE_CSV, encoding="utf-8-sig")

    if registered_only:
        df = df[df["reg_status"] == "등록"]

    if region:
        df = df[df["sd_name"] == region]

    if sg_type:
        df = df[df["sg_type_label"] == sg_type]

    return df[[
        "name", "party", "sd_name", "sgg_name",
        "sg_type_label", "career1", "career2", "reg_status"
    ]].reset_index(drop=True)


def get_candidate_names(region: str = None, sg_type: str = "광역단체장") -> list:
    """지역 + 선거유형 기준 후보자 이름 목록 반환"""
    df = load_candidates(region=region, sg_type=sg_type)
    return df["name"].tolist()


# =============================================================================
# 2. 뉴스 감성 분석 (핵심 함수)
# =============================================================================

def analyze_sentiment(
    title: str,
    content: str,
    candidate: str,
    candidate_list: list = None
) -> dict:
    """
    뉴스 1건 → Gemini 감성분석

    Args:
        title          : 뉴스 제목
        content        : 뉴스 본문 (또는 요약)
        candidate      : 분석 대상 후보자명 (예: "김부겸")
        candidate_list : 매칭 후보자 전체 목록 (is_relevant 판단용)

    Returns:
        {
          "is_relevant"    : bool,   # 해당 후보 관련 여부
          "sentiment_score": float,  # -1.0(매우 부정) ~ 1.0(매우 긍정)
          "sentiment_label": str,    # "긍정" / "부정" / "중립"
          "importance"     : int,    # 1~5 (5=선거 결과에 큰 영향)
          "one_line"       : str,    # 차트 마커용 20자 이내 요약
          "summary"        : str     # hover 상세 2~3문장
        }
    """
    candidates_str = (
        ", ".join(candidate_list) if candidate_list
        else candidate
    )

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
    5 = 스캔들, 지지율 급변, 중대 발언 (선거 결과에 직접 영향)
    4 = 주요 정책 발표, 대규모 유세
    3 = 당 내부 이슈, 지역 현안 입장
    2 = 단순 일정, 행사 참여
    1 = 단순 언급, 간접 관련
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # 코드블록 제거
        if "```" in text:
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else parts[0]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text.strip())

        # 필수 필드 검증 및 기본값 보정
        result.setdefault("is_relevant", False)
        result.setdefault("sentiment_score", 0.0)
        result.setdefault("sentiment_label", "중립")
        result.setdefault("importance", 1)
        result.setdefault("one_line", title[:20])
        result.setdefault("summary", "분석 결과 없음")

        # 범위 보정
        result["sentiment_score"] = max(-1.0, min(1.0, float(result["sentiment_score"])))
        result["importance"] = max(1, min(5, int(result["importance"])))

        return result

    except json.JSONDecodeError as e:
        print(f"[ai_analyzer] JSON 파싱 실패: {e}\n원문: {text[:200]}")
        return _default_result(title)

    except Exception as e:
        print(f"[ai_analyzer] API 오류: {e}")
        return _default_result(title)


def _default_result(title: str = "") -> dict:
    """API 실패 시 기본값"""
    return {
        "is_relevant": False,
        "sentiment_score": 0.0,
        "sentiment_label": "중립",
        "importance": 1,
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
    """
    뉴스 여러 건 일괄 분석

    Args:
        news_list           : [{"date": "2026-04-28", "title": "...",
                                "content": "...", "url": "..."}, ...]
        candidate           : 분석 대상 후보자명
        candidate_list      : 전체 후보자 목록 (매칭 정확도 향상)
        importance_threshold: 이 이상 중요도만 반환
        delay_seconds       : API 호출 간격 (Gemini quota 관리)

    Returns:
        [{"date", "candidate", "sentiment_score", "sentiment_label",
          "importance", "one_line", "summary", "title", "url"}, ...]
    """
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

        # 관련 없거나 중요도 낮으면 제외
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

        # Gemini 무료 quota: 분당 15회 → 0.5초 간격으로 안전하게 유지
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
    """
    폴리마켓 확률 차트에 올릴 뉴스 이벤트 목록 생성

    중요도 importance_threshold 이상인 뉴스만 마커로 표시
    """
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
    """
    폴리마켓 확률 라인 + 뉴스 이벤트 마커 통합 차트

    Args:
        polymarket_data : [{"date": "2026-04-21", "probability": 0.52}, ...]
        events          : build_chart_events() 반환값
        candidate       : 후보자명
        region          : 지역명 (차트 제목용)

    Returns:
        plotly Figure (Streamlit에서 st.plotly_chart(fig) 로 표시)
    """
    df_market = pd.DataFrame(polymarket_data)
    df_market["date"] = pd.to_datetime(df_market["date"])
    df_market = df_market.sort_values("date")

    fig = go.Figure()

    # ── 1. 폴리마켓 확률 라인 ────────────────────────────────────────────────
    fig.add_trace(go.Scatter(
        x=df_market["date"],
        y=(df_market["probability"] * 100).round(1),
        mode="lines",
        name="당선 확률 (%)",
        line=dict(color="#3B82F6", width=2.5),
        hovertemplate="%{x|%m/%d}<br>확률: <b>%{y:.1f}%</b><extra></extra>"
    ))

    # ── 2. 뉴스 마커 (긍정 / 부정 분리) ─────────────────────────────────────
    if events:
        df_events = pd.DataFrame(events)
        df_events["date"] = pd.to_datetime(df_events["date"])

        # 날짜 기준으로 확률 매핑 (nearest date)
        market_lookup = df_market.set_index("date")["probability"] * 100

        def get_prob_at_date(dt):
            """이벤트 날짜에 가장 가까운 폴리마켓 확률 반환"""
            if len(market_lookup) == 0:
                return 50.0
            idx = market_lookup.index.get_indexer([dt], method="nearest")[0]
            return float(market_lookup.iloc[idx])

        # 긍정 이벤트
        pos = df_events[df_events["sentiment_score"] >= 0.1].copy()
        if not pos.empty:
            pos["prob"] = pos["date"].apply(get_prob_at_date)
            fig.add_trace(go.Scatter(
                x=pos["date"],
                y=pos["prob"],
                mode="markers",
                name="📗 긍정 뉴스",
                marker=dict(
                    color="#22C55E",
                    size=pos["importance"] * 4 + 4,  # 중요도 = 마커 크기
                    symbol="circle",
                    line=dict(color="white", width=1.5),
                    opacity=0.9
                ),
                customdata=pos[["one_line", "summary", "title"]].values,
                hovertemplate=(
                    "<b>📗 긍정 뉴스</b><br>"
                    "%{x|%m/%d}<br>"
                    "<b>%{customdata[0]}</b><br>"
                    "%{customdata[1]}<br>"
                    "<i>%{customdata[2]}</i>"
                    "<extra></extra>"
                )
            ))

        # 부정 이벤트
        neg = df_events[df_events["sentiment_score"] < -0.1].copy()
        if not neg.empty:
            neg["prob"] = neg["date"].apply(get_prob_at_date)
            fig.add_trace(go.Scatter(
                x=neg["date"],
                y=neg["prob"],
                mode="markers",
                name="📕 부정 뉴스",
                marker=dict(
                    color="#EF4444",
                    size=neg["importance"] * 4 + 4,
                    symbol="circle",
                    line=dict(color="white", width=1.5),
                    opacity=0.9
                ),
                customdata=neg[["one_line", "summary", "title"]].values,
                hovertemplate=(
                    "<b>📕 부정 뉴스</b><br>"
                    "%{x|%m/%d}<br>"
                    "<b>%{customdata[0]}</b><br>"
                    "%{customdata[1]}<br>"
                    "<i>%{customdata[2]}</i>"
                    "<extra></extra>"
                )
            ))

        # 중립 이벤트 (중요도 5 이상만 표시)
        neu = df_events[
            (df_events["sentiment_score"] >= -0.1) &
            (df_events["sentiment_score"] < 0.1) &
            (df_events["importance"] >= 4)
        ].copy()
        if not neu.empty:
            neu["prob"] = neu["date"].apply(get_prob_at_date)
            fig.add_trace(go.Scatter(
                x=neu["date"],
                y=neu["prob"],
                mode="markers",
                name="📘 중립 뉴스",
                marker=dict(
                    color="#94A3B8",
                    size=neu["importance"] * 4 + 4,
                    symbol="circle",
                    line=dict(color="white", width=1.5),
                    opacity=0.8
                ),
                customdata=neu[["one_line", "summary", "title"]].values,
                hovertemplate=(
                    "<b>📘 중립 뉴스</b><br>"
                    "%{x|%m/%d}<br>"
                    "<b>%{customdata[0]}</b><br>"
                    "%{customdata[1]}<br>"
                    "<i>%{customdata[2]}</i>"
                    "<extra></extra>"
                )
            ))

    # ── 3. 레이아웃 ──────────────────────────────────────────────────────────
    title_str = f"{region} {candidate} — 당선 확률 + 주요 뉴스 이벤트"
    fig.update_layout(
        title=dict(text=title_str, font=dict(size=16)),
        xaxis=dict(
            title="날짜",
            tickformat="%m/%d",
            showgrid=True,
            gridcolor="#F1F5F9"
        ),
        yaxis=dict(
            title="당선 확률 (%)",
            range=[0, 100],
            showgrid=True,
            gridcolor="#F1F5F9"
        ),
        hovermode="closest",
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.25,
            xanchor="center",
            x=0.5
        ),
        plot_bgcolor="white",
        paper_bgcolor="white",
        height=460,
        margin=dict(l=60, r=30, t=60, b=80)
    )

    # 마커 크기 범례 (중요도 안내)
    fig.add_annotation(
        text="● 마커 크기 = 중요도 (1~5)",
        xref="paper", yref="paper",
        x=1.0, y=1.02,
        showarrow=False,
        font=dict(size=10, color="#94A3B8"),
        xanchor="right"
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
    """
    지역 전체 후보자 분석 요약
    → GET /api/analysis/{region} 에서 호출

    Returns:
        {
          "region": str,
          "candidates": [
            {
              "name": str,
              "party": str,
              "latest_probability": float,
              "event_count": int,
              "positive_count": int,
              "negative_count": int,
              "events": [...],
              "chart": Plotly figure dict
            }
          ]
        }
    """
    # 해당 지역 후보자 목록
    df_candidates = load_candidates(region=region, sg_type=sg_type)
    candidate_names = df_candidates["name"].tolist()

    # 폴리마켓 최신 확률 lookup
    def get_latest_prob(candidate_name: str) -> float:
        for item in reversed(polymarket_data):
            if item.get("candidate") == candidate_name:
                return item.get("probability", 0.0)
        return 0.0

    results = []
    for _, row in df_candidates.iterrows():
        candidate = row["name"]

        # 해당 후보자 뉴스 이벤트 분석
        events = build_chart_events(
            news_list=news_list,
            candidate=candidate,
            candidate_list=candidate_names,
            importance_threshold=3
        )

        # 폴리마켓 데이터 필터 (해당 후보자만)
        cand_market = [
            d for d in polymarket_data
            if d.get("candidate") == candidate
        ]

        # 차트 생성
        chart = create_combined_chart(
            polymarket_data=cand_market,
            events=events,
            candidate=candidate,
            region=region
        )

        results.append({
            "name":                candidate,
            "party":               row.get("party", ""),
            "latest_probability":  get_latest_prob(candidate),
            "event_count":         len(events),
            "positive_count":      sum(1 for e in events if e["sentiment_score"] >= 0.1),
            "negative_count":      sum(1 for e in events if e["sentiment_score"] < -0.1),
            "events":              events,
            "chart":               chart.to_dict()  # React/Streamlit에서 렌더링
        })

    # 폴리마켓 확률 내림차순 정렬
    results.sort(key=lambda x: x["latest_probability"], reverse=True)

    return {"region": region, "candidates": results}


# =============================================================================
# 7. 단독 테스트 (터미널에서 python ai_analyzer.py 실행)
# =============================================================================

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("STEP 1: 후보자 목록 로드 테스트")
    print("=" * 60)
    df = load_candidates(region="대구광역시", sg_type="광역단체장")
    print(df[["name", "party"]].to_string())
    candidates = df["name"].tolist()
    print(f"\n대구 광역단체장 후보: {candidates}")

    print("\n" + "=" * 60)
    print("STEP 2: 뉴스 단일 감성분석 테스트 (샘플 데이터)")
    print("=" * 60)
    sample_news = {
        "date": "2026-04-28",
        "title": "김부겸 후보, 대구 동성로 유세서 3만 인파 집결",
        "content": (
            "더불어민주당 김부겸 대구시장 후보가 27일 대구 동성로에서 "
            "대규모 유세를 진행했다. 주최 측에 따르면 약 3만 명의 시민이 "
            "운집해 역대 대구 선거 유세 중 최다 기록을 세웠다. "
            "김 후보는 '대구에서도 변화의 바람이 불고 있다'고 강조했다."
        ),
        "url": "https://example.com/1"
    }

    result = analyze_sentiment(
        title=sample_news["title"],
        content=sample_news["content"],
        candidate="김부겸",
        candidate_list=candidates
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

    print("\n" + "=" * 60)
    print("STEP 3: 일괄 분석 테스트 (3건)")
    print("=" * 60)
    news_list = [
        sample_news,
        {
            "date": "2026-04-27",
            "title": "대구시 미세먼지 이틀째 '나쁨'… 대기질 악화",
            "content": "대구광역시 전역에 미세먼지 농도가 높은 상태가 이틀째 지속되고 있다.",
            "url": "https://example.com/2"
        },
        {
            "date": "2026-04-26",
            "title": "이재만 후보 캠프, 선거자금 유용 의혹 제기",
            "content": (
                "국민의힘 이재만 대구시장 후보 측 선거자금 일부가 "
                "비공식 경로로 사용됐다는 내부 제보가 나왔다. "
                "해당 의혹이 사실로 확인될 경우 선거법 위반 가능성도 있다."
            ),
            "url": "https://example.com/3"
        }
    ]

    batch = analyze_batch(
        news_list=news_list,
        candidate="김부겸",
        candidate_list=candidates,
        importance_threshold=2  # 테스트용: 낮게 설정
    )
    print(f"필터 후 결과: {len(batch)}건")
    for item in batch:
        label = "🟢" if item["sentiment_score"] >= 0.1 else "🔴" if item["sentiment_score"] < -0.1 else "⚪"
        print(f"  {label} [{item['importance']}] {item['one_line']} (score: {item['sentiment_score']})")

    print("\n" + "=" * 60)
    print("STEP 4: 폴리마켓 + 뉴스 통합 차트 테스트 (mock 데이터)")
    print("=" * 60)
    mock_polymarket = [
        {"date": "2026-04-21", "candidate": "김부겸", "probability": 0.35},
        {"date": "2026-04-22", "candidate": "김부겸", "probability": 0.36},
        {"date": "2026-04-23", "candidate": "김부겸", "probability": 0.38},
        {"date": "2026-04-24", "candidate": "김부겸", "probability": 0.37},
        {"date": "2026-04-25", "candidate": "김부겸", "probability": 0.40},
        {"date": "2026-04-26", "candidate": "김부겸", "probability": 0.42},
        {"date": "2026-04-27", "candidate": "김부겸", "probability": 0.45},
        {"date": "2026-04-28", "candidate": "김부겸", "probability": 0.48},
    ]

    if batch:
        fig = create_combined_chart(
            polymarket_data=mock_polymarket,
            events=batch,
            candidate="김부겸",
            region="대구광역시"
        )
        print(f"차트 생성 완료 — trace 수: {len(fig.data)}개")
        # HTML로 저장해서 확인
        fig.write_html("test_chart.html")
        print("차트 저장: test_chart.html (브라우저에서 열어 확인)")
    else:
        print("분석 결과 없음 — mock 데이터로 차트만 생성")
        fig = create_combined_chart(
            polymarket_data=mock_polymarket,
            events=[],
            candidate="김부겸",
            region="대구광역시"
        )
        fig.write_html("test_chart.html")
        print("차트 저장: test_chart.html")

    print("\n✅ 모든 테스트 완료")
    print("다음 단계: 권효중님 routers/analysis.py 에서 get_region_analysis() 호출")
