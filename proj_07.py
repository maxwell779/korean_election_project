import os
import re
import html
import requests
import pandas as pd
import streamlit as st
import trafilatura
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="KDT 뉴스 본문 분석 대시보드",
    page_icon="📰",
    layout="wide"
)

# -----------------------------
# CSS
# -----------------------------
st.markdown("""
<style>
.block-container {
    padding-top: 5rem;
    padding-left: 3rem;
    padding-right: 3rem;
}

.card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 18px;
    margin-bottom: 12px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.news-title {
    font-size: 18px;
    font-weight: 900;
}

.news-desc {
    color: #475569;
    font-size: 15px;
    margin-top: 8px;
}

.news-meta {
    color: #94a3b8;
    font-size: 13px;
    margin-top: 6px;
}

.big-title {
    font-size: 34px;
    font-weight: 900;
}

.sub-text {
    color: #64748b;
    font-size: 16px;
}
</style>
""", unsafe_allow_html=True)

# -----------------------------
# Helper
# -----------------------------
def clean_text(text):
    text = html.unescape(text)
    text = re.sub(r"<.*?>", "", text)
    return text.strip()


def search_naver_news(query, display=10, sort="date"):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        st.error(".env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 입력하세요.")
        return pd.DataFrame()

    url = "https://openapi.naver.com/v1/search/news.json"

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret
    }

    params = {
        "query": query,
        "display": display,
        "start": 1,
        "sort": sort
    }

    response = requests.get(url, headers=headers, params=params, timeout=10)

    if response.status_code != 200:
        st.error(f"네이버 API 오류: {response.status_code}")
        st.code(response.text)
        return pd.DataFrame()

    data = response.json()

    rows = []
    for i, item in enumerate(data.get("items", []), start=1):
        title = clean_text(item.get("title", ""))
        desc = clean_text(item.get("description", ""))

        rows.append({
            "번호": i,
            "제목": title,
            "요약": desc,
            "네이버링크": item.get("link", ""),
            "원문링크": item.get("originallink", ""),
            "발행일": item.get("pubDate", "")
        })

    return pd.DataFrame(rows)


def extract_article_text(url):
    try:
        downloaded = trafilatura.fetch_url(url)

        if downloaded is None:
            return ""

        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=False
        )

        if text is None:
            return ""

        return text.strip()

    except Exception:
        return ""


# -----------------------------
# Main
# -----------------------------
st.markdown('<div class="big-title">📰 KDT 뉴스 본문 분석 대시보드</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-text">네이버 뉴스 검색 API로 기사를 불러오고, 선택한 기사 원문에서 Trafilatura로 본문만 추출합니다.</div>',
    unsafe_allow_html=True
)

st.divider()

tab1, tab2, tab3 = st.tabs([
    "🔎 뉴스 검색",
    "📄 본문 추출",
    "📊 데이터 보기"
])

# -----------------------------
# TAB 1
# -----------------------------
with tab1:
    st.subheader("뉴스 검색")

    col1, col2, col3 = st.columns([3, 1, 1])

    with col1:
        query = st.text_input(
            "검색어",
            value="2026 지방선거",
            placeholder="예: 2026 지방선거, 대구 지방선거, 선거 공천"
        )

    with col2:
        sort_option = st.selectbox(
            "정렬",
            options=["date", "sim"],
            format_func=lambda x: "최신순" if x == "date" else "관련도순"
        )

    with col3:
        display_count = st.selectbox(
            "기사 수",
            options=[10, 20, 30],
            index=0
        )

    if st.button("뉴스 불러오기", type="primary"):
        news_df = search_naver_news(
            query=query,
            display=display_count,
            sort=sort_option
        )

        st.session_state["news_df"] = news_df
        st.session_state["article_text"] = ""
        st.session_state["selected_article"] = None

    news_df = st.session_state.get("news_df", pd.DataFrame())

    if news_df.empty:
        st.info("검색어를 입력하고 뉴스 불러오기를 누르세요.")
    else:
        st.success(f"뉴스 {len(news_df)}개를 불러왔습니다.")

        for _, row in news_df.head(10).iterrows():
            st.markdown(f"""
            <div class="card">
                <div class="news-title">{row['번호']}. {row['제목']}</div>
                <div class="news-meta">{row['발행일']}</div>
                <div class="news-desc">{row['요약']}</div>
            </div>
            """, unsafe_allow_html=True)

# -----------------------------
# TAB 2
# -----------------------------
with tab2:
    st.subheader("선택 기사 본문 추출")

    news_df = st.session_state.get("news_df", pd.DataFrame())

    if news_df.empty:
        st.info("먼저 뉴스 검색 탭에서 뉴스를 불러오세요.")
    else:
        titles = news_df["번호"].astype(str) + ". " + news_df["제목"]

        selected_title = st.selectbox(
            "본문을 추출할 기사 선택",
            options=titles
        )

        selected_index = titles[titles == selected_title].index[0]
        selected_row = news_df.loc[selected_index]

        st.markdown("### 선택한 기사 정보")

        st.markdown(f"""
        <div class="card">
            <div class="news-title">{selected_row['제목']}</div>
            <div class="news-meta">{selected_row['발행일']}</div>
            <div class="news-desc">{selected_row['요약']}</div>
        </div>
        """, unsafe_allow_html=True)

        target_url = selected_row["원문링크"] or selected_row["네이버링크"]

        st.write("추출 대상 URL")
        st.code(target_url)

        if st.button("선택 기사 본문 추출하기", type="primary"):
            with st.spinner("Trafilatura로 기사 본문 추출 중..."):
                article_text = extract_article_text(target_url)

                if article_text:
                    st.session_state["article_text"] = article_text
                    st.session_state["selected_article"] = selected_row.to_dict()
                    st.success("본문 추출 성공")
                else:
                    fallback_text = selected_row["요약"]
                    st.session_state["article_text"] = fallback_text
                    st.session_state["selected_article"] = selected_row.to_dict()
                    st.warning("본문 추출 실패: 네이버 API 요약문을 대신 사용합니다.")

        article_text = st.session_state.get("article_text", "")

        if article_text:
            st.markdown("### 추출된 본문")

            st.text_area(
                "본문",
                article_text,
                height=500
            )

            c1, c2, c3 = st.columns(3)

            with c1:
                st.metric("본문 글자 수", f"{len(article_text):,}자")

            with c2:
                st.metric("본문 단어 수", f"{len(article_text.split()):,}개")

            with c3:
                st.metric("줄 수", f"{len(article_text.splitlines()):,}줄")

            txt_bytes = article_text.encode("utf-8-sig")

            st.download_button(
                "본문 TXT 다운로드",
                data=txt_bytes,
                file_name="article_text.txt",
                mime="text/plain"
            )

# -----------------------------
# TAB 3
# -----------------------------
with tab3:
    st.subheader("뉴스 데이터 보기")

    news_df = st.session_state.get("news_df", pd.DataFrame())

    if news_df.empty:
        st.info("먼저 뉴스 검색 탭에서 뉴스를 불러오세요.")
    else:
        st.dataframe(news_df, use_container_width=True, hide_index=True)

        csv = news_df.to_csv(index=False).encode("utf-8-sig")

        st.download_button(
            "뉴스 목록 CSV 다운로드",
            data=csv,
            file_name="naver_news_list.csv",
            mime="text/csv"
        )