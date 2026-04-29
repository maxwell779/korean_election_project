# backend/scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@scheduler.scheduled_job("cron", hour=6, minute=0)
async def job_nec():
    """매일 06:00 — 선관위 후보자 수집"""
    from app.collectors.nec import fetch_nec_data, save_candidates_to_db
    print("[스케줄러] 선관위 수집 시작")
    candidates = fetch_nec_data()
    save_candidates_to_db(candidates)


@scheduler.scheduled_job("interval", minutes=30)
async def job_polymarket():
    """30분마다 — 폴리마켓 확률 수집"""
    from app.collectors.polymarket import fetch_all_korea_markets, save_market_prices_to_db
    print("[스케줄러] 폴리마켓 수집 시작")
    data = fetch_all_korea_markets()
    save_market_prices_to_db(data)


@scheduler.scheduled_job("interval", hours=2)
async def job_naver_news():
    """2시간마다 — 네이버 뉴스 수집"""
    from app.collectors.naver_news import fetch_election_news, save_news_to_db
    print("[스케줄러] 네이버 뉴스 수집 시작")
    news = fetch_election_news()
    save_news_to_db(news)


@scheduler.scheduled_job("cron", hour=8, minute=0)
async def job_ai_analysis():
    """매일 08:00 — AI 감성분석"""
    print("[스케줄러] AI 분석 시작 (미구현 — 파트 C 연동 후 활성화)")
    # from app.services.ai_analyzer import ...