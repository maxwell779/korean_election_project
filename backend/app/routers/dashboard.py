# backend/app/routers/dashboard.py
# GET /api/dashboard/summary  →  전국 지도 초기 렌더링용

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.regions import get_regions
from app.schemas import RegionSummaryOut

router = APIRouter()


@router.get(
    "/dashboard/summary",
    response_model=list[RegionSummaryOut],
    summary="전국 대시보드 요약",
    description=(
        "지도 초기 렌더링용 전국 데이터. "
        "/api/regions 와 동일한 데이터를 반환한다. "
        "프론트엔드에서 30분 주기 폴링으로 최신 상태를 확인한다."
    ),
)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    React 앱 초기 로드 시 한 번 호출.
    이후 30분마다 폴링해서 확률 변동 감지.

    사용 예시:
        /api/dashboard/summary
    """
    return get_regions(db)


@router.get(
    "/dashboard/stats",
    summary="전국 통계 요약",
    description="대시보드 상단 헤더용 전국 통계 (후보자 수, 활성 마켓 수 등).",
)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    헤더 영역에 표시할 전국 통계.

    반환 예시:
    {
        "total_candidates": 9320,
        "active_regions": 9,
        "election_date": "2026-06-03",
        "days_remaining": 37
    }
    """
    from app.models import Candidate, MarketPrice
    from datetime import datetime

    # 총 후보자 수
    total_candidates = db.query(Candidate).count()

    # 폴리마켓 활성 지역 수
    active_regions = (
        db.query(MarketPrice.region)
        .distinct()
        .count()
    )

    # D-Day 계산
    election_date  = datetime(2026, 6, 3)
    days_remaining = (election_date - datetime.now()).days

    return {
        "total_candidates": total_candidates,
        "active_regions":   active_regions,
        "election_date":    "2026-06-03",
        "days_remaining":   max(0, days_remaining),
    }