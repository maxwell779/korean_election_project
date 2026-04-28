# collect_all_2026.py

import requests
import xmltodict
import urllib.parse
import time
import os
import csv
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

API_KEY  = os.getenv("NEC_API_KEY", "c1af12da86c01a0b5bcc75e6492846d5d9d1713b63eba6e29e6e3e2f262c1637")
BASE_URL = "https://apis.data.go.kr/9760000"
ENDPOINT = f"{BASE_URL}/PofelcddInfoInqireService/getPoelpcddRegistSttusInfoInqire"

SG_ID = "20260603"

# ── 지방선거 (전국 17개 시도)
LOCAL_TYPE_CODES = {
    "3":  "광역단체장",
    "4":  "기초단체장",
    "5":  "광역의회의원",
    "6":  "기초의회의원",
    "11": "교육감",
}

# ── 국회의원 보궐선거 (데이터 있는 지역만)
ASSEMBLY_REGIONS = [
    "경기도", "인천광역시", "충청남도", "전북특별자치도",
]

# ── 전국 17개 시도
ALL_SD_NAMES = [
    "서울특별시", "부산광역시", "대구광역시", "인천광역시",
    "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
    "경기도", "강원특별자치도", "충청북도", "충청남도",
    "전북특별자치도", "전라남도", "경상북도", "경상남도",
    "제주특별자치도",
]

CSV_COLUMNS = [
    "election_type",      # 지방선거 / 국회의원보궐
    "sg_typecode", "sg_type_label",
    "sd_name", "sgg_name", "wiw_name",
    "name", "hanja_name", "gender", "birthday", "age",
    "party", "job", "education",
    "career1", "career2",
    "addr", "reg_status", "reg_date",
    "huboid",             # 후보자 고유ID (나중에 전과기록 스크래핑 때 활용)
]


# ─────────────────────────────────────────────
# 페이지 단위 조회
# ─────────────────────────────────────────────
def fetch_page(sg_typecode: str, sd_name: str,
               page: int, num_of_rows: int = 100) -> dict:

    sd_encoded = urllib.parse.quote(sd_name)
    url = (
        f"{ENDPOINT}"
        f"?serviceKey={API_KEY}"
        f"&pageNo={page}"
        f"&numOfRows={num_of_rows}"
        f"&sgId={SG_ID}"
        f"&sgTypecode={sg_typecode}"
        f"&sdName={sd_encoded}"
    )

    try:
        res  = requests.get(url, timeout=15)
        text = res.text.strip()

        if res.status_code != 200:
            print(f"  [HTTP {res.status_code}] {sd_name}/{sg_typecode}")
            return {}

        if not text.startswith("<?xml") and not text.startswith("<"):
            return {}

        data   = xmltodict.parse(text)
        header = data["response"]["header"]
        code   = header.get("resultCode", "")
        msg    = header.get("resultMsg", "")

        SUCCESS_CODES = ("00", "000", "INFO-00")
        if code not in SUCCESS_CODES:
            if "INFO-03" not in code:
                print(f"  [API {code}] {msg} — {sd_name}/{sg_typecode}")
            return {}

        return data

    except Exception as e:
        print(f"  [오류] {e} — {sd_name}/{sg_typecode}")
        return {}


# ─────────────────────────────────────────────
# 파싱
# ─────────────────────────────────────────────
def parse_candidate(item: dict, sg_typecode: str,
                    sg_type_label: str, election_type: str) -> dict:
    def safe(val):
        return (val or "").strip() if isinstance(val, str) else ""

    return {
        "election_type":  election_type,
        "sg_typecode":    sg_typecode,
        "sg_type_label":  sg_type_label,
        "sd_name":        safe(item.get("sdName")),
        "sgg_name":       safe(item.get("sggName")),
        "wiw_name":       safe(item.get("wiwName")),
        "name":           safe(item.get("name")),
        "hanja_name":     safe(item.get("hanjaName")),
        "gender":         safe(item.get("gender")),
        "birthday":       safe(item.get("birthday")),
        "age":            safe(str(item.get("age", ""))),
        "party":          safe(item.get("jdName")),
        "job":            safe(item.get("job")),
        "education":      safe(item.get("edu")),
        "career1":        safe(item.get("career1")),
        "career2":        safe(item.get("career2")),
        "addr":           safe(item.get("addr")),
        "reg_status":     safe(item.get("status")),
        "reg_date":       safe(item.get("regdate")),
        "huboid":         safe(str(item.get("huboid", ""))),  # ← 전과 스크래핑용
    }


# ─────────────────────────────────────────────
# 지역 + 선거종류 단위 수집
# ─────────────────────────────────────────────
def fetch_region(sg_typecode: str, sg_type_label: str,
                 sd_name: str, election_type: str) -> list[dict]:
    results = []
    page = 1

    while True:
        data = fetch_page(sg_typecode, sd_name, page)
        if not data:
            break

        body        = data["response"]["body"]
        total_count = int(body.get("totalCount", 0))
        items       = body.get("items")

        if not items or total_count == 0:
            break

        raw_items = items.get("item", [])
        if isinstance(raw_items, dict):
            raw_items = [raw_items]

        batch = [parse_candidate(i, sg_typecode, sg_type_label, election_type)
                 for i in raw_items]
        results.extend(batch)

        print(f"    {sd_name} p{page}: {len(batch)}명 "
              f"(이번지역 {len(results)}명 / 전체 {total_count}명)")

        if page * 100 >= total_count:
            break
        page += 1
        time.sleep(0.3)

    return results


# ─────────────────────────────────────────────
# 전체 수집
# ─────────────────────────────────────────────
def fetch_all() -> list[dict]:
    all_candidates = []

    # ── 1. 지방선거 전국 수집
    print("\n" + "="*60)
    print(f"[1단계] 지방선거  sgId={SG_ID}")
    print("="*60)

    for typecode, label in LOCAL_TYPE_CODES.items():
        print(f"\n  [{label} / type={typecode}]")
        type_count = 0

        for sd_name in ALL_SD_NAMES:
            batch = fetch_region(typecode, label, sd_name, "지방선거")
            all_candidates.extend(batch)
            type_count += len(batch)
            time.sleep(0.15)

        print(f"  → [{label}] 소계: {type_count}명")

    local_total = sum(1 for c in all_candidates if c["election_type"] == "지방선거")
    print(f"\n지방선거 소계: {local_total}명")

    # ── 2. 국회의원 보궐선거 수집 (확인된 4개 지역)
    print("\n" + "="*60)
    print(f"[2단계] 국회의원 보궐선거  sgTypecode=2")
    print(f"        대상 지역: {ASSEMBLY_REGIONS}")
    print("="*60)

    assembly_count = 0
    for sd_name in ASSEMBLY_REGIONS:
        batch = fetch_region("2", "국회의원보궐", sd_name, "국회의원보궐")
        all_candidates.extend(batch)
        assembly_count += len(batch)
        time.sleep(0.2)

    print(f"\n국회의원 보궐 소계: {assembly_count}명")

    return all_candidates


# ─────────────────────────────────────────────
# CSV 저장
# ─────────────────────────────────────────────
def save_to_csv(candidates: list[dict]) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"candidates_2026_{timestamp}.csv"

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(candidates)

    return filename


# ─────────────────────────────────────────────
# 요약
# ─────────────────────────────────────────────
def print_summary(candidates: list[dict]):
    from collections import Counter

    print(f"\n{'='*60}")
    print(f"최종 합계: {len(candidates)}명")
    print(f"{'='*60}")

    print("\n[선거구분별]")
    for et, cnt in Counter(c["election_type"] for c in candidates).most_common():
        print(f"  {et:15s}: {cnt:5d}명")

    print("\n[선거종류별]")
    for label, cnt in Counter(c["sg_type_label"] for c in candidates).most_common():
        print(f"  {label:20s}: {cnt:5d}명")

    print("\n[시도별]")
    for sd, cnt in Counter(c["sd_name"] for c in candidates).most_common():
        print(f"  {sd:15s}: {cnt:5d}명")

    print("\n[정당별 상위 10]")
    for party, cnt in Counter(c["party"] for c in candidates).most_common(10):
        print(f"  {(party or '무소속'):20s}: {cnt:5d}명")

    print("\n[등록상태별]")
    for status, cnt in Counter(c["reg_status"] for c in candidates).most_common():
        print(f"  {(status or '미확인'):15s}: {cnt:5d}명")

    # 국회의원 보궐 별도 출력
    assembly = [c for c in candidates if c["election_type"] == "국회의원보궐"]
    if assembly:
        print(f"\n[국회의원 보궐 선거구]")
        for sgg, cnt in Counter(c["sgg_name"] for c in assembly).most_common():
            print(f"  {sgg:25s}: {cnt:3d}명")


# ─────────────────────────────────────────────
# 전과기록 스크래핑 안내
# ─────────────────────────────────────────────
def print_criminal_guide(candidates: list[dict]):
    print(f"""
{'='*60}
[전과기록 수집 방법 안내]
{'='*60}
전과기록은 현재 예비후보자 API에 포함되지 않아요.
후보자 등록 후 (선거일 약 15일 전) 아래 URL 형식으로
huboid를 이용해 웹 스크래핑이 가능해요.

URL 형식:
  http://info.nec.go.kr/electioninfo/candidate_detail_info.xhtml
  ?electionId=0020260603&huboId={{huboid}}

예시 (huboid=100153766):
  http://info.nec.go.kr/electioninfo/candidate_detail_info.xhtml
  ?electionId=0020260603&huboId=100153766

CSV의 huboid 컬럼을 활용해서 후보자 등록 후 일괄 수집 가능.
수집 가능 항목: 전과기록 / 재산 / 병역 / 납세·체납 내역
{'='*60}
""")

    # huboid 있는 후보자 수 확인
    with_huboid = sum(1 for c in candidates if c.get("huboid"))
    print(f"  현재 huboid 보유 후보자: {with_huboid}명 / 전체 {len(candidates)}명")


# ─────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────
if __name__ == "__main__":

    candidates = fetch_all()

    if not candidates:
        print("\n수집된 데이터가 없습니다.")
    else:
        print_summary(candidates)
        print_criminal_guide(candidates)

        filename = save_to_csv(candidates)
        print(f"\n✅ CSV 저장 완료: {filename}")
        print(f"   저장 위치: {os.path.abspath(filename)}")
        print(f"   총 {len(candidates)}명 / 컬럼 {len(CSV_COLUMNS)}개")