from sqlalchemy import Column, Integer, String
try:
    from .database import Base
except ImportError:
    from database import Base


class Candidate(Base):
    """candidates 테이블 — 선관위 후보자 정보 (박건희 수집 담당)"""
    __tablename__ = "candidates"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(50),  nullable=False, index=True)
    party        = Column(String(50),  nullable=True)
    sd_name      = Column(String(50),  nullable=True, index=True)   # 시도명
    sgg_name     = Column(String(100), nullable=True)               # 시군구명
    sg_type_label = Column(String(50), nullable=True, index=True)   # 광역단체장 등
    career1      = Column(String(255), nullable=True)
    career2      = Column(String(255), nullable=True)
    reg_status   = Column(String(20),  nullable=True)               # 등록 / 예비후보 등
