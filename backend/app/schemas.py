# backend/app/schemas.py
 
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
 
 
# ─────────────────────────────────────────────
# 1. 후보자 (선관위)
# ─────────────────────────────────────────────
class CandidateOut(BaseModel):
    id:             int
    name:           str
    party:          Optional[str] = None
    sg_type_label:  Optional[str] = None
    election_type:  Optional[str] = None
    candidate_type: Optional[str] = None
    sd_name:        Optional[str] = None
    sgg_name:       Optional[str] = None
    wiw_name:       Optional[str] = None
    gender:         Optional[str] = None
    age:            Optional[str] = None
    job:            Optional[str] = None
    education:      Optional[str] = None
    career1:        Optional[str] = None
    career2:        Optional[str] = None
    reg_status:     Optional[str] = None
    candidate_no:   Optional[str] = None
 
    class Config:
        from_attributes = True
 
 
# ─────────────────────────────────────────────
# 2. 폴리마켓 확률
# ─────────────────────────────────────────────
class MarketPriceOut(BaseModel):
    region:           str
    candidate:        str
    candidate_ko:     Optional[str] = None   # [수정] 한글명 추가
    probability:      float
    probability_pct:  float
    volume_24h:       float
    price_change_1d:  float
    price_change_1w:  float
    fetched_at:       datetime
 
    class Config:
        from_attributes = True
 
 
class MarketHistoryOut(BaseModel):
    date:             str
    probability:      float
    probability_pct:  float
 
 
# ─────────────────────────────────────────────
# 3. 뉴스
# ─────────────────────────────────────────────
class NewsOut(BaseModel):
    id:              int
    title:           str
    url:             Optional[str]     = None
    candidate:       Optional[str]     = None
    region:          Optional[str]     = None
    sentiment:       Optional[str]     = None
    sentiment_score: Optional[float]   = None
    summary_3line:   Optional[str]     = None
    pub_date:        Optional[datetime] = None
 
    class Config:
        from_attributes = True
 
 
# ─────────────────────────────────────────────
# 4. AI 분석 결과
# [수정] 중복 정의 제거 — importance, one_line 포함한 버전 하나만 유지
# ─────────────────────────────────────────────
class AnalysisOut(BaseModel):
    candidate:       str
    region:          Optional[str]     = None
    sentiment:       Optional[str]     = None
    sentiment_score: Optional[float]   = None
    summary_3line:   Optional[str]     = None
    analyzed_at:     Optional[datetime] = None
    importance:      Optional[int]     = None   # 1~5
    one_line:        Optional[str]     = None   # 차트 마커용 요약
 
    class Config:
        from_attributes = True
 
 
# ─────────────────────────────────────────────
# 5. 지역 요약 (지도용)
# ─────────────────────────────────────────────
class RegionSummaryOut(BaseModel):
    region:          str
    top_candidate:   str
    top_candidate_ko: Optional[str]  = None   # [수정] 한글명 추가
    top_party:       Optional[str]   = None
    probability:     float
    probability_pct: float
    price_change_1d: Optional[float] = None
 
 
class RegionDetailOut(BaseModel):
    region:      str
    candidates:  list[CandidateOut]
    markets:     list[MarketPriceOut]
    latest_news: list[NewsOut]
    analysis:    Optional[AnalysisOut] = None
 
 
# ─────────────────────────────────────────────
# 6. 챗봇
# ─────────────────────────────────────────────
class ChatbotEventOut(BaseModel):
    date:            str
    candidate:       str
    title:           str
    url:             Optional[str] = None
    sentiment_score: float
    sentiment_label: str
    importance:      int
    one_line:        str
    summary:         str
 
 
class ChatbotOut(BaseModel):
    candidate:          Optional[str]        = None
    found:              bool
    pre_filtered_count: int
    analyzed_count:     int
    events:             list[ChatbotEventOut]
    message:            str
 
 
# ─────────────────────────────────────────────
# 7. 공통
# ─────────────────────────────────────────────
class HealthOut(BaseModel):
    status:  str
    db:      str
    service: str