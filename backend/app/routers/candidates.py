# backend/app/routers/candidates.py
# GET /api/candidates/{region}  →  선관위 후보자 목록

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import Candidate
from app.schemas import CandidateOut

router = APIRouter()


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
        /api/candidates/서울특별시
        /api/candidates/서울특별시?sg_type_label=광역단체장
        /api/candidates/서울특별시?candidate_type=후보자&party=더불어민주당
    """
    query = db.query(Candidate).filter(Candidate.sd_name == region)

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
    name:   str,
    db: Session = Depends(get_db),
):
    """후보자 이름으로 1인 상세 정보 조회"""
    candidate = (
        db.query(Candidate)
        .filter(
            Candidate.sd_name == region,
            Candidate.name    == name,
        )
        .first()
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="후보자를 찾을 수 없습니다.")

    return candidate