# backend/app/collectors/naver_news.py
import sys
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))

if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

from dotenv import load_dotenv
env_path = os.path.join(BACKEND_DIR, ".env")
load_dotenv(dotenv_path=env_path)

import re
import html
import time
import requests
import trafilatura
from datetime import datetime
from email.utils import parsedate_to_datetime

NAVER_URL = "https://openapi.naver.com/v1/search/news.json"

CANDIDATE_KEYWORDS = {
    "서울": [
        "정원오 서울시장", "오세훈 서울시장", "김형남 서울시장",
        "박홍근 서울시장", "서영교 서울시장", "한동훈 서울시장", "안철수 서울시장",
        "2026 서울시장 선거", "서울시장 여론조사", "서울시장 공천",
    ],
    "경기": [
        "추미애 경기도지사", "유승민 경기도지사", "김동연 경기도지사", "권칠승 경기도지사",
        "2026 경기도지사 선거", "경기도지사 여론조사", "경기도지사 공천",
    ],
    "인천": [
        "박찬대 인천시장", "유정복 인천시장",
        "2026 인천시장 선거", "인천시장 여론조사",
    ],
    "대전": [
        "허태정 대전시장", "이장우 대전시장",
        "2026 대전시장 선거", "대전시장 여론조사",
    ],
    "세종": [
        "최민호 세종시장", "이춘희 세종시장",
        "2026 세종시장 선거", "세종시장 여론조사",
    ],
    "충북": [
        "신용한 충북도지사", "김영환 충북도지사", "이시종 충북도지사",
        "2026 충북도지사 선거", "충북도지사 여론조사",
    ],
    "충남": [
        "박수현 충남도지사", "김태흠 충남도지사",
        "2026 충남도지사 선거", "충남도지사 여론조사",
    ],
    "전남광주": [
        "민형배 전남광주시장", "이정현 전남광주시장", "강기정 광주시장", "김영록 전남도지사",
        "2026 전남광주통합특별시", "광주전남 통합 선거", "전남광주시장 여론조사",
    ],
    "전북": [
        "오지성 전북도지사", "김관영 전북도지사",
        "2026 전북도지사 선거", "전북도지사 여론조사",
    ],
    "대구": [
        "추경호 대구시장", "김부겸 대구시장", "홍준표 대구시장",
        "2026 대구시장 선거", "대구시장 여론조사",
    ],
    "경북": [
        "이철우 경북도지사", "임미애 경북도지사",
        "2026 경북도지사 선거", "경북도지사 여론조사",
    ],
    "부산": [
        "천제수 부산시장", "박형준 부산시장", "김희정 부산시장", "전재수 부산시장",
        "2026 부산시장 선거", "부산시장 여론조사", "부산시장 공천",
    ],
    "울산": [
        "김두겸 울산시장", "이상헌 울산시장", "서범수 울산시장",
        "2026 울산시장 선거", "울산시장 여론조사", "울산시장 단일화",
    ],
    "경남": [
        "박완수 경남도지사", "김경수 경남도지사",
        "2026 경남도지사 선거", "경남도지사 여론조사",
    ],
    "강원": [
        "우상호 강원도지사", "김진태 강원도지사",
        "2026 강원도지사 선거", "강원도지사 여론조사",
    ],
    "제주": [
        "오영훈 제주도지사", "허향진 제주도지사",
        "2026 제주도지사 선거", "제주도지사 여론조사",
    ],
}

ASSEMBLY_KEYWORDS = {
    "경기_보궐": ["서재열 평택을 보궐", "2026 경기 보궐선거", "평택시을 보궐선거"],
    "인천_보궐": ["김남준 계양구을 보궐", "2026 인천 보궐선거", "계양구을 보궐선거"],
    "충남_보궐": ["이윤석 아산시을 보궐", "2026 충남 보궐선거", "아산시을 보궐선거"],
    "전북_보궐": ["오지성 군산김제부안 보궐", "2026 전북 보궐선거", "군산김제부안 보궐선거"],
}

COMMON_KEYWORDS = [
    "2026 지방선거", "6.3 지방선거", "제9회 지방선거",
    "2026 지방선거 여론조사", "2026 지방선거 공천", "2026 지방선거 대진표",
    "민주당 지방선거", "국민의힘 지방선거", "조국혁신당 지방선거",
    "지방선거 단일화", "지방선거 경선", "지방선거 판세",
    "2026 재보궐선거", "6.3 국회의원 보궐",
]

ISSUE_KEYWORDS = [
    "지방선거 개헌", "지방선거 전남광주통합", "민주당 지방선거 공천",
    "국민의힘 지방선거 공천", "지방선거 이재명",
]

NON_CANDIDATE_WORDS = {
    "2026", "지방선거", "6.3", "제9회", "재보궐선거", "보궐선거",
    "민주당", "국민의힘", "더불어민주당", "조국혁신당", "진보당", "개혁신당",
    "여론조사", "공천", "대진표", "경선", "단일화", "판세",
    "국회의원", "시장", "도지사", "교육감", "구청장",
}


def clean_text(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"<.*?>", "", text)
    return text.strip()


def extract_article_text(url: str) -> str:
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded is None:
            return ""
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        return text.strip() if text else ""
    except Exception:
        return ""


def _extract_candidate_from_query(query: str) -> str:
    words = query.split()
    if not words:
        return ""
    first = words[0]
    if first in NON_CANDIDATE_WORDS:
        return ""
    if first[0].isdigit():
        return ""
    if len(words) >= 2:
        return first
    return ""


def search_naver_news(query: str, display: int = 100, sort: str = "date") -> list[dict]:
    """
    네이버 뉴스 API 검색. 최대한 많은 데이터를 위해 기본 display를 100으로 설정.
    """
    client_id     = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("[네이버 뉴스] .env에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 없음")
        return []

    headers = {
        "X-Naver-Client-Id":     client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    params = {"query": query, "display": display, "start": 1, "sort": sort}

    try:
        res = requests.get(NAVER_URL, headers=headers, params=params, timeout=10)
    except Exception as e:
        print(f"[네이버 뉴스] 요청 오류: {e}")
        return []

    if res.status_code != 200:
        print(f"[네이버 뉴스] API 오류: {res.status_code}")
        return []

    result = []
    for item in res.json().get("items", []):
        title = clean_text(item.get("title", ""))
        desc  = clean_text(item.get("description", ""))

        pub_date_str = item.get("pubDate", "")
        try:
            pub_date = parsedate_to_datetime(pub_date_str)
        except Exception:
            pub_date = datetime.now()

        naver_link    = item.get("link", "")
        original_link = item.get("originallink", "") or naver_link

        result.append({
            "title":         title,
            "description":   desc,
            "naver_link":    naver_link,
            "original_link": original_link,
            "pub_date":      pub_date,
            "query":         query,
        })

    return result


def fetch_election_news(extract_body: bool = True) -> list[dict]:
    """
    extract_body=True 설정으로 원본 URL에 접속해 본문을 긁어옴.
    """
    all_news  = []
    seen_urls = set()

    def _process_items(items, region, category):
        for item in items:
            url = item["original_link"] or item["naver_link"]
            if url in seen_urls:
                continue
            seen_urls.add(url)

            # 본문 추출 로직 실행
            if extract_body:
                body = extract_article_text(url)
                item["body"] = body if body else item["description"]
            else:
                item["body"] = item["description"]

            item["region"]   = region
            item["category"] = category
            all_news.append(item)

    # API 최대치인 100건을 가져와 최대한 많은 데이터를 확보
    for region, keywords in CANDIDATE_KEYWORDS.items():
        for keyword in keywords:
            items = search_naver_news(keyword, display=100)
            _process_items(items, region, "광역단체장")
            time.sleep(0.3)

    for region, keywords in ASSEMBLY_KEYWORDS.items():
        for keyword in keywords:
            items = search_naver_news(keyword, display=100)
            _process_items(items, region, "국회의원보궐")
            time.sleep(0.3)

    for keyword in COMMON_KEYWORDS + ISSUE_KEYWORDS:
        items = search_naver_news(keyword, display=100)
        _process_items(items, "전국", "공통이슈")
        time.sleep(0.3)

    print(f"[뉴스 수집 완료] 총 {len(all_news)}건의 유니크한 기사 확보됨.")
    return all_news


def save_news_to_db(news_list: list[dict]):
    from app.database import SessionLocal
    from app.models import NewsSentiment

    db       = SessionLocal()
    inserted = 0
    skipped  = 0

    try:
        for news in news_list:
            title_truncated = news["title"][:500]

            # 중복 검사 (URL 기준)
            url_to_save = news.get("original_link", "")
            existing = (
                db.query(NewsSentiment)
                .filter(NewsSentiment.url == url_to_save)
                .first()
            )
            if existing:
                skipped += 1
                continue

            candidate = _extract_candidate_from_query(news.get("query", ""))

            # 👇 [핵심 수정] 본문 내용 길이 제한 (5,000자)
            # 5,000자가 넘으면 자르고, 뒤에 "..."을 붙여 잘렸음을 표시하네.
            raw_body = news.get("body", "")
            if len(raw_body) > 5000:
                final_content = raw_body[:4997] + "..."
            else:
                final_content = raw_body

            db.add(NewsSentiment(
                candidate       = candidate,
                region          = news.get("region", ""),
                category        = news.get("category", ""),
                title           = title_truncated,
                url             = url_to_save,
                content         = final_content,  # [수정] 5,000자 제한된 본문 저장
                pub_date        = news.get("pub_date"),
                query_keyword   = news.get("query", ""),
                sentiment       = None,
                sentiment_score = None,
                summary_3line   = None,
                analyzed_at     = None,
                importance      = None,
                one_line        = None
            ))
            inserted += 1

        db.commit()
        print(f"DB 저장 완료 — 신규 추가: {inserted}건 / 중복 스킵: {skipped}건")

    except Exception as e:
        db.rollback()
        print(f"[DB 오류] {e}")
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────
# 직접 실행용 (터미널에서 실행할 때만 작동)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("===========================================")
    print("📰 네이버 뉴스 & 본문 딥다이브 수집기 가동 시작")
    print("===========================================")

    client_id     = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("🚨 [경고] .env 파일에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 가 설정되어 있지 않습니다!")
        sys.exit(1)

    # 1. 전체 뉴스 수집 (본문 추출 옵션 강제 켜기)
    print("수집을 시작합니다. 본문을 긁어오기 때문에 시간이 약간 소요될 수 있습니다...")
    news_data = fetch_election_news(extract_body=True)

    # 2. DB 저장
    if news_data:
        print(f"\n데이터베이스 저장을 시작합니다... (가져온 총 기사: {len(news_data)}건)")
        save_news_to_db(news_data)
    else:
        print("\n수집된 뉴스 데이터가 없습니다. (API 키 또는 네트워크 상태 확인 필요)")