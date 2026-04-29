# backend/app/routers/news.py
# GET /api/news/{region}  →  뉴스 목록

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models import NewsSentiment
from app.schemas import NewsOut

router = APIRouter()


@router.get(
    "/news/{region}",
    response_model=list[NewsOut],
    summary="지역별 뉴스 목록",
    description="해당 지역·후보자 관련 최신 뉴스를 반환한다.",
)
def get_news(
    region:    str,
    candidate: Optional[str] = Query(
        None, description="후보자 이름으로 필터 (없으면 지역 전체)"
    ),
    date: Optional[str] = Query(
        None,
        description="특정 날짜 뉴스 조회 (YYYY-MM-DD). 타임라인 날짜 클릭 팝업용."
    ),
    days:  int = Query(7,  description="최근 N일 뉴스 (date 없을 때 적용), 기본 7일"),
    limit: int = Query(20, description="반환 건수 최대, 기본 20"),
    db: Session = Depends(get_db),
):
    """
    사용 예시:
        /api/news/서울                                → 서울 전체 최신 뉴스
        /api/news/서울?candidate=정원오               → 서울 정원오 최신 뉴스
        /api/news/서울?candidate=정원오&date=2026-05-10 → 특정 날짜 뉴스
    """
    query = db.query(NewsSentiment).filter(NewsSentiment.region == region)

    if candidate:
        query = query.filter(NewsSentiment.candidate == candidate)
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query = query.filter(func.date(NewsSentiment.pub_date) == target_date.date())
        except ValueError:
            pass
    else:
        since = datetime.now() - timedelta(days=days)
        query = query.filter(NewsSentiment.pub_date >= since)

    results = (
        query
        .order_by(NewsSentiment.pub_date.desc())
        .limit(limit)
        .all()
    )

    return results


@router.get(
    "/news/{region}/sentiment-summary",
    summary="지역별 감성 점수 요약 (날짜별)",
    description="TimelineChart.jsx 감성 막대용. 날짜별 평균 감성 점수를 반환한다.",
)
def get_sentiment_by_date(
    region:    str,
    candidate: Optional[str] = Query(None, description="후보자 이름 (없으면 지역 전체 평균)"),
    days:      int = Query(30,  description="최근 N일, 기본 30일"),
    db: Session = Depends(get_db),
):
    """
    사용 예시:
        /api/news/서울/sentiment-summary?days=30
        /api/news/서울/sentiment-summary?candidate=정원오&days=30
    """
    since = datetime.now() - timedelta(days=days)

    # 1. 기본 쿼리 작성 (지역, 날짜, 점수유무 필터링)
    query = db.query(
        func.date(NewsSentiment.pub_date).label("date"),
        func.avg(NewsSentiment.sentiment_score).label("avg_score"),
        func.count(NewsSentiment.id).label("article_count"),
    ).filter(
        NewsSentiment.region           == region,
        NewsSentiment.pub_date         >= since,
        NewsSentiment.sentiment_score != None,
    )

    # 2. 후보자 이름이 있으면 필터 추가
    if candidate:
        query = query.filter(NewsSentiment.candidate == candidate)

    # 3. 그룹화 및 데이터 패치
    rows = query.group_by(func.date(NewsSentiment.pub_date)).all()

    return [
        {
            "date": str(r.date),
            "avg_score": round(r.avg_score, 3) if r.avg_score else 0.0,
            "article_count": r.article_count
        }
        for r in rows
    ]