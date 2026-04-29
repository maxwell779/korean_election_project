# backend/app/collectors/polymarket.py
# 파일 최상단에 추가할 코드 (naver_news.py, nec.py, polymarket.py 공통)
import sys
import os

# 1. backend 루트 폴더를 파이썬 경로(sys.path)에 강제 추가
# (현재 파일 위치에서 두 단계 위인 'backend' 폴더를 가리킴)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))

if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

# 2. .env 파일 절대 경로 지정
from dotenv import load_dotenv
env_path = os.path.join(BACKEND_DIR, ".env")
load_dotenv(dotenv_path=env_path)


import requests
import json
from datetime import datetime

GAMMA_API = "https://gamma-api.polymarket.com"

# ── 한국 선거 마켓 슬러그 목록 (요청하신 최신 URL 슬러그 완벽 반영)
KOREA_MARKET_SLUGS = {
    "서울":     "2026-seoul-mayoral-election-winner",
    "부산":     "2026-busan-mayoral-election-winner",
    "경기":     "2026-gyeonggi-province-gubernatorial-election-winner",
    "충북":     "chungcheongbuk-province-governor-election-winner",
    "충남":     "chungcheongnam-province-governor-election-winner",
    "강원":     "gangwon-province-governor-election-winner",  # [수정 완료]
    "전남광주": "jeonnamgwangju-mayoral-election-winner",     # [수정 완료]
    "대전":     "daejeon-mayoral-election-winner",            # [수정 완료]
    "대구":     "daegu-mayoral-election-winner",
    "인천":     "incheon-mayoral-election-winner",
    "세종":     "sejong-mayoral-election-winner",
    "울산":     "ulsan-mayoral-election-winner",
    "지방선거": "2026-south-korean-local-elections-party-winner",
}

# ── [수정] 폴리마켓 영문명 → 선관위 한글명 매핑 (업로드 이미지 전수 조사 완벽 반영)
# get_region_analysis(), regions.py 에서 정당/후보자 조회 시 사용
EN_TO_KO = {
    # 정당 (지방선거 통합 마켓 대응)
    "People Power Party":     "국민의힘",
    "Democratic Party":       "더불어민주당",
    "Rebuilding Korea Party": "조국혁신당",

    # 서울
    "Chong Won-oh":       "정원오",
    "Oh Se-hoon":         "오세훈",
    "Park Hong-keun":     "박홍근",
    "Han Dong-hoon":      "한동훈",
    "Ahn Cheol-soo":      "안철수",
    "Seo Young-kyo":      "서영교",
    "Kim Hyung-nam":      "김형남",
    "Na Kyung-won":       "나경원",
    "Choi Jae-hyung":     "최재형",
    "Jo Eun-hee":         "조은희",

    # 부산
    "Park Hyung-jun":     "박형준",
    "Kim Hee-jeong":      "김희정",
    "Chun Je-su":         "전재수", # 폴리마켓 오타 대응
    "Jeon Jae-su":        "전재수",
    "Seo Eun-sook":       "서은숙",
    "Choi In-ho":         "최인호",
    "Kim Do-eup":         "김도읍",
    "Cho Kyoung-tae":     "조경태",

    # 대구
    "Hong Joon-pyo":      "홍준표",
    "Kim Boo-kyum":       "김부겸",
    "Choo Kyung-ho":      "추경호",
    "Woo Dong-gi":        "우동기",
    "Kang Dae-sik":       "강대식",
    "Kim Seung-su":       "김승수",
    "Kim Sang-hoon":      "김상훈",

    # 인천
    "Yoo Jeong-bok":      "유정복",
    "Park Chan-dae":      "박찬대",
    "Lee Hak-jae":        "이학재",
    "Kim Kyo-heung":      "김교흥",
    "Bae Jun-young":      "배준영",
    "Maeng Seong-kyu":    "맹성규",

    # 경기
    "Kim Dong-yeon":      "김동연",
    "Yoo Seung-min":      "유승민",
    "Choo Mi-ae":         "추미애",
    "Kwon Chil-seung":    "권칠승",
    "Kim Eun-hye":        "김은혜",
    "Jun Hae-cheol":      "전해철",
    "Kim Sung-won":       "김성원",
    "Song Ok-joo":        "송옥주",

    # 강원
    "Kim Jin-tae":        "김진태",
    "Woo Sang-ho":        "우상호",
    "Kweon Seong-dong":   "권성동",
    "Lee Kwang-jae":      "이광재",
    "Han Ki-ho":          "한기호",
    "Heo Young":          "허영",

    # 충북 (이미지 반영 업데이트)
    "Kim Young-hwan":     "김영환",
    "Shin Yong-han":      "신용한",
    "Lee Jong-bae":       "이종배",
    "Noh Young-min":      "노영민",
    "Lee Kwang-hee":      "이광희",
    "Eom Tae-young":      "엄태영",
    "Park Ji-woo":        "박지우", # [추가]
    "Lee Yeon-hee":       "이연희", # [추가]

    # 충남
    "Kim Tae-heum":       "김태흠",
    "Park Su-hyun":       "박수현",
    "Kang Hoon-sik":      "강훈식",
    "Bok Ki-wang":        "복기왕",
    "Sung Il-jong":       "성일종",
    "Jang Dong-hyuk":     "장동혁",

    # 세종
    "Choi Min-ho":        "최민호",
    "Kang Jun-hyeon":     "강준현",
    "Lee Choon-hee":      "이춘희",
    "Kim Jong-min":       "김종민",

    # 대전
    "Huh Tae-jung":       "허태정",
    "Lee Jang-woo":       "이장우",

    # 울산
    "Kim Doo-gyeom":      "김두겸",
    "Song Cheol-ho":      "송철호",
    "Lee Chae-ik":        "이채익",
    "Park Seong-min":     "박성민",
    "Seo Dong-wook":      "서동욱",
    "Kim Tae-seon":       "김태선",
    "Yoon Jong-oh":       "윤종오",

    # 전남광주 통합
    "Kang Ki-jung":       "강기정",
    "Kim Yung-rok":       "김영록",
    "Min Hyung-bae":      "민형배",
    "Lee Jung-hyun":      "이정현",
    "Shin Jeong-hoon":    "신정훈",
    "Chun Jung-bae":      "천정배",
    "Yang Hyang-ja":      "양향자",
    "Song Gap-seok":      "송갑석",
    "Seo Sam-seok":       "서삼석",
}

# ── 역방향 매핑 (한글 → 영문) — 필요 시 참조용
KO_TO_EN = {v: k for k, v in EN_TO_KO.items()}


def get_korean_name(english_name: str) -> str:
    """영문 이름 → 한글 이름 변환. 매핑 없으면 영문 그대로 반환."""
    return EN_TO_KO.get(english_name, english_name)


def get_english_name(korean_name: str) -> str:
    """한글 이름 → 영문 이름 변환. 매핑 없으면 한글 그대로 반환."""
    return KO_TO_EN.get(korean_name, korean_name)


# ─────────────────────────────────────────────
# 단일 마켓 수집
# ─────────────────────────────────────────────
def fetch_market_price(region: str) -> list[dict]:
    """
    지역명으로 해당 선거 마켓의 후보자별 당선 확률을 반환.
    active=True 인 후보자만 필터링.
    """
    slug = KOREA_MARKET_SLUGS.get(region)
    if not slug:
        print(f"  [폴리마켓] 슬러그 없음: {region}")
        return []

    try:
        res  = requests.get(
            f"{GAMMA_API}/events",
            params={"slug": slug},
            timeout=10
        )
        data = res.json()
    except Exception as e:
        print(f"  [폴리마켓 오류] {region}: {e}")
        return []

    if not data:
        return []

    event      = data[0]
    markets    = event.get("markets", [])
    fetched_at = datetime.now()
    results    = []

    for market in markets:
        if not market.get("active", False):
            continue
        if market.get("closed", False):
            continue

        candidate_en = market.get("groupItemTitle", "")
        if not candidate_en or candidate_en.startswith("Candidate"):
            continue
        if candidate_en == "Other":
            continue

        # [수정] 한글명 변환
        candidate_ko = get_korean_name(candidate_en)

        last_trade = float(market.get("lastTradePrice", 0))
        try:
            outcome_prices = json.loads(market.get("outcomePrices", "[\"0\"]"))
            amm_prob = float(outcome_prices[0])
        except (ValueError, IndexError, json.JSONDecodeError):
            amm_prob = 0.0

        probability = last_trade if last_trade > 0 else amm_prob

        results.append({
            "region":           region,
            "candidate_en":     candidate_en,                # 영문 이름
            "candidate_ko":     candidate_ko,                # [수정] 한글 이름
            "market_id":        market.get("id", ""),
            "probability":      round(probability, 4),
            "probability_pct":  round(probability * 100, 2),
            "last_trade_price": last_trade,
            "amm_probability":  round(amm_prob, 4),
            "best_bid":         float(market.get("bestBid", 0)),
            "best_ask":         float(market.get("bestAsk", 0)),
            "volume_24h":       float(market.get("volume24hr", 0)),
            "volume_1wk":       float(market.get("volume1wk", 0)),
            "volume_total":     float(market.get("volumeNum", 0)),
            "liquidity":        float(market.get("liquidityNum", 0)),
            "price_change_1d":  float(market.get("oneDayPriceChange", 0)),
            "price_change_1w":  float(market.get("oneWeekPriceChange", 0)),
            "price_change_1m":  float(market.get("oneMonthPriceChange", 0)),
            "fetched_at":       fetched_at.isoformat(),
        })

    results.sort(key=lambda x: x["probability"], reverse=True)
    return results


# ─────────────────────────────────────────────
# 전국 전체 수집
# ─────────────────────────────────────────────
def fetch_all_korea_markets() -> list[dict]:
    """전국 한국 선거 마켓 수집. scheduler.py 에서 30분마다 호출."""
    print("\n[폴리마켓 수집 시작]")
    all_results = []

    for region in KOREA_MARKET_SLUGS:
        batch = fetch_market_price(region)
        all_results.extend(batch)
        print(f"  {region}: {len(batch)}명 수집")

    print(f"[폴리마켓 수집 완료] 총 {len(all_results)}명")
    return all_results


# ─────────────────────────────────────────────
# DB 저장 (기존 데이터 삭제 후 리셋)
# ─────────────────────────────────────────────
def save_market_prices_to_db(market_data: list[dict]):
    """수집된 확률 데이터를 market_prices 테이블에 저장 (초기화 후 삽입)"""
    from app.database import SessionLocal
    from app.models import MarketPrice

    db = SessionLocal()
    try:
        # 1. 기존 데이터 싹 지우기 (초기화)
        deleted_count = db.query(MarketPrice).delete()
        db.commit()
        print(f"\n[🧹 초기화] 기존 폴리마켓 데이터 {deleted_count}건을 삭제했습니다.")

        # 2. 방금 수집한 완벽한 새 데이터 밀어넣기
        for d in market_data:
            db.add(MarketPrice(
                region           = d["region"],
                candidate        = d["candidate_en"],   # 영문
                candidate_ko     = d["candidate_ko"],   # 한글
                market_id        = d.get("market_id", ""),
                probability      = d["probability"],
                last_trade_price = d.get("last_trade_price", 0),
                amm_probability  = d.get("amm_probability", 0),
                best_bid         = d.get("best_bid", 0),
                best_ask         = d.get("best_ask", 0),
                volume_24h       = d["volume_24h"],
                volume_1wk       = d.get("volume_1wk", 0),
                volume_total     = d.get("volume_total", 0),
                liquidity        = d.get("liquidity", 0),
                price_change_1d  = d.get("price_change_1d", 0),
                price_change_1w  = d.get("price_change_1w", 0),
                price_change_1m  = d.get("price_change_1m", 0),
                fetched_at       = datetime.fromisoformat(d["fetched_at"]),
            ))
        db.commit()
        print(f"[✅ 완료] 새로운 폴리마켓 데이터 DB 저장 완료: {len(market_data)}건")
    except Exception as e:
        db.rollback()
        print(f"\n[🚨 DB 오류] {e}")
    finally:
        db.close()


# ─────────────────────────────────────────────
# 테스트 및 직접 실행용 스위치
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("===========================================")
    print("📈 폴리마켓(Polymarket) 당선 확률 수집기 가동 시작")
    print("===========================================")
    
    # 1. 전국 단위로 폴리마켓 데이터 수집
    all_market_data = fetch_all_korea_markets()
    
    # 2. 수집된 데이터를 DB에 리셋 후 저장
    if all_market_data:
        print(f"\n데이터베이스 저장을 시작합니다... (총 {len(all_market_data)}건)")
        save_market_prices_to_db(all_market_data)
    else:
        print("\n수집된 폴리마켓 데이터가 없습니다. (API 슬러그 또는 네트워크 상태 확인 필요)")