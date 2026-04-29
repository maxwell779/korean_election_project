# backend/app/database.py

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

# ── DB 연결 URL 조립
DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_NAME     = os.getenv("DB_NAME",     "poly_election")

DB_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?charset=utf8mb4"
)

# ── SQLAlchemy 엔진 생성
engine = create_engine(
    DB_URL,
    echo=False,          # True 로 바꾸면 SQL 로그 출력 (디버깅용)
    pool_pre_ping=True,  # 연결 끊김 자동 복구
    pool_recycle=3600,   # 1시간마다 커넥션 갱신
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# ─────────────────────────────────────────────
# FastAPI 엔드포인트에서 DB 세션 주입용
# ─────────────────────────────────────────────
def get_db():
    """
    FastAPI Depends() 로 사용.
    요청마다 세션을 열고, 완료 후 자동으로 닫는다.

    사용법:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# 서버 시작 시 테이블 자동 생성
# ─────────────────────────────────────────────
def init_db():
    """
    main.py startup 이벤트에서 호출.
    models.py 에 정의된 테이블이 없으면 자동 생성.
    """
    from app.models import Base  # 순환 import 방지를 위해 여기서 import
    Base.metadata.create_all(bind=engine)
    print("[DB] 테이블 초기화 완료")


# ─────────────────────────────────────────────
# 연결 상태 확인용
# ─────────────────────────────────────────────
def check_connection() -> bool:
    """DB 연결 정상 여부 확인 — /health 엔드포인트에서 사용"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[DB] 연결 실패: {e}")
        return False