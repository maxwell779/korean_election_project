# backend/app/routers/analysis.py
 
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional
 
from app.database import get_db
from app.models import NewsSentiment, MarketPrice
from app.schemas import AnalysisOut, ChatbotOut
 
router = APIRouter()
 
 
@router.get(
    "/analysis/{region}",
    response_model=list[AnalysisOut],
    summary="AI 감성분석 결과 조회",
)
def get_analysis(
    region:    str,
    candidate: str = Query(..., description="후보자 이름 (필수)"),
    limit:     int = Query(5),
    db: Session = Depends(get_db),
):
    results = (
        db.query(NewsSentiment)
        .filter(
            NewsSentiment.region      == region,
            NewsSentiment.candidate   == candidate,
            NewsSentiment.analyzed_at != None,
        )
        .order_by(NewsSentiment.analyzed_at.desc())
        .limit(limit)
        .all()
    )
 
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
    "/analysis/{region}/overview",
    summary="후보자별 감성 현황 요약",
)
def get_analysis_overview(
    region: str,
    days:   int = Query(7),
    db: Session = Depends(get_db),
):
    since = datetime.now() - timedelta(days=days)
 
    rows = (
        db.query(
            NewsSentiment.candidate,
            func.avg(NewsSentiment.sentiment_score).label("avg_score"),
            func.count(NewsSentiment.id).label("article_count"),
        )
        .filter(
            NewsSentiment.region          == region,
            NewsSentiment.pub_date        >= since,
            NewsSentiment.sentiment_score != None,
        )
        .group_by(NewsSentiment.candidate)
        .order_by(func.avg(NewsSentiment.sentiment_score).desc())
        .all()
    )
 
    return [
        {
            "candidate":       r.candidate,
            "avg_score":       round(r.avg_score, 3) if r.avg_score else 0,
            "article_count":   r.article_count,
            "sentiment_label": _score_to_label(r.avg_score),
        }
        for r in rows
    ]
 
 
@router.get(
    "/chatbot",
    response_model=ChatbotOut,
    summary="챗봇 — [후보자명] 입력 시 관련 뉴스 감성분석",
)
def chatbot(
    query:                str = Query(..., description="예: [정원오]"),
    days:                 int = Query(14),
    importance_threshold: int = Query(2),
    db: Session = Depends(get_db),
):
    try:
        from app.services.ai_analyzer import chatbot_query
    except ImportError:
        raise HTTPException(status_code=503, detail="ai_analyzer 로드 실패. GEMINI_API_KEY 확인.")
 
    since = datetime.now() - timedelta(days=days)
    news_rows = (
        db.query(NewsSentiment)
        .filter(NewsSentiment.pub_date >= since)
        .order_by(NewsSentiment.pub_date.desc())
        .all()
    )
 
    # [수정] naver_news 키 → ai_analyzer 키 변환
    # naver_news: pub_date(datetime), original_link, description
    # ai_analyzer: date(str), url, content
    news_list = [
        {
            "date":        r.pub_date.strftime("%Y-%m-%d") if r.pub_date else "",
            "title":       r.title or "",
            "content":     r.summary_3line or r.title or "",  # 본문 없으면 제목으로 대체
            "description": r.title or "",                     # [수정] description도 포함
            "url":         r.url or "",
            "candidate":   r.candidate or "",
        }
        for r in news_rows
    ]
 
    from app.models import Candidate
    candidate_names = [
        row.name for row in db.query(Candidate.name).distinct().all()
    ]
 
    result = chatbot_query(
        user_input           = query,
        news_list            = news_list,
        candidate_list       = candidate_names,
        importance_threshold = importance_threshold,
    )
 
    return result
 
 
def _score_to_label(score: Optional[float]) -> str:
    if score is None: return "분석중"
    if score >= 0.3:  return "긍정"
    if score <= -0.3: return "부정"
    return "중립"


def _score_to_label(score: Optional[float]) -> str:
    """감성 점수 → 한글 레이블 변환"""
    if score is None:
        return "분석중"
    if score >= 0.3:
        return "긍정"
    if score <= -0.3:
        return "부정"
    return "중립"

@router.get(
    "/chatbot",
    response_model=ChatbotOut,
    summary="챗봇 — [후보자명] 입력 시 관련 뉴스 감성분석",
    description=(
        "[후보자명] 형식으로 입력하면 해당 후보 관련 뉴스를 "
        "AI가 분석해서 감성점수와 주요 이벤트를 반환한다."
    ),
)
def chatbot(
    query: str = Query(
        ...,
        description="후보자명을 대괄호로 감싸서 입력. 예: [김부겸]"
    ),
    days:  int = Query(14, description="뉴스 수집 기간 (일)"),
    importance_threshold: int = Query(
        2, description="반환할 최소 중요도 (1~5)"
    ),
    db: Session = Depends(get_db),
):
    """
    사용 예시:
        GET /api/chatbot?query=[김부겸]
        GET /api/chatbot?query=[정원오]&days=7&importance_threshold=3
    """
    try:
        from app.services.ai_analyzer import chatbot_query
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="ai_analyzer 모듈 로드 실패. GEMINI_API_KEY 확인 필요."
        )

    # DB에서 해당 기간 뉴스 가져오기
    since = datetime.now() - timedelta(days=days)
    news_rows = (
        db.query(NewsSentiment)
        .filter(NewsSentiment.pub_date >= since)
        .order_by(NewsSentiment.pub_date.desc())
        .all()
    )

    # ai_analyzer 가 원하는 형식으로 변환
    news_list = [
        {
            "date":        r.pub_date.strftime("%Y-%m-%d") if r.pub_date else "",
            "title":       r.title or "",
            "content":     r.summary_3line or r.title or "",
            "url":         r.url or "",
            "candidate":   r.candidate or "",
        }
        for r in news_rows
    ]

    # DB에서 전체 후보자 목록 가져오기 (유효성 검사용)
    from app.models import Candidate
    candidate_names = [
        row.name for row in db.query(Candidate.name).distinct().all()
    ]

    # 챗봇 처리
    result = chatbot_query(
        user_input           = query,
        news_list            = news_list,
        candidate_list       = candidate_names,
        importance_threshold = importance_threshold,
    )

    return result