# backend/app/routers/markets.py
# GET /api/markets/{region}          →  최신 확률
# GET /api/markets/{region}/history  →  날짜별 확률 (타임라인 차트용)

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models import MarketPrice
from app.schemas import MarketPriceOut, MarketHistoryOut

router = APIRouter()


@router.get(
    "/markets/{region}",
    response_model=list[MarketPriceOut],
    summary="지역별 최신 폴리마켓 확률",
    description="해당 지역 후보자별 가장 최근에 수집된 당선 확률을 반환한다.",
)
def get_market_latest(
    region: str,
    db: Session = Depends(get_db),
):
    """
    후보자별로 가장 최근 row 만 가져온다.
    확률 높은 순으로 정렬해서 반환.
    """
    # 후보자별 최신 fetched_at 서브쿼리
    subq = (
        db.query(
            MarketPrice.candidate,
            func.max(MarketPrice.fetched_at).label("latest"),
        )
        .filter(MarketPrice.region == region)
        .group_by(MarketPrice.candidate)
        .subquery()
    )

    rows = (
        db.query(MarketPrice)
        .join(
            subq,
            (MarketPrice.candidate  == subq.c.candidate) &
            (MarketPrice.fetched_at == subq.c.latest),
        )
        .filter(MarketPrice.region == region)
        .order_by(MarketPrice.probability.desc())
        .all()
    )

    # probability_pct 계산해서 반환
    result = []
    for r in rows:
        result.append(
            MarketPriceOut(
                region          = r.region,
                candidate       = r.candidate,
                probability     = r.probability,
                probability_pct = round(r.probability * 100, 2),
                volume_24h      = r.volume_24h or 0,
                price_change_1d = r.price_change_1d or 0,
                price_change_1w = r.price_change_1w or 0,
                fetched_at      = r.fetched_at,
            )
        )
    return result


@router.get(
    "/markets/{region}/history",
    response_model=list[MarketHistoryOut],
    summary="폴리마켓 확률 추이 (타임라인 차트용)",
    description="날짜별 평균 당선 확률을 반환한다. TimelineChart.jsx 에서 사용.",
)
def get_market_history(
    region:    str,
    candidate: str   = Query(...,  description="후보자 이름 (필수)"),
    days:      int   = Query(30,   description="조회 기간 (일), 기본 30일"),
    db: Session = Depends(get_db),
):
    """
    사용 예시:
        /api/markets/서울/history?candidate=Chong Won-oh&days=30
    """
    since = datetime.now() - timedelta(days=days)

    rows = (
        db.query(
            func.date(MarketPrice.fetched_at).label("date"),
            func.avg(MarketPrice.probability).label("probability"),
        )
        .filter(
            MarketPrice.region     == region,
            MarketPrice.candidate  == candidate,
            MarketPrice.fetched_at >= since,
        )
        .group_by(func.date(MarketPrice.fetched_at))
        .order_by("date")
        .all()
    )

    return [
        MarketHistoryOut(
            date            = str(r.date),
            probability     = round(r.probability, 4),
            probability_pct = round(r.probability * 100, 2),
        )
        for r in rows
    ]