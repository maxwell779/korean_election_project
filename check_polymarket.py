# check_korea_polymarket.py
import requests, json

GAMMA_API = "https://gamma-api.polymarket.com"

# 슬러그로 직접 조회
res  = requests.get(f"{GAMMA_API}/events",
                    params={"slug": "2026-seoul-mayoral-election-winner"},
                    timeout=10)
data = res.json()

if data:
    event   = data[0]
    markets = event.get("markets", [])
    print(f"이벤트: {event['title']}")
    print(f"거래량: ${event['volume']:,.0f}")
    print(f"마켓 수: {len(markets)}개\n")

    for m in markets:
        prices   = json.loads(m.get("outcomePrices", "[]"))
        outcomes = json.loads(m.get("outcomes", "[]"))
        print(f"  질문: {m['question']}")
        print(f"  선택지: {outcomes}")
        print(f"  확률: {prices}")
        print(f"  최근거래: {m['lastTradePrice']}")
        print()

    # JSON 저장
    with open("korea_election.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("korea_election.json 저장 완료")