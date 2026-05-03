#!/usr/bin/env python3
# streamlit_chatbot.py  v4
# ─────────────────────────────────────────────
# 변경 이력 (v3 → v4)
#   TAB3 공약 키워드 매칭 — 3-Tier 데이터 소스 전략
#     [Tier 1] 선관위 선거공약 API  getCnddtElecPrmsInfoInqire  (후보별)
#     [Tier 2] 선관위 정당정책 API  getPolitPrtyPolicyInqire    (정당별 → 후보 매핑)
#     [Tier 3] CSV 경력 데이터                                  (API 모두 미등록 시)
# ─────────────────────────────────────────────
import streamlit as st
import pandas as pd
import requests
import os, sys, time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from ai_analyzer import (
    get_candidates_by_address,
    keyword_match_candidates,
    load_candidates,
    explain_top_candidates,
    _parse_sd_name,          # ← ai_analyzer에 존재하는 함수만 import
)

# ── 상수 ──────────────────────────────────────────────────────────────────────
PUBLIC_KEY = os.getenv("PUBLIC_DATA_API_KEY", "")

# [Tier 1] 후보자별 선거공약
PROMISE_URL = (
    "http://apis.data.go.kr/9760000/ElecPrmsInfoInqireService"
    "/getCnddtElecPrmsInfoInqire"
)

# [Tier 2] 정당별 정책
PARTY_POLICY_URL = (
    "http://apis.data.go.kr/9760000/ElecPolitPrtyInfoInqireService"
    "/getPolitPrtyPolicyInqire"
)

SG_ID_2026 = "20260603"

SG_TYPE_MAP = {
    "광역단체장": "3",
    "교육감":     "4",
    "광역의회의원": "5",
    "기초단체장": "6",
    "기초의회의원": "7",
}

KEYWORD_EXPAND = {
    "청년취업":  ["청년", "일자리", "취업", "고용"],
    "실버산업":  ["노인", "고령", "실버", "요양", "복지", "시니어"],
    "창업":      ["창업", "소상공인", "자영업", "스타트업", "중소기업"],
    "부동산":    ["주택", "부동산", "아파트", "재개발"],
    "교육":      ["교육", "학교", "입시", "학생"],
    "환경":      ["환경", "기후", "탄소", "미세먼지"],
    "교통":      ["교통", "지하철", "버스", "도로"],
    "복지":      ["복지", "의료", "돌봄", "장애인"],
    "청년":      ["청년", "청소년", "청년층", "젊은", "20대", "30대"],
    "여성":      ["여성", "성평등", "출산", "육아", "보육"],
    "안전":      ["안전", "범죄", "경찰", "소방", "재난"],
    "경제":      ["경제", "성장", "산업", "투자", "일자리"],
    "AI":        ["AI", "인공지능", "디지털", "스마트", "데이터"],
    "로봇":      ["로봇", "자동화", "제조", "스마트팩토리"],
}


# =============================================================================
# ▼▼▼ 수정: _parse_sgg_name 로컬 정의 (ai_analyzer에 없는 함수) ▼▼▼
# =============================================================================
def _parse_sgg_name(address: str) -> str:
    """
    주소 문자열 → 시군구명 추출.
    예) '대구 달서구' → '달서구'
        '경기도 수원시 영통구' → '수원시'
    """
    parts = address.strip().split()
    if len(parts) >= 2:
        return parts[1]
    return ""
# =============================================================================


# ── 페이지 설정 ────────────────────────────────────────────────────────────────
st.set_page_config(page_title="PolyElection 2026", page_icon="🗳️", layout="wide")
st.title("🗳️ PolyElection 2026 — 선거 AI 분석")
st.caption("내 주소 입력 → 투표 가이드 + 후보 공약 키워드 매칭")
st.divider()

for k in ["addr_result", "vote_guide", "promise_result"]:
    if k not in st.session_state:
        st.session_state[k] = None


# =============================================================================
# 데이터 수집 함수
# =============================================================================

def fetch_promises(sg_typecode: str) -> list:
    """[Tier 1] 선관위 선거공약 API — 후보자별 공약 원문"""
    if not PUBLIC_KEY:
        return []
    params = {
        "serviceKey": PUBLIC_KEY,
        "pageNo":     "1",
        "numOfRows":  "100",
        "sgId":       SG_ID_2026,
        "sgTypecode": sg_typecode,
        "type":       "json",
    }
    try:
        resp = requests.get(PROMISE_URL, params=params, timeout=15)
        resp.raise_for_status()
        data  = resp.json()
        items = (data.get("response", {})
                     .get("body", {})
                     .get("items", {})
                     .get("item", []))
        return items if isinstance(items, list) else ([items] if items else [])
    except Exception as e:
        print(f"[선거공약 API] {e}")  # 터미널만, 화면 표시 안 함
        return []


def fetch_party_policy(sg_typecode: str) -> list:
    """
    [Tier 2] 선관위 정당정책 API — 정당별 정책 원문
    응답 필드: jdName(정당명), prmsTitl(정책제목), prmsOrgzCn(정책내용)
    """
    if not PUBLIC_KEY:
        return []
    params = {
        "serviceKey": PUBLIC_KEY,
        "pageNo":     "1",
        "numOfRows":  "100",
        "sgId":       SG_ID_2026,
        "sgTypecode": sg_typecode,
        "type":       "json",
    }
    try:
        resp = requests.get(PARTY_POLICY_URL, params=params, timeout=15)
        resp.raise_for_status()
        data  = resp.json()
        items = (data.get("response", {})
                     .get("body", {})
                     .get("items", {})
                     .get("item", []))
        return items if isinstance(items, list) else ([items] if items else [])
    except Exception as e:
        print(f"[정당정책 API] {e}")  # 터미널만, 화면 표시 안 함
        return []


def calc_match(text: str, keyword: str):
    """
    텍스트 + 키워드 → (매칭도 %, 매칭 근거 리스트)
    - 키워드 직접 등장: +30점
    - 확장어 등장마다: +20점 (최대 40점)
    - 상한: 100점
    """
    if not text:
        return 0, []
    text_l = text.lower()
    terms   = KEYWORD_EXPAND.get(keyword, [keyword])
    score   = 0
    reasons = []

    if keyword in text:
        score += 30
        reasons.append(f"'{keyword}' 직접 언급")

    for term in terms:
        if term != keyword and term in text_l:
            cnt    = text_l.count(term)
            score += min(cnt * 20, 40)
            reasons.append(term)

    return min(int(score), 100), list(dict.fromkeys(reasons))  # 중복 제거


def build_results_from_promises(items: list, keyword: str, sg_type_label: str) -> list:
    """Tier 1 선거공약 응답 → 결과 행 리스트"""
    rows = []
    for item in items:
        name    = item.get("cnddtNm", "")
        party   = item.get("jdName", "")
        promise = item.get("prmsOrgzCn", "") or ""
        region  = item.get("sdName", "")
        sgg     = item.get("sggName", "")
        if not name:
            continue
        match_pct, reasons = calc_match(promise, keyword)
        rows.append({
            "후보명":   name,
            "정당":     party,
            "지역":     f"{region} {sgg}".strip(),
            "선거유형": sg_type_label,
            "매칭도":   match_pct,
            "매칭근거": ", ".join(reasons) if reasons else "없음",
            "출처":     "선거공약",
            "원문":     promise,
        })
    return rows


def build_results_from_party_policy(
    policy_items: list,
    candidates_df: pd.DataFrame,
    keyword: str,
    sg_type_label: str,
) -> list:
    """
    Tier 2 정당정책 응답 → 후보자 매핑 후 결과 행 리스트
    정당 정책을 같은 정당 후보자에게 매핑하는 방식
    """
    # 정당 → 정책 텍스트 dict 구성
    party_policy_map = {}
    for item in policy_items:
        party   = item.get("jdName", "")
        content = (item.get("prmsOrgzCn", "") or
                   item.get("prmsTitl", "")  or "")
        if party:
            party_policy_map[party] = party_policy_map.get(party, "") + " " + content

    if candidates_df.empty or not party_policy_map:
        return []

    rows = []
    for _, cand in candidates_df.iterrows():
        party   = str(cand.get("party", "") or "")
        name    = str(cand.get("name", ""))
        region  = f"{cand.get('sd_name','')} {cand.get('sgg_name','')}".strip()

        # 정당명 부분 매칭 (예: "더불어민주당" ↔ "민주당")
        policy_text = ""
        for pol_party, pol_text in party_policy_map.items():
            if pol_party in party or party in pol_party:
                policy_text = pol_text
                break

        if not policy_text:
            continue

        match_pct, reasons = calc_match(policy_text, keyword)
        if match_pct == 0:
            continue

        rows.append({
            "후보명":   name,
            "정당":     party,
            "지역":     region,
            "선거유형": sg_type_label,
            "매칭도":   match_pct,
            "매칭근거": ", ".join(reasons) if reasons else "없음",
            "출처":     "정당정책",
            "원문":     policy_text.strip()[:500],  # 500자 제한
        })
    return rows


def build_results_from_csv(
    candidates_df: pd.DataFrame,
    keyword: str,
    sg_type_label: str,
) -> list:
    """Tier 3 CSV 경력 데이터 폴백"""
    rows = []
    for _, cand in candidates_df.iterrows():
        career1   = str(cand.get("career1", "") or "")
        career2   = str(cand.get("career2", "") or "")
        education = str(cand.get("education", "") or "")
        full_text = f"{career1} {career2} {education}"
        match_pct, reasons = calc_match(full_text, keyword)
        rows.append({
            "후보명":   cand["name"],
            "정당":     cand.get("party", ""),
            "지역":     f"{cand.get('sd_name','')} {cand.get('sgg_name','')}".strip(),
            "선거유형": cand.get("sg_type_label", ""),
            "매칭도":   match_pct,
            "매칭근거": ", ".join(reasons) if reasons else "없음",
            "출처":     "경력(CSV)",
            "원문":     f"[경력1] {career1}\n[경력2] {career2}",
        })
    return rows


# =============================================================================
# 챗봇 결과 카드 렌더링 헬퍼
# =============================================================================

def _render_result_cards(df: pd.DataFrame, source: str):
    if df is None or df.empty:
        return
    src_color   = {"선거공약": "#22c55e", "정당정책": "#3b82f6", "경력": "#94a3b8"}
    badge_color = next((v for k, v in src_color.items() if k in source), "#94a3b8")
    st.markdown(
        f"<span style='background:{badge_color};color:white;padding:2px 10px;"
        f"border-radius:20px;font-size:12px'>출처: {source}</span>",
        unsafe_allow_html=True,
    )
    st.write("")
    top3 = df.head(3)
    cols = st.columns(len(top3))
    for i, (_, row) in enumerate(top3.iterrows()):
        score = row["매칭도"]
        color = "#22c55e" if score >= 60 else "#f59e0b" if score >= 30 else "#94a3b8"
        ai_txt = str(row.get("ai_explain", "") or "")
        ai_block = (
            f"<div style='font-size:12px;color:#1d4ed8;margin-top:6px;font-style:italic'>"
            f"🤖 {ai_txt}</div>"
        ) if ai_txt else ""
        with cols[i]:
            st.markdown(f"""
<div style='border:3px solid {color};padding:14px;border-radius:10px;
text-align:center;margin-bottom:8px'>
    <div style='font-size:16px;font-weight:900'>{row["후보명"]}</div>
    <div style='color:#555;font-size:13px'>{row["정당"]}</div>
    <div style='font-size:38px;font-weight:900;color:{color};line-height:1.1'>{score}%</div>
    <div style='font-size:11px;color:#888'>{row["지역"]} | {row["선거유형"]}</div>
    <div style='font-size:12px;color:#555;margin-top:4px'>📌 {row["매칭근거"]}</div>
    {ai_block}
</div>""", unsafe_allow_html=True)
    with st.expander(f"📋 전체 매칭 결과 {len(df)}명 보기"):
        show_cols = ["후보명", "정당", "지역", "선거유형", "매칭도", "매칭근거"]
        st.dataframe(df[[c for c in show_cols if c in df.columns]],
                     use_container_width=True, hide_index=True)
    with st.expander("📄 원문 보기 (실제 데이터만 — 할루시네이션 없음)"):
        for i, (_, row) in enumerate(df.head(5).iterrows()):
            score = row["매칭도"]
            color = "#22c55e" if score >= 60 else "#f59e0b" if score >= 30 else "#94a3b8"
            st.markdown(
                f"<span style='color:{color};font-weight:700'>#{i+1} {row['후보명']} "
                f"({row['정당']}) — {score}%</span>", unsafe_allow_html=True)
            원문 = row.get("원문", "")
            if 원문 and 원문.strip():
                st.text_area("", value=원문, height=100,
                             key=f"orig_{id(df)}_{i}", disabled=True)
            st.markdown("---")


# =============================================================================
# 탭 정의
# =============================================================================
tab1, tab2, tab3, tab4 = st.tabs([
    "📍 선거구 안내", "🗳️ 내 투표 가이드", "💬 공약 키워드 챗봇", "📊 통계"
])


# ── TAB 1 ─────────────────────────────────────────────────────────────────────
with tab1:
    st.subheader("📍 내 동네 선거 후보자")
    st.info("주소를 입력하면 해당 지역 선거 후보자를 선거 종류별로 보여줍니다.")
    col1, col2 = st.columns([4, 1])
    with col1:
        addr1 = st.text_input("주소 입력", placeholder="예: 대구 달서구", key="addr1")
    with col2:
        btn1 = st.button("🔍 검색", key="btn1", use_container_width=True)
    if btn1 and addr1.strip():
        with st.spinner("검색 중..."):
            st.session_state.addr_result = get_candidates_by_address(addr1)
    if st.session_state.addr_result:
        r = st.session_state.addr_result
        st.success(r["message"])
        etypes = [k for k, df in r["elections"].items() if not df.empty]
        if etypes:
            subtabs = st.tabs(etypes)
            for stab, et in zip(subtabs, etypes):
                with stab:
                    df   = r["elections"][et]
                    show = df[["name", "party", "sgg_name"]].rename(
                        columns={"name": "후보명", "party": "정당", "sgg_name": "구/군"})
                    st.dataframe(show, use_container_width=True, hide_index=True)
                    with st.expander("상세 경력 보기"):
                        for _, row in df.iterrows():
                            st.markdown(
                                f"**{row['name']}** ({row['party']})\n\n"
                                f"- 경력1: {str(row.get('career1',''))[:100]}\n"
                                f"- 경력2: {str(row.get('career2',''))[:100]}\n---"
                            )


# ── TAB 2 ─────────────────────────────────────────────────────────────────────
with tab2:
    st.subheader("🗳️ 내 투표 가이드")
    st.info("주소를 입력하면 몇 장 투표하는지, 어떤 선거인지 알려드립니다.")
    col1, col2 = st.columns([4, 1])
    with col1:
        addr2 = st.text_input("주소 입력", placeholder="예: 대구 달서구", key="addr2")
    with col2:
        btn2 = st.button("📋 확인", key="btn2", use_container_width=True)
    if btn2 and addr2.strip():
        with st.spinner("분석 중..."):
            st.session_state.vote_guide = get_candidates_by_address(addr2)
    if st.session_state.vote_guide:
        r         = st.session_state.vote_guide
        elections = r["elections"]
        vote_info, total_votes = [], 0
        for et, desc in [
            ("광역단체장",   "시장·도지사 선출"),
            ("교육감",      "교육감 선출"),
            ("기초단체장",   "구청장·군수 선출"),
            ("광역의회의원", "시·도의원 선출 (지역구)"),
            ("기초의회의원", "구·군의원 선출 (지역구)"),
        ]:
            df = elections.get(et, pd.DataFrame())
            if not df.empty:
                vote_info.append({"선거 종류": et, "설명": desc, "투표 장수": 1, "후보 수": f"{len(df)}명"})
                total_votes += 1
        vote_info.append({"선거 종류": "광역의회 비례대표", "설명": "정당 투표", "투표 장수": 1, "후보 수": "-"})
        vote_info.append({"선거 종류": "기초의회 비례대표", "설명": "정당 투표", "투표 장수": 1, "후보 수": "-"})
        total_votes += 2
        st.markdown(f"""
<div style='background:#1a365d;color:white;padding:24px;border-radius:12px;text-align:center;margin:12px 0'>
    <h3 style='margin:0'>📮 {r['sd_name']} 유권자</h3>
    <div style='font-size:72px;font-weight:900;margin:8px 0'>총 {total_votes}표</div>
    <p style='margin:0'>2026년 6월 3일 지방선거에서 행사하는 표 수</p>
</div>""", unsafe_allow_html=True)
        st.dataframe(pd.DataFrame(vote_info), use_container_width=True, hide_index=True)
        st.markdown("### 🎒 투표 준비물")
        c1, c2, c3 = st.columns(3)
        c1.success("✅ **신분증**\n주민등록증·운전면허증·여권")
        c2.info("📍 **투표소 확인**\n선관위 문자 or 홈페이지")
        c3.warning("⏰ **투표 시간**\n오전 6시 ~ 오후 6시")
        st.markdown("### 📖 선거구 용어 설명")
        st.markdown("""
| 용어 | 설명 |
|---|---|
| **광역단체장** | 시장·도지사 (예: 대구시장) |
| **기초단체장** | 구청장·군수 (예: 달서구청장) |
| **광역의회의원** | 시·도의원 (지역구 + 비례) |
| **기초의회의원** | 구·군의원 (지역구 + 비례) |
| **교육감** | 시·도 교육청 수장 |
| **갑·을·병구** | 인구수에 따라 나눈 선거구 번호 |
| **제N선거구** | 기초의회에서 사용하는 선거구 명칭 |
""")


# ── TAB 3 : 챗봇 UI ───────────────────────────────────────────────────────────
with tab3:

    if "chat_history"  not in st.session_state: st.session_state.chat_history  = []
    if "chat_sg_type"  not in st.session_state: st.session_state.chat_sg_type  = "광역단체장"
    if "chat_region"   not in st.session_state: st.session_state.chat_region   = ""

    st.subheader("💬 공약 키워드 챗봇")

    # ── 설정 바 (주소 + 선거종류만, 초기화 버튼 없음) ─────────────────────────
    col_addr, col_sg = st.columns([3, 2])
    with col_addr:
        chat_addr = st.text_input(
            "내 주소",
            placeholder="예: 대구 달서구",
            key="chat_addr",
            value=st.session_state.chat_region,
        )
        if chat_addr.strip():
            st.session_state.chat_region = chat_addr.strip()
    with col_sg:
        st.session_state.chat_sg_type = st.selectbox(
            "선거 종류", list(SG_TYPE_MAP.keys()), key="chat_sg_select"
        )

    st.caption("💡 예시 키워드: **창업** | **실버산업** | **교육** | **AI** | **청년취업** | **환경**")
    st.divider()

    # ── 대화 히스토리 출력 ─────────────────────────────────────────────────────
    if not st.session_state.chat_history:
        with st.chat_message("assistant"):
            st.markdown(
                "안녕하세요! **2026 지방선거 공약 키워드 매칭 챗봇**입니다 🗳️\n\n"
                "① 위에서 **주소**와 **선거 종류**를 먼저 선택하세요.\n\n"
                "② 관심 키워드를 입력하면 해당 지역 후보자를 실제 데이터 근거와 함께 알려드립니다.\n\n"
                "**할루시네이션 없이 원문 데이터만 사용합니다.**"
            )

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"], unsafe_allow_html=True)
            if msg.get("result_df") is not None:
                _render_result_cards(msg["result_df"], msg.get("source", ""))

    # ── 입력창 ────────────────────────────────────────────────────────────────
    user_input = st.chat_input("키워드를 입력하세요 (예: 창업, 실버산업, 교육...)")

    if user_input:
        keyword     = user_input.strip()
        sg_type     = st.session_state.chat_sg_type
        sg_typecode = SG_TYPE_MAP[sg_type]
        region_addr = st.session_state.chat_region

        # 주소 없으면 경고 후 중단
        if not region_addr:
            with st.chat_message("assistant"):
                st.warning("📍 주소를 먼저 입력해주세요! (예: 대구 달서구)")
            st.stop()

        # ── 수정: inline import 제거 → 파일 상단에서 이미 import 완료 ──────
        sd_name  = _parse_sd_name(region_addr)
        sgg_name = _parse_sgg_name(region_addr)  # 로컬 함수 사용

        # 사용자 메시지
        st.session_state.chat_history.append({"role": "user", "content": keyword})
        with st.chat_message("user"):
            st.markdown(keyword)

        with st.chat_message("assistant"):
            status = st.empty()

            # Tier 1
            status.info("📡 선거공약 API 조회 중...")
            promise_items = fetch_promises(sg_typecode)
            time.sleep(0.2)

            result_rows = []
            source_used = ""

            if promise_items:
                result_rows = build_results_from_promises(promise_items, keyword, sg_type)
                # 지역 필터
                result_rows = [r for r in result_rows if sd_name in r.get("지역","")]
                source_used = "선거공약 API"
            else:
                # Tier 2
                status.info("📡 정당정책 API 조회 중...")
                policy_items = fetch_party_policy(sg_typecode)
                time.sleep(0.2)

                if policy_items:
                    cdf = load_candidates(region=sd_name, sg_type=sg_type)
                    # 기초 선거는 sgg 필터 추가
                    if sgg_name and sg_type in ["기초단체장", "광역의회의원", "기초의회의원"]:
                        cdf = cdf[cdf["sgg_name"].fillna("").str.contains(sgg_name, regex=False)]
                    result_rows = build_results_from_party_policy(policy_items, cdf, keyword, sg_type)
                    source_used = "정당정책 API"
                else:
                    # Tier 3
                    status.info("📁 경력 데이터 분석 중...")
                    cdf = load_candidates(region=sd_name, sg_type=sg_type)
                    if sgg_name and sg_type in ["기초단체장", "광역의회의원", "기초의회의원"]:
                        cdf = cdf[cdf["sgg_name"].fillna("").str.contains(sgg_name, regex=False)]
                    result_rows = build_results_from_csv(cdf, keyword, sg_type)
                    source_used = "경력 데이터(CSV)"

            status.empty()

            # 결과 정제 — 매칭도 내림차순, 0%여도 전원 표시
            result_df = pd.DataFrame(result_rows)
            if not result_df.empty:
                result_df = result_df.sort_values("매칭도", ascending=False).reset_index(drop=True)

            # Gemini 근거 설명 (TOP 3만, API 없으면 자동 스킵)
            if not result_df.empty:
                status.info("🤖 Gemini 매칭 근거 분석 중...")
                result_df = explain_top_candidates(result_df, keyword, top_n=3)
                status.empty()

            region_label = f"{sd_name} {sgg_name}".strip() if sgg_name else sd_name

            if result_df.empty:
                bot_text = (
                    f"**'{keyword}'** 관련 {region_label} {sg_type} 후보를 찾지 못했습니다.\n\n"
                    "다른 키워드를 시도해보세요."
                )
                st.markdown(bot_text)
                st.session_state.chat_history.append({
                    "role": "assistant", "content": bot_text,
                    "result_df": None, "source": source_used,
                })
            else:
                top1      = result_df.iloc[0]
                has_match = top1["매칭도"] > 0
                if has_match:
                    match_line = (
                        f"🥇 **1위: {top1['후보명']}** ({top1['정당']}) "
                        f"— 매칭도 **{top1['매칭도']}%** | 근거: {top1['매칭근거']}"
                    )
                else:
                    match_line = (
                        f"⚠️ 경력 데이터에 **'{keyword}'** 관련 키워드가 없습니다. "
                        "전체 후보 목록을 보여드립니다."
                    )

                bot_text = (
                    f"**'{keyword}'** 키워드로 **{region_label} {sg_type}** 후보를 분석했습니다.\n\n"
                    f"📊 출처: `{source_used}` | 총 **{len(result_df)}명**\n\n"
                    f"{match_line}"
                )
                st.markdown(bot_text)
                _render_result_cards(result_df, source_used)
                st.session_state.chat_history.append({
                    "role": "assistant", "content": bot_text,
                    "result_df": result_df, "source": source_used,
                })


# ── TAB 4 ─────────────────────────────────────────────────────────────────────
with tab4:
    st.subheader("📊 2026 선거 통계")
    all_df = load_candidates()
    if not all_df.empty:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("전체 후보", f"{len(all_df):,}명")
        c2.metric("등록 후보", f"{len(all_df[all_df['reg_status']=='등록']):,}명")
        c3.metric("참여 정당", f"{all_df['party'].nunique()}개")
        c4.metric("시도 수",   f"{all_df['sd_name'].nunique()}개")
        st.divider()
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**정당별 후보 수 (TOP 10)**")
            st.bar_chart(all_df["party"].value_counts().head(10))
        with col2:
            st.markdown("**선거 종류별 후보 수**")
            st.bar_chart(all_df["sg_type_label"].value_counts())

st.divider()
st.caption("PolyElection 2026 | KDT 12기 | 데이터: 중앙선거관리위원회 · 공공데이터포털")