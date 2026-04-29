# backend/app/collectors/nec.py
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
import xmltodict
import urllib.parse
import time
from datetime import datetime

API_KEY  = os.getenv("NEC_API_KEY")
BASE_URL = "https://apis.data.go.kr/9760000"
SG_ID    = "20260603"

# ── 확정된 선거종류 코드
LOCAL_TYPE_CODES = {
    "3":  "광역단체장",
    "4":  "기초단체장",
    "5":  "광역의회의원",
    "6":  "기초의회의원",
    "11": "교육감",
}

# ── 국회의원 보궐 (데이터 확인된 지역만)
ASSEMBLY_REGIONS = [
    "경기도", "인천광역시", "충청남도", "전북특별자치도",
]

ALL_SD_NAMES = [
    "서울특별시", "부산광역시", "대구광역시", "인천광역시",
    "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
    "경기도", "강원특별자치도", "충청북도", "충청남도",
    "전북특별자치도", "전라남도", "경상북도", "경상남도",
    "제주특별자치도",
]


# ─────────────────────────────────────────────
# 공통: 페이지 단위 조회
# ─────────────────────────────────────────────
def _fetch_page(endpoint: str, sg_typecode: str,
                sd_name: str, page: int,
                num_of_rows: int = 100) -> dict:
    """
    엔드포인트, 선거종류코드, 시도명, 페이지를 받아
    XML 응답을 파싱한 dict를 반환한다.
    실패 시 빈 dict 반환.
    """
    url = (
        f"{BASE_URL}/{endpoint}"
        f"?serviceKey={API_KEY}"
        f"&pageNo={page}"
        f"&numOfRows={num_of_rows}"
        f"&sgId={SG_ID}"
        f"&sgTypecode={sg_typecode}"
        f"&sdName={urllib.parse.quote(sd_name)}"
    )

    try:
        res  = requests.get(url, timeout=15)
        text = res.text.strip()

        if res.status_code != 200:
            print(f"  [HTTP {res.status_code}] {sd_name}/{sg_typecode}")
            return {}

        if not text.startswith("<?xml") and not text.startswith("<"):
            print(f"  [비XML] {text[:60]}")
            return {}

        data   = xmltodict.parse(text)
        header = data["response"]["header"]
        code   = header.get("resultCode", "")
        msg    = header.get("resultMsg", "")

        if code not in ("00", "000", "INFO-00"):
            if "INFO-03" not in code:
                print(f"  [API {code}] {msg} — {sd_name}/{sg_typecode}")
            return {}

        return data

    except Exception as e:
        print(f"  [오류] {e} — {sd_name}/{sg_typecode}")
        return {}


# ─────────────────────────────────────────────
# 공통: 파싱
# ─────────────────────────────────────────────
def _parse_item(item: dict, sg_typecode: str,
                sg_type_label: str,
                election_type: str,
                candidate_type: str) -> dict:
    """
    XML 항목 하나를 DB 저장용 dict로 변환.
    candidate_type: '예비후보자' | '후보자'
    """
    def safe(val):
        return (val or "").strip() if isinstance(val, str) else ""

    return {
        # 선거 메타
        "election_type":   election_type,    # 지방선거 / 국회의원보궐
        "candidate_type":  candidate_type,   # 예비후보자 / 후보자
        "sg_typecode":     sg_typecode,
        "sg_type_label":   sg_type_label,

        # 지역
        "sd_name":         safe(item.get("sdName")),
        "sgg_name":        safe(item.get("sggName")),
        "wiw_name":        safe(item.get("wiwName")),

        # 인적사항
        "huboid":          safe(str(item.get("huboid", ""))),
        "name":            safe(item.get("name")),
        "hanja_name":      safe(item.get("hanjaName")),
        "gender":          safe(item.get("gender")),
        "birthday":        safe(item.get("birthday")),
        "age":             safe(str(item.get("age", ""))),
        "addr":            safe(item.get("addr")),

        # 정당·직업
        "party":           safe(item.get("jdName")),
        "candidate_no":    safe(str(item.get("giho", ""))),  # 후보자 기호 (예비후보자는 없음)
        "job":             safe(item.get("job")),

        # 학력·경력
        "education":       safe(item.get("edu")),
        "career1":         safe(item.get("career1")),
        "career2":         safe(item.get("career2")),

        # 등록상태
        "reg_status":      safe(item.get("status")),
        "reg_date":        safe(item.get("regdate")),

        # 수집 시각
        "fetched_at":      datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────
# 공통: 지역 + 선거종류 전체 페이지 수집
# ─────────────────────────────────────────────
def _fetch_all_pages(endpoint: str, sg_typecode: str,
                     sg_type_label: str, sd_name: str,
                     election_type: str,
                     candidate_type: str) -> list[dict]:
    results = []
    page    = 1

    while True:
        data = _fetch_page(endpoint, sg_typecode, sd_name, page)
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

        batch = [
            _parse_item(i, sg_typecode, sg_type_label,
                        election_type, candidate_type)
            for i in raw_items
        ]
        results.extend(batch)

        print(f"    [{candidate_type}] {sd_name} p{page}: "
              f"{len(batch)}명 (누적 {len(results)}/{total_count}명)")

        if page * 100 >= total_count:
            break
        page += 1
        time.sleep(0.3)

    return results


# ─────────────────────────────────────────────
# PUBLIC API 1: 예비후보자 수집
# ─────────────────────────────────────────────
ENDPOINT_PRE = "PofelcddInfoInqireService/getPoelpcddRegistSttusInfoInqire"

def fetch_pre_candidates() -> list[dict]:
    """
    예비후보자 전국 수집 (지방선거 + 국회의원 보궐)
    scheduler.py에서 매일 06:00 호출
    """
    print("\n[예비후보자 수집 시작]")
    all_results = []

    # 지방선거 전국
    for typecode, label in LOCAL_TYPE_CODES.items():
        print(f"\n  [{label} / type={typecode}]")
        for sd_name in ALL_SD_NAMES:
            batch = _fetch_all_pages(
                ENDPOINT_PRE, typecode, label,
                sd_name, "지방선거", "예비후보자"
            )
            all_results.extend(batch)
            time.sleep(0.15)

    # 국회의원 보궐 (확인된 지역)
    print(f"\n  [국회의원보궐 / type=2]")
    for sd_name in ASSEMBLY_REGIONS:
        batch = _fetch_all_pages(
            ENDPOINT_PRE, "2", "국회의원보궐",
            sd_name, "국회의원보궐", "예비후보자"
        )
        all_results.extend(batch)
        time.sleep(0.15)

    print(f"\n[예비후보자 수집 완료] 총 {len(all_results)}명")
    return all_results


# ─────────────────────────────────────────────
# PUBLIC API 2: 후보자 수집 (후보자 등록 후 사용)
# ─────────────────────────────────────────────
ENDPOINT_CDD = "PofelcddInfoInqireService/getPofelcddRegistSttusInfoInqire"

def fetch_candidates() -> list[dict]:
    """
    공식 후보자 전국 수집 (지방선거 + 국회의원 보궐)
    후보자 등록 개시일(약 선거일 15일 전)부터 사용 가능.
    scheduler.py에서 매일 06:00 호출 (예비후보자와 교체)
    """
    print("\n[후보자 수집 시작]")
    all_results = []

    # 지방선거 전국
    for typecode, label in LOCAL_TYPE_CODES.items():
        print(f"\n  [{label} / type={typecode}]")
        for sd_name in ALL_SD_NAMES:
            batch = _fetch_all_pages(
                ENDPOINT_CDD, typecode, label,
                sd_name, "지방선거", "후보자"
            )
            all_results.extend(batch)
            time.sleep(0.15)

    # 국회의원 보궐
    print(f"\n  [국회의원보궐 / type=2]")
    for sd_name in ASSEMBLY_REGIONS:
        batch = _fetch_all_pages(
            ENDPOINT_CDD, "2", "국회의원보궐",
            sd_name, "국회의원보궐", "후보자"
        )
        all_results.extend(batch)
        time.sleep(0.15)

    print(f"\n[후보자 수집 완료] 총 {len(all_results)}명")
    return all_results


# ─────────────────────────────────────────────
# PUBLIC API 3: 예비후보자 + 후보자 자동 판단
# ─────────────────────────────────────────────
def fetch_nec_data() -> list[dict]:
    """
    scheduler.py 및 단독 실행 시 호출하는 메인 함수.
    현재 날짜 기준으로 예비후보자/후보자를 자동 판단해서 수집.
    후보자 등록 개시일: 2026-05-19 (잠정)
    """
    CANDIDATE_REG_START = "20260519"  # 후보자 등록 개시일
    today = datetime.now().strftime("%Y%m%d")

    if today >= CANDIDATE_REG_START:
        print(f"[{today}] 후보자 등록 개시일 이후 → 후보자 API 사용")
        return fetch_candidates()
    else:
        print(f"[{today}] 후보자 등록 개시일 이전 → 예비후보자 API 사용")
        return fetch_pre_candidates()


# ─────────────────────────────────────────────
# DB 저장
# ─────────────────────────────────────────────
def save_candidates_to_db(candidates: list[dict]):
    """
    수집된 후보자 데이터를 DB에 저장.
    (name, sgg_name, sg_typecode, candidate_type) 기준 UPSERT
    """
    from app.database import SessionLocal
    from app.models import Candidate

    db = SessionLocal()
    inserted, updated = 0, 0

    try:
        for c in candidates:
            existing = (
                db.query(Candidate)
                .filter(
                    Candidate.name          == c["name"],
                    Candidate.sgg_name      == c["sgg_name"],
                    Candidate.sg_typecode   == c["sg_typecode"],
                    Candidate.candidate_type == c["candidate_type"],
                )
                .first()
            )

            if existing:
                # 변경 가능 필드만 업데이트
                existing.party       = c["party"]
                existing.reg_status  = c["reg_status"]
                existing.candidate_no = c["candidate_no"]
                existing.fetched_at  = c["fetched_at"]
                updated += 1
            else:
                db.add(Candidate(**{
                    k: v for k, v in c.items()
                    if hasattr(Candidate, k)
                }))
                inserted += 1

        db.commit()
        print(f"\n[✅ 완료] DB 저장 완료 — 신규: {inserted}명 / 업데이트: {updated}명")

    except Exception as e:
        db.rollback()
        print(f"\n[🚨 DB 오류] {e}")
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────
# 직접 실행용 스위치 (터미널에서 실행할 때만 작동)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("===========================================")
    print("🗳️ 선관위(NEC) 후보자 데이터 수집기 가동 시작")
    print("===========================================")
    
    if not API_KEY:
        print("🚨 [경고] .env 파일에 NEC_API_KEY 가 설정되어 있지 않습니다!")
        sys.exit(1)
        
    # 1. 데이터 수집 (날짜 자동 판단 로직 사용)
    candidates_data = fetch_nec_data()
    
    # 2. 데이터 저장
    if candidates_data:
        print(f"\n데이터베이스 저장을 시작합니다... (총 {len(candidates_data)}명)")
        save_candidates_to_db(candidates_data)
    else:
        print("\n수집된 후보자 데이터가 없습니다. (API 응답 또는 기간을 확인해주세요)")