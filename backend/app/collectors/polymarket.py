# backend/app/collectors/polymarket.py
 
import requests
import json
from datetime import datetime
 
GAMMA_API = "https://gamma-api.polymarket.com"
 
# ── 한국 선거 마켓 슬러그 목록
KOREA_MARKET_SLUGS = {
    "서울":     "2026-seoul-mayoral-election-winner",
    "부산":     "2026-busan-mayoral-election-winner",
    "경기":     "2026-south-korean-local-elections-party-winner",
    "충북":     "2026-chungcheongbuk-do-gubernatorial-election-winner",
    "충남":     "2026-chungcheongnam-do-gubernatorial-election-winner",
    "강원":     "2026-gangwon-do-gubernatorial-election-winner",
    "전남광주":  "2026-jeonnam-gwangju-mayoral-election-winner",
    "대전":     "2026-daejeon-mayoral-election-winner",
    "대구":     "2026-daegu-mayoral-election-winner",
}
 
# ── [수정] 폴리마켓 영문명 → 선관위 한글명 매핑
# get_region_analysis(), regions.py 에서 정당 조회 시 사용
EN_TO_KO = {
    # 서울
    "Chong Won-oh":       "정원오",
    "Oh Se-hoon":         "오세훈",
    "Park Hong-keun":     "박홍근",
    "Han Dong-hoon":      "한동훈",
    "Ahn Cheol-soo":      "안철수",
    "Seo Young-kyo":      "서영교",
    "Kim Hyung-nam":      "김형남",
    # 부산
    "Chun Je-su":         "천제수",
    "Park Hyung-jun":     "박형준",
    "Kim Hee-jeong":      "김희정",
    "Jeon Jae-su":        "전재수",
    # 대구
    "Choo Kyung-ho":      "추경호",
    "Kim Boo-kyum":       "김부겸",
    "Hong Joon-pyo":      "홍준표",
    "Woo Dong-gi":        "우동기",
    # 대전
    "Huh Tae-jung":       "허태정",
    "Lee Jang-woo":       "이장우",
    # 전남광주
    "Min Hyung-bae":      "민형배",
    "Lee Jung-hyun":      "이정현",
    "Kang Ki-jung":       "강기정",
    # 경기
    "Choo Mi-ae":         "추미애",
    "Yoo Seung-min":      "유승민",
    "Kim Dong-yeon":      "김동연",
    # 충북
    "Shin Yong-han":      "신용한",
    "Kim Young-hwan":     "김영환",
    # 충남
    "Park Su-hyun":       "박수현",
    "Kim Tae-heum":       "김태흠",
    # 강원
    "Woo Sang-ho":        "우상호",
    "Kim Jin-tae":        "김진태",
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
# DB 저장
# ─────────────────────────────────────────────
def save_market_prices_to_db(market_data: list[dict]):
    """수집된 확률 데이터를 market_prices 테이블에 저장"""
    from app.database import SessionLocal
    from app.models import MarketPrice
 
    db = SessionLocal()
    try:
        for d in market_data:
            db.add(MarketPrice(
                region           = d["region"],
                candidate        = d["candidate_en"],   # 영문 (기존 유지)
                candidate_ko     = d["candidate_ko"],   # [수정] 한글 추가
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
        print(f"DB 저장 완료: {len(market_data)}건")
    except Exception as e:
        db.rollback()
        print(f"[DB 오류] {e}")
    finally:
        db.close()
 
 
# ─────────────────────────────────────────────
# 테스트 실행
# ─────────────────────────────────────────────
if __name__ == "__main__":
    results = fetch_market_price("서울")
    print(f"\n=== 서울시장 선거 당선 확률 ===")
    for r in results:
        bar = "█" * int(r["probability_pct"] / 2)
        ko  = r["candidate_ko"]
        en  = r["candidate_en"]
        print(f"  {ko}({en}) {r['probability_pct']:5.1f}%  {bar}")