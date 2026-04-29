# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, check_connection
from app.routers import regions
from app.routers import candidates
from app.routers import markets
from app.routers import news
from app.routers import analysis
from app.routers import dashboard

# ─────────────────────────────────────────────
# FastAPI 앱 생성
# ─────────────────────────────────────────────
app = FastAPI(
    title       = "PolyElection 2026 API",
    description = "2026 지방선거 데이터 통합 분석 플랫폼",
    version     = "1.0.0",
    docs_url    = "/docs",    # Swagger UI: http://localhost:8000/docs
    redoc_url   = "/redoc",   # ReDoc:      http://localhost:8000/redoc
)


# ─────────────────────────────────────────────
# CORS 설정
# React(3000포트) ↔ FastAPI(8000포트) 통신 허용
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # React 개발 서버
        "http://127.0.0.1:3000",
        # 배포 후 도메인 추가 예: "https://poly-election.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# 라우터 등록
# prefix="/api" → 모든 엔드포인트는 /api/... 로 시작
# ─────────────────────────────────────────────
app.include_router(regions.router,    prefix="/api", tags=["지역"])
app.include_router(candidates.router, prefix="/api", tags=["후보자"])
app.include_router(markets.router,    prefix="/api", tags=["폴리마켓"])
app.include_router(news.router,       prefix="/api", tags=["뉴스"])
app.include_router(analysis.router, prefix="/api", tags=["AI 분석 · 챗봇"])
app.include_router(dashboard.router,  prefix="/api", tags=["대시보드"])


# ─────────────────────────────────────────────
# 서버 시작 이벤트
# ─────────────────────────────────────────────
@app.on_event("startup")
def startup():
    """
    서버 시작 시 자동 실행.
    1. DB 테이블 생성 (없으면 자동 생성)
    2. 스케줄러 시작 (scheduler.py 연동 시 활성화)
    """
    print("[서버 시작] DB 초기화 중...")
    init_db()

    # 스케줄러 시작 (scheduler.py 작성 후 주석 해제)
    from scheduler import scheduler
    scheduler.start()
    # print("[서버 시작] 스케줄러 시작 완료")


@app.on_event("shutdown")
def shutdown():
    """서버 종료 시 스케줄러 정리"""
    # from scheduler import scheduler
    # scheduler.shutdown()
    print("[서버 종료]")


# ─────────────────────────────────────────────
# 기본 엔드포인트
# ─────────────────────────────────────────────
@app.get("/health", tags=["시스템"])
def health_check():
    """
    서버 + DB 연결 상태 확인.
    배포 후 모니터링용.
    """
    db_ok = check_connection()
    return {
        "status":  "ok",
        "db":      "connected" if db_ok else "disconnected",
        "service": "PolyElection 2026",
    }


@app.get("/", tags=["시스템"])
def root():
    return {
        "message": "PolyElection 2026 API",
        "docs":    "/docs",
        "health":  "/health",
    }