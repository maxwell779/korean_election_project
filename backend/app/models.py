# backend/app/models.py
 
from sqlalchemy import (
    Column, Integer, String, Float,
    Text, DateTime, Enum,
    Index,
)
from datetime import datetime
from app.database import Base
 
 
class Candidate(Base):
    """선관위 후보자 정보"""
    __tablename__ = "candidates"
 
    id             = Column(Integer, primary_key=True, autoincrement=True)
    election_type  = Column(String(20))
    candidate_type = Column(String(10))
    sg_typecode    = Column(String(5))
    sg_type_label  = Column(String(30))
    sd_name        = Column(String(50))
    sgg_name       = Column(String(100))
    wiw_name       = Column(String(100))
    huboid         = Column(String(20))
    name           = Column(String(100), nullable=False)
    hanja_name     = Column(String(100))
    gender         = Column(String(5))
    birthday       = Column(String(20))
    age            = Column(String(5))
    addr           = Column(String(200))
    party          = Column(String(100))
    candidate_no   = Column(String(10))
    job            = Column(String(200))
    education      = Column(Text)
    career1        = Column(Text)
    career2        = Column(Text)
    reg_status     = Column(String(50))
    reg_date       = Column(String(20))
    fetched_at     = Column(DateTime, default=datetime.now)
    updated_at     = Column(DateTime, default=datetime.now, onupdate=datetime.now)
 
    __table_args__ = (
        Index("idx_candidate_region", "sd_name", "sg_typecode"),
        Index("idx_candidate_name",   "name"),
    )
 
 
class MarketPrice(Base):
    """폴리마켓 당선 확률 시계열"""
    __tablename__ = "market_prices"
 
    id               = Column(Integer, primary_key=True, autoincrement=True)
    region           = Column(String(50),  nullable=False)
    candidate        = Column(String(100), nullable=False)   # 영문 이름 (Chong Won-oh)
    candidate_ko     = Column(String(100), nullable=True)    # [수정] 한글 이름 (정원오)
    market_id        = Column(String(20))
    probability      = Column(Float, nullable=False)
    last_trade_price = Column(Float, default=0)
    amm_probability  = Column(Float, default=0)
    best_bid         = Column(Float, default=0)
    best_ask         = Column(Float, default=0)
    volume_24h       = Column(Float, default=0)
    volume_1wk       = Column(Float, default=0)
    volume_total     = Column(Float, default=0)
    liquidity        = Column(Float, default=0)
    price_change_1d  = Column(Float, default=0)
    price_change_1w  = Column(Float, default=0)
    price_change_1m  = Column(Float, default=0)
    fetched_at       = Column(DateTime, default=datetime.now, nullable=False)
 
    __table_args__ = (
        Index("idx_market_region_time",     "region",    "fetched_at"),
        Index("idx_market_candidate_time",  "candidate", "fetched_at"),
        # [수정] 한글명 검색 최적화
        Index("idx_market_candidate_ko",    "candidate_ko"),
    )
 
 
class NewsSentiment(Base):
    """네이버 뉴스 + AI 감성분석 결과"""
    __tablename__ = "news_sentiment"
 
    id              = Column(Integer, primary_key=True, autoincrement=True)
    candidate       = Column(String(100))
    region          = Column(String(50))
    category        = Column(String(30))
    title           = Column(String(500), nullable=False)
    url             = Column(Text)
    pub_date        = Column(DateTime)
    query_keyword   = Column(String(200))
    # 👇 [추가된 부분] 기사 본문 저장용 컬럼
    content         = Column(Text, nullable=True)
    sentiment       = Column(Enum("positive", "negative", "neutral"), nullable=True)
    sentiment_score = Column(Float,   nullable=True)
    summary_3line   = Column(Text,    nullable=True)
    analyzed_at     = Column(DateTime, nullable=True)
    importance      = Column(Integer, nullable=True)
    one_line        = Column(String(100), nullable=True)
    fetched_at      = Column(DateTime, default=datetime.now)
 
    __table_args__ = (
        Index("idx_news_candidate_date", "candidate", "pub_date"),
        Index("idx_news_region_date",    "region",    "pub_date"),
    )