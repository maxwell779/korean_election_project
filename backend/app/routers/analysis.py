# backend/app/routers/analysis.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models import NewsSentiment, Candidate
from app.schemas import AnalysisOut, ChatbotOut

router = APIRouter()

def _score_to_label(score: Optional[float]) -> str:
    """감성 점수 → 한글 레이블 변환"""
    if score is None: return "분석중"
    if score >= 0.3:  return "긍정"
    if score <= -0.3: return "부정"
    return "중립"

@router.get(
    "/analysis/{region}",
    response_model=list[AnalysisOut],
    summary="AI 감성분석 결과 조회",
)
def get_analysis(
    region:    str,
    candidate: Optional[str] = Query(None, description="후보자 이름 (선택: 없으면 지역 전체 반환)"),
    limit:     int = Query(5),
    db: Session = Depends(get_db),
):
    query = (
        db.query(NewsSentiment)
        .filter(
            NewsSentiment.region == region,
            NewsSentiment.analyzed_at != None,
        )
    )
    
    # candidate 값이 들어왔을 때만 필터링 추가
    if candidate:
        query = query.filter(NewsSentiment.candidate == candidate)
        
    results = query.order_by(NewsSentiment.analyzed_at.desc()).limit(limit).all()

    return [
        AnalysisOut(
            candidate       = r.candidate or "",
            region          = r.region,
            sentiment       = r.sentiment,
            sentiment_score = r.sentiment_score,
            summary_3line   = r.summary_3line,
            analyzed_at     = r.analyzed_at,
            importance      = r.importance,
            one_line        = r.one_line,
        )
        for r in results
    ]

@router.get(
    "/chatbot",
    response_model=ChatbotOut,
    summary="챗봇 — [후보자명] 입력 시 관련 뉴스 감성분석"
)
def chatbot(
    query: str = Query(..., description="후보자명을 대괄호로 감싸서 입력. 예: [정원오]"),
    days:  int = Query(14, description="뉴스 수집 기간 (일)"),
    importance_threshold: int = Query(2, description="반환할 최소 중요도 (1~5)"),
    db: Session = Depends(get_db),
):
    try:
        from app.services.ai_analyzer import chatbot_query
    except ImportError:
        raise HTTPException(status_code=503, detail="ai_analyzer 모듈 로드 실패.")

    since = datetime.now() - timedelta(days=days)
    news_rows = (
        db.query(NewsSentiment)
        .filter(NewsSentiment.pub_date >= since)
        .order_by(NewsSentiment.pub_date.desc())
        .all()
    )

    news_list = [
        {
            "date":        r.pub_date.strftime("%Y-%m-%d") if r.pub_date else "",
            "title":       r.title or "",
            "content":     r.summary_3line or r.title or "",
            "description": r.title or "",
            "url":         r.url or "",
            "candidate":   r.candidate or "",
        }
        for r in news_rows
    ]

    candidate_names = [row.name for row in db.query(Candidate.name).distinct().all()]

    result = chatbot_query(
        user_input           = query,
        news_list            = news_list,
        candidate_list       = candidate_names,
        importance_threshold = importance_threshold,
    )
    return result