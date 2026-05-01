from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional

from app.database import get_db
from app.models import Candidate
from app.schemas import CandidateOut

router = APIRouter()

# 지역명 매칭용 딕셔너리
REGION_TO_SD = {
    "서울": "서울특별시",
    "부산": "부산광역시",
    "경기": "경기도",
    "충북": "충청북도",
    "충남": "충청남도",
    "강원": "강원특별자치도",
    "전남광주": "전라남도",
    "대전": "대전광역시",
    "대구": "대구광역시",
}

# 통계 응답 시 지역명을 다시 짧은 이름으로 변환하기 위한 역매칭용
SD_TO_REGION = {v: k for k, v in REGION_TO_SD.items()}

@router.get(
    "/candidates/stats",
    summary="후보자 종합 통계",
    description="전체 후보자의 성별, 연령, 정당, 지역별 통계 데이터를 반환한다."
)
def get_candidate_stats(db: Session = Depends(get_db)):
    # 1. 기본 필터: 등록 상태인 후보자만 집계
    base_query = db.query(Candidate).filter(
        Candidate.reg_status != "사퇴",
        Candidate.reg_status != "등록무효"
    )

    # 2. 전체 수, 평균 연령, 여성 비율 집계
    # SQLAlchemy func를 사용하여 DB 레벨에서 집계 수행
    stats = base_query.with_entities(
        func.count(Candidate.id).label("total"),
        func.avg(Candidate.age).label("avg_age"),
        func.sum(case((Candidate.gender == '여', 1), else_=0)).label("female_count")
    ).one()

    total = stats.total or 0
    avg_age = round(float(stats.avg_age), 1) if stats.avg_age else 0
    female_count = stats.female_count or 0
    female_pct = round((female_count / total * 100), 1) if total > 0 else 0

    # 3. 정당별 후보 수 집계
    party_results = base_query.with_entities(
        Candidate.party, func.count(Candidate.id)
    ).group_by(Candidate.party).all()
    by_party = {party: count for party, count in party_results if party}

    # 4. 지역별 후보 수 집계 (DB의 sd_name 사용)
    region_results = base_query.with_entities(
        Candidate.sd_name, func.count(Candidate.id)
    ).group_by(Candidate.sd_name).all()
    # DB의 긴 이름을 짧은 이름으로 변환하여 반환
    by_region = {SD_TO_REGION.get(sd, sd): count for sd, count in region_results if sd}

    # 5. 성별 분포 집계
    gender_results = base_query.with_entities(
        Candidate.gender, func.count(Candidate.id)
    ).group_by(Candidate.gender).all()
    by_gender = {gender: count for gender, count in gender_results if gender}

    # 6. 연령대별 분포 집계 (case 문 사용)
    age_group_results = base_query.with_entities(
        case(
            (Candidate.age < 30, "20대 이하"),
            (Candidate.age < 40, "30대"),
            (Candidate.age < 50, "40대"),
            (Candidate.age < 60, "50대"),
            (Candidate.age < 70, "60대"),
            else_="70대 이상"
        ).label("age_group"),
        func.count(Candidate.id)
    ).group_by("age_group").all()
    by_age_group = {group: count for group, count in age_group_results}

    return {
        "total": total,
        "female_pct": female_pct,
        "avg_age": avg_age,
        "by_party": by_party,
        "by_region": by_region,
        "by_age_group": by_age_group,
        "by_gender": by_gender
    }


@router.get(
    "/candidates/{region}",
    response_model=list[CandidateOut],
    summary="지역별 후보자 목록",
    description="선관위 API 에서 수집한 해당 지역의 예비후보자 또는 공식 후보자 목록을 반환한다.",
)
def get_candidates(
    region: str,
    candidate_type: Optional[str] = Query(
        None,
        description="예비후보자 | 후보자 (없으면 전체)"
    ),
    sg_type_label: Optional[str] = Query(
        None,
        description="광역단체장 | 기초단체장 | 광역의회의원 | 기초의회의원 | 교육감"
    ),
    party: Optional[str] = Query(
        None,
        description="정당명으로 필터 (예: 더불어민주당)"
    ),
    election_type: Optional[str] = Query(
        None,
        description="지방선거 | 국회의원보궐"
    ),
    db: Session = Depends(get_db),
):
    """
    사용 예시:
        /api/candidates/서울
        /api/candidates/서울?sg_type_label=광역단체장
        /api/candidates/서울?candidate_type=후보자&party=더불어민주당
    """
    # 1. 프론트엔드 지역명(서울)을 DB 지역명(서울특별시)으로 변환
    full_region_name = REGION_TO_SD.get(region, region)

    # 2. sd_name 필드를 사용하여 지역 검색
    query = db.query(Candidate).filter(Candidate.sd_name == full_region_name)

    if candidate_type:
        query = query.filter(Candidate.candidate_type == candidate_type)
    if sg_type_label:
        query = query.filter(Candidate.sg_type_label == sg_type_label)
    if party:
        query = query.filter(Candidate.party == party)
    if election_type:
        query = query.filter(Candidate.election_type == election_type)

    # 등록 상태 필터 — 사퇴/무효는 기본적으로 제외
    query = query.filter(Candidate.reg_status != "사퇴")
    query = query.filter(Candidate.reg_status != "등록무효")

    results = (
        query
        .order_by(Candidate.sg_type_label, Candidate.name)
        .all()
    )

    return results


@router.get(
    "/candidates/{region}/{name}",
    response_model=CandidateOut,
    summary="후보자 1인 상세 조회",
)
def get_candidate_detail(
    region: str, 
    name: str, 
    db: Session = Depends(get_db)
):
    # 여기도 동일하게 지역명 변환 적용
    full_region_name = REGION_TO_SD.get(region, region)
    
    result = db.query(Candidate).filter(
        Candidate.sd_name == full_region_name,
        Candidate.name == name
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="해당 후보자를 찾을 수 없습니다.")
    return result