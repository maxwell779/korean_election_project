# backend/app/routers/regions.py
 
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
 
from app.database import get_db
from app.models import MarketPrice, Candidate, NewsSentiment
from app.schemas import (
    RegionSummaryOut, RegionDetailOut,
    CandidateOut, MarketPriceOut, NewsOut,
)
 
router = APIRouter()
 
SUPPORTED_REGIONS = [
    "서울", "부산", "대구", "인천", "대전",
    "울산", "세종", "경기", "강원", "충북",
    "충남", "전남광주",
]

REGION_TO_SD = {
    "서울":     "서울특별시",
    "부산":     "부산광역시",
    "대구":     "대구광역시",
    "인천":     "인천광역시",
    "대전":     "대전광역시",
    "울산":     "울산광역시",
    "세종":     "세종특별자치시",
    "경기":     "경기도",
    "강원":     "강원특별자치도",
    "충북":     "충청북도",
    "충남":     "충청남도",
    "전남광주": "전라남도",
}

# Candidate 테이블 조회 실패 시 사용하는 정당 폴백
CANDIDATE_PARTY_FALLBACK = {
    "정원오": "더불어민주당",
    "전재수": "더불어민주당",
    "추경호": "국민의힘",
    "박찬대": "더불어민주당",
    "허태정": "더불어민주당",
    "김상욱": "더불어민주당",
    "조상호": "더불어민주당",
    "우상호": "더불어민주당",
    "추미애": "더불어민주당",
    "신용한": "국민의힘",
    "박수현": "더불어민주당",
    "민형배": "더불어민주당",
}


def _get_top_market(region: str, db: Session):
    """해당 지역 확률 1위 후보 MarketPrice row 반환"""
    subq = (
        db.query(
            MarketPrice.candidate,
            func.max(MarketPrice.fetched_at).label("latest"),
        )
        .filter(MarketPrice.region == region)
        .group_by(MarketPrice.candidate)
        .subquery()
    )
    return (
        db.query(MarketPrice)
        .join(
            subq,
            (MarketPrice.candidate  == subq.c.candidate) &
            (MarketPrice.fetched_at == subq.c.latest),
        )
        .filter(MarketPrice.region == region)
        .order_by(MarketPrice.probability.desc())
        .first()
    )
 
 
@router.get(
    "/regions",
    response_model=list[RegionSummaryOut],
    summary="전국 지역 목록 + 1위 후보 현황",
)
def get_regions(db: Session = Depends(get_db)):
    result = []
 
    for region in SUPPORTED_REGIONS:
        top = _get_top_market(region, db)
        if not top:
            continue
 
        sd_name      = REGION_TO_SD.get(region, "")
        # [수정] candidate_ko(한글명)로 선관위 DB 조회 → 정당 정보 정확하게 가져옴
        candidate_ko = top.candidate_ko or top.candidate
 
        cdd = (
            db.query(Candidate)
            .filter(
                Candidate.sd_name       == sd_name,
                Candidate.sg_type_label == "광역단체장",
                Candidate.name          == candidate_ko,
            )
            .first()
        )

        top_party = (cdd.party if cdd else None) or CANDIDATE_PARTY_FALLBACK.get(candidate_ko)

        result.append(
            RegionSummaryOut(
                region           = region,
                top_candidate    = top.candidate,
                top_candidate_ko = candidate_ko,
                top_party        = top_party,
                probability      = top.probability,
                probability_pct  = round(top.probability * 100, 2),
                price_change_1d  = top.price_change_1d,
            )
        )
 
    return result
 
 
@router.get(
    "/regions/{region}",
    response_model=RegionDetailOut,
    summary="지역 상세 데이터 (지도 클릭용)",
)
def get_region_detail(region: str, db: Session = Depends(get_db)):
    if region not in SUPPORTED_REGIONS:
        raise HTTPException(
            status_code=404,
            detail=f"'{region}' 은 지원하지 않는 지역입니다. 지원 지역: {SUPPORTED_REGIONS}"
        )
 
    sd_name = REGION_TO_SD.get(region, region)
 
    # 1. 후보자 목록
    candidates = (
        db.query(Candidate)
        .filter(
            Candidate.sd_name       == sd_name,
            Candidate.sg_type_label == "광역단체장",
            Candidate.reg_status    != "사퇴",
            Candidate.reg_status    != "등록무효",
        )
        .order_by(Candidate.name)
        .all()
    )
 
    # 2. 최신 폴리마켓 확률
    subq = (
        db.query(
            MarketPrice.candidate,
            func.max(MarketPrice.fetched_at).label("latest"),
        )
        .filter(MarketPrice.region == region)
        .group_by(MarketPrice.candidate)
        .subquery()
    )
 
    markets = (
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
 
    market_out = [
        MarketPriceOut(
            region          = m.region,
            candidate       = m.candidate,
            candidate_ko    = m.candidate_ko,              # [수정] 한글명 포함
            probability     = m.probability,
            probability_pct = round(m.probability * 100, 2),
            volume_24h      = m.volume_24h or 0,
            price_change_1d = m.price_change_1d or 0,
            price_change_1w = m.price_change_1w or 0,
            fetched_at      = m.fetched_at,
        )
        for m in markets
    ]
 
    # 3. 최신 뉴스 5건
    latest_news = (
        db.query(NewsSentiment)
        .filter(NewsSentiment.region == region)
        .order_by(NewsSentiment.pub_date.desc())
        .limit(5)
        .all()
    )
 
    return RegionDetailOut(
        region      = region,
        candidates  = candidates,
        markets     = market_out,
        latest_news = latest_news,
        analysis    = None, # 프론트엔드에서 /analysis 엔드포인트로 별도 호출하도록 유지
    )