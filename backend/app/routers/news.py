# backend/app/routers/news.py
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
    summary="지역별/전체 뉴스 목록",
    description="해당 지역 및 조건에 맞는 뉴스를 반환한다. (전체 지역 지원)",
)
def get_news(
    region:    str,
    candidate: Optional[str] = Query(None, description="후보자 이름으로 필터"),
    category:  Optional[str] = Query(None, description="선거 유형(카테고리) 필터"),
    date:      Optional[str] = Query(None, description="특정 날짜 뉴스 조회 (YYYY-MM-DD)"),
    days:      int = Query(365,  description="최근 N일 뉴스, 기본 1년(365일)"),
    limit:     int = Query(2000, description="반환 건수 최대 (프론트 페이징용)"),
    db: Session = Depends(get_db),
):
    query = db.query(NewsSentiment)

    # 1. 지역 필터 ('전체'가 아닐 때만 적용)
    if region != "전체":
        query = query.filter(NewsSentiment.region == region)
        
    # 2. 카테고리 필터 (광역단체장, 국회의원보궐 등)
    if category and category != "전체":
        query = query.filter(NewsSentiment.category == category)

    # 3. 후보자 검색 필터 (부분 일치)
    if candidate:
        query = query.filter(NewsSentiment.candidate.like(f"%{candidate}%"))
    
    # 4. 날짜 필터
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query = query.filter(func.date(NewsSentiment.pub_date) == target_date.date())
        except ValueError:
            pass
    else:
        since = datetime.now() - timedelta(days=days)
        query = query.filter(NewsSentiment.pub_date >= since)

    # 최신순 정렬
    results = query.order_by(NewsSentiment.pub_date.desc()).limit(limit).all()
    return results

@router.get(
    "/news/{region}/sentiment-summary",
    summary="지역별 감성 점수 요약 (날짜별)",
)
def get_sentiment_by_date(
    region:    str,
    candidate: Optional[str] = Query(None, description="후보자 이름"),
    days:      int = Query(30,  description="최근 N일, 기본 30일"),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)

    query = db.query(
        func.date(NewsSentiment.pub_date).label("date"),
        func.avg(NewsSentiment.sentiment_score).label("avg_score"),
        func.count(NewsSentiment.id).label("article_count"),
    ).filter(
        NewsSentiment.pub_date >= since,
        NewsSentiment.sentiment_score != None,
    )

    if region != "전체":
        query = query.filter(NewsSentiment.region == region)
    if candidate:
        query = query.filter(NewsSentiment.candidate == candidate)

    rows = query.group_by(func.date(NewsSentiment.pub_date)).all()

    return [
        {
            "date": str(r.date),
            "avg_score": round(r.avg_score, 3) if r.avg_score else 0.0,
            "article_count": r.article_count
        }
        for r in rows
    ]