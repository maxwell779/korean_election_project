# PolyElection 2026 🗳️

> 공식 데이터(선관위) · 예측 데이터(폴리마켓) · 언론 데이터(네이버 뉴스)를 결합하여
> 유권자에게 왜곡 없는 입체적인 선거 정보를 제공하는 데이터 기반 선거 통합 분석 플랫폼

---

## 📌 프로젝트 개요

단순히 누가 1등인지를 보여주는 것을 넘어,
**"왜 이 후보의 당선 확률이 변하고 있는가?"** 에 대한 답을 데이터로 증명합니다.

| 데이터 | 출처 | 역할 |
|--------|------|------|
| 🏛️ 공식 후보자 정보 | 중앙선관위 API | 학력 · 경력 · 등록상태 |
| 📈 실시간 당선 확률 | 폴리마켓 Gamma API | 시장 참여자 예측치 |
| 📰 최신 뉴스 | 네이버 뉴스 API | 확률 변동 맥락 데이터 |
| 🤖 AI 분석 | Claude API | 감성점수 · 3줄 요약 |

---

## 🖥️ 주요 기능

- **전국 지도 인터랙션** — 지역 클릭 시 해당 선거구 데이터 즉시 렌더링
- **폴리마켓 확률 추이 차트** — 날짜별 당선 확률 변화 시각화
- **AI 뉴스 감성 분석** — 뉴스 기사 긍정/부정 점수화 및 3줄 요약
- **후보자 상세 패널** — 선관위 공식 학력·경력·등록상태 표시
- **자동 데이터 수집** — APScheduler로 30분~2시간마다 자동 업데이트

---

## 🖼️ 화면 (실제 구동 캡처)

**메인 대시보드** — 전국 지도·시도별 광역단체장 현황·뉴스 TOP5·PolyMarket 배팅액
![메인 대시보드](assets/app_main.png)

**PolyMarket 판세 예측** — 정당별 승리 확률·경합 지역·지역별 후보 상세
![PolyMarket 판세](assets/app_polymarket.png)

### 시스템 구조
<p>
<img src="assets/architecture.png" width="46%"/> <img src="assets/db_design.png" width="46%"/>
</p>
<p>
<img src="assets/fastapi_layers.png" width="46%"/> <img src="assets/data_integrity.png" width="46%"/>
</p>

> 시스템 아키텍처 · DB 설계(3테이블·인덱스 7개) · FastAPI 계층(Router·Service·Schema) · 영문↔한글 후보명 정합

---

## 🔧 백엔드 핵심 구현 & 트러블슈팅 (본인 담당)

### 아키텍처
- **FastAPI 6라우터 / 12엔드포인트** — Router · Service · Schema 3계층 분리, Pydantic 응답 스키마 7종
- **MySQL 3테이블 설계** — `candidates`(25컬럼) · `market_prices`(18, 영문/한글 이중 컬럼) · `news_sentiment`(16) + **인덱스 7개**(한글명 검색용 등)
- **수집 collectors 3종** — 선관위 XML(xmltodict · 17개 시도 × 선거 타입), Polymarket(11개 마켓), 네이버뉴스(trafilatura 본문 추출)
- **APScheduler 자동 수집** — 선관위 06시 · 폴리마켓 30분 · 뉴스 2시간 · 예비후보↔공식후보 등록개시일 기준 자동 전환
- **Docker Compose** — mysql(healthcheck) → backend → frontend 3서비스, 2명령 재현

### 트러블슈팅 (상황 → 해결)
| 문제 | 해결 |
|---|---|
| **영문(폴리마켓)↔한글(선관위) 후보명 불일치** (최대 난관) | EN_TO_KO 매핑 **155개** + DB 한글명 컬럼·인덱스 + 조회 시 한글 우선 + 정당 폴백 |
| **동명이인** (전국 9,343명 중 중복 다수) | `이름+선거구+선거타입+후보타입` **4필드 복합키 UPSERT** → **8,577명** 정확 식별 |
| Gemini Rate Limit(429) | 분석 5건 제한 + 4초 딜레이 + 기본값 폴백 |
| 외부 API 불안정 | timeout(10~15s) + 예외 처리 + 빈 결과 폴백(한 소스 실패해도 파이프라인 지속) |
| 팀 실행환경 불일치 | Docker Compose로 환경 통일("내 PC에선 됨" 제거) |

---

## 🛠️ 기술 스택

### Backend
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)

### Frontend
![React](https://img.shields.io/badge/React-18-61DAFB)
![Recharts](https://img.shields.io/badge/Recharts-2.x-blue)

### AI & API
![Claude](https://img.shields.io/badge/Claude-Sonnet-purple)
![Polymarket](https://img.shields.io/badge/Polymarket-Gamma_API-yellow)

### 배포
![AWS](https://img.shields.io/badge/AWS-EC2+RDS-FF9900)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

---

## 📁 프로젝트 구조

```
poly-election-2026/
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 진입점
│   │   ├── database.py          # MySQL 연결
│   │   ├── models.py            # DB 테이블 정의
│   │   ├── schemas.py           # API 응답 스키마
│   │   ├── collectors/          # 외부 API 수집
│   │   │   ├── nec.py           # 선관위 API
│   │   │   ├── polymarket.py    # 폴리마켓 API
│   │   │   └── naver_news.py    # 네이버 뉴스 API
│   │   ├── routers/             # FastAPI 엔드포인트
│   │   │   ├── regions.py
│   │   │   ├── candidates.py
│   │   │   ├── markets.py
│   │   │   ├── news.py
│   │   │   ├── analysis.py
│   │   │   └── dashboard.py
│   │   └── services/            # AI 분석
│   │       └── ai_analyzer.py
│   ├── scheduler.py             # 자동 수집 스케줄러
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   │   └── korea-map.svg
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/index.js
│   │   ├── components/
│   │   │   ├── KoreaMap.jsx
│   │   │   ├── TimelineChart.jsx
│   │   │   ├── CandidatePanel.jsx
│   │   │   └── AISummary.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       └── RegionDetail.jsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## ⚙️ 로컬 실행 방법

### 사전 준비
- Python 3.11 이상
- Node.js 18 이상
- MySQL 8.0 이상
- API 키 (선관위, 네이버, Claude)

### 1. 레포 클론

```bash
git clone https://github.com/유저명/poly-election-2026.git
cd poly-election-2026
```

### 2. 환경변수 설정

```bash
cd backend
cp .env.example .env
# .env 파일 열어서 API 키 입력
```

```env
NEC_API_KEY=발급받은키
NAVER_CLIENT_ID=발급받은키
NAVER_CLIENT_SECRET=발급받은키
ANTHROPIC_API_KEY=발급받은키
DB_HOST=localhost
DB_PORT=3306
DB_NAME=poly_election
DB_USER=root
DB_PASSWORD=비밀번호
```

### 3. 백엔드 실행

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# MySQL DB 생성
mysql -u root -p -e "CREATE DATABASE poly_election CHARACTER SET utf8mb4;"

# 서버 실행 (테이블 자동 생성)
uvicorn app.main:app --reload --port 8000
```

### 4. 프론트엔드 실행

```bash
cd frontend
npm install
npm start
```

### 5. 접속

```
백엔드 API 문서: http://localhost:8000/docs
프론트엔드:      http://localhost:3000
```

---

## 🗄️ DB 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `candidates` | 선관위 후보자 정보 (예비후보자 / 후보자) |
| `market_prices` | 폴리마켓 당선 확률 시계열 |
| `news_sentiment` | 네이버 뉴스 + AI 감성분석 결과 |

---

## 🔌 API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/dashboard/summary` | 전국 지도 초기 렌더링용 |
| GET | `/api/regions/{region}` | 지역별 종합 데이터 |
| GET | `/api/candidates/{region}` | 선관위 후보자 목록 |
| GET | `/api/markets/{region}/history` | 폴리마켓 확률 추이 |
| GET | `/api/news/{region}` | 관련 뉴스 목록 |
| GET | `/api/analysis/{region}` | AI 감성분석 결과 |

---

## ⏰ 자동 수집 스케줄

| 주기 | 대상 |
|------|------|
| 매일 06:00 | 선관위 후보자 정보 갱신 |
| 30분마다 | 폴리마켓 당선 확률 |
| 2시간마다 | 네이버 뉴스 수집 |
| 매일 08:00 | AI 감성분석 실행 |

---

## 👥 팀원 역할

| 파트 | 담당 | 핵심 작업 |
|------|------|-----------|
| A | **권효중(본인)** | 선관위·폴리마켓·뉴스 수집 collectors, APScheduler |
| B | **권효중(본인)** | FastAPI 6라우터·MySQL 3테이블 설계, Docker |
| C | 팀원 | Claude/Gemini 감성분석, 3줄 요약 |
| D | 팀원 | React 대시보드, 지도, 차트 |

> **본인(권효중) = 백엔드 전반** — 데이터 수집 파이프라인 · MySQL DB 설계(인덱스 7개) · FastAPI API(6라우터/12엔드포인트) · 자동 수집 스케줄러. 핵심 난제였던 **영문(폴리마켓)↔한글(선관위) 후보명 정합(매핑 155개)** 과 **동명이인 복합키 처리(9,343→8,577명)** 를 해결.

---

## 📅 개발 일정

| 주차 | 목표 |
|------|------|
| 1주차 | 데이터 수집 파이프라인 구축, DB 스키마 확정 |
| 2주차 | FastAPI 엔드포인트 완성, AI 분석 연동, 프론트 차트 연결 |
| 3주차 | AWS 배포, UI 완성, 통합 테스트, 발표 준비 |

---

## 📄 라이선스

이 프로젝트는 KDT 미니프로젝트 교육 목적으로 제작되었습니다.