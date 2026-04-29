# backend/app/collectors/naver_news.py
 
import os
import re
import html
import time
import requests
import trafilatura
from datetime import datetime
from email.utils import parsedate_to_datetime
from dotenv import load_dotenv
 
load_dotenv()
 
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
 
# [수정] 후보자명이 아닌 단어 목록 — _extract_candidate_from_query 오작동 방지
NON_CANDIDATE_WORDS = {
    "2026", "지방선거", "6.3", "제9회", "재보궐선거", "보궐선거",
    "민주당", "국민의힘", "더불어민주당", "조국혁신당", "진보당", "개혁신당",
    "여론조사", "공천", "대진표", "경선", "단일화", "판세",
    "국회의원", "시장", "도지사", "교육감", "구청장",
}
 
 
# ─────────────────────────────────────────────
# 팀원 코드에서 가져온 핵심 함수
# ─────────────────────────────────────────────
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
 
 
# ─────────────────────────────────────────────
# 네이버 뉴스 API 호출
# ─────────────────────────────────────────────
def search_naver_news(query: str, display: int = 20, sort: str = "date") -> list[dict]:
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
 
 
# ─────────────────────────────────────────────
# 후보자 + 지역별 전체 뉴스 수집
# ─────────────────────────────────────────────
def fetch_election_news(extract_body: bool = False) -> list[dict]:
    """
    선거 관련 키워드 전체 순회하며 뉴스 수집.
    extract_body=True 이면 trafilatura로 본문까지 추출.
    """
    all_news  = []
    seen_urls = set()
 
    def _process_items(items, region, category):
        for item in items:
            url = item["original_link"] or item["naver_link"]
            if url in seen_urls:
                continue
            seen_urls.add(url)
 
            # [수정] extract_body 파라미터 실제로 동작하도록 수정
            if extract_body:
                body = extract_article_text(url)
                item["body"] = body if body else item["description"]
            else:
                item["body"] = item["description"]
 
            item["region"]   = region
            item["category"] = category
            all_news.append(item)
 
    # 1. 광역단체장 후보 키워드
    for region, keywords in CANDIDATE_KEYWORDS.items():
        for keyword in keywords:
            items = search_naver_news(keyword, display=20)
            _process_items(items, region, "광역단체장")
            time.sleep(0.3)
 
    # 2. 국회의원 보궐 키워드
    for region, keywords in ASSEMBLY_KEYWORDS.items():
        for keyword in keywords:
            items = search_naver_news(keyword, display=10)
            _process_items(items, region, "국회의원보궐")
            time.sleep(0.3)
 
    # 3. 공통 + 이슈 키워드
    for keyword in COMMON_KEYWORDS + ISSUE_KEYWORDS:
        items = search_naver_news(keyword, display=10)
        _process_items(items, "전국", "공통이슈")
        time.sleep(0.3)
 
    print(f"[뉴스 수집 완료] 총 {len(all_news)}건")
    return all_news
 
 
# ─────────────────────────────────────────────
# DB 저장
# ─────────────────────────────────────────────
def save_news_to_db(news_list: list[dict]):
    """
    수집된 뉴스를 news_sentiment 테이블에 저장.
    title 기준으로 중복 방지.
    """
    from app.database import SessionLocal
    from app.models import NewsSentiment
 
    db       = SessionLocal()
    inserted = 0
    skipped  = 0
 
    try:
        for news in news_list:
            title_truncated = news["title"][:500]
 
            existing = (
                db.query(NewsSentiment)
                .filter(NewsSentiment.title == title_truncated)
                .first()
            )
            if existing:
                skipped += 1
                continue
 
            candidate = _extract_candidate_from_query(news.get("query", ""))
 
            db.add(NewsSentiment(
                candidate     = candidate,
                region        = news.get("region", ""),
                category      = news.get("category", ""),       # [수정] 누락 필드
                title         = title_truncated,
                url           = news.get("original_link", ""),  # [수정] [:500] 제거
                pub_date      = news.get("pub_date"),
                query_keyword = news.get("query", ""),           # [수정] 누락 필드
                sentiment       = None,
                sentiment_score = None,
                summary_3line   = None,
                analyzed_at     = None,
            ))
            inserted += 1
 
        db.commit()
        print(f"DB 저장 완료 — 신규: {inserted}건 / 중복 스킵: {skipped}건")
 
    except Exception as e:
        db.rollback()
        print(f"[DB 오류] {e}")
        raise
    finally:
        db.close()
 
 
def _extract_candidate_from_query(query: str) -> str:
    """
    검색 키워드에서 후보자명 추출.
    예: "정원오 서울시장" → "정원오"
    예: "지방선거 단일화" → "" (오작동 방지)
    """
    words = query.split()
    if not words:
        return ""
 
    first = words[0]
 
    # [수정] 정당·이슈 단어면 후보자명 아님
    if first in NON_CANDIDATE_WORDS:
        return ""
 
    # 숫자로 시작하면 연도 (2026 등)
    if first[0].isdigit():
        return ""
 
    # 단어가 2개 이상일 때만 첫 단어를 후보자명으로 인정
    if len(words) >= 2:
        return first
 
    return ""
 
 
# ─────────────────────────────────────────────
# 테스트 실행
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("=== 단일 키워드 테스트 ===")
    items = search_naver_news("정원오 서울시장", display=5)
    for item in items:
        print(f"\n  제목: {item['title']}")
        print(f"  날짜: {item['pub_date']}")
        print(f"  URL : {item['original_link']}")
    print(f"\n총 {len(items)}건")
 
    print("\n=== _extract_candidate_from_query 테스트 ===")
    tests = [
        "정원오 서울시장",
        "지방선거 단일화",
        "민주당 지방선거 공천",
        "2026 서울시장 선거",
        "허태정 대전시장",
    ]
    for q in tests:
        result = _extract_candidate_from_query(q)
        print(f"  '{q}' → '{result}'")