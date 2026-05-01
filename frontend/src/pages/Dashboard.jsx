import { useState, useEffect } from 'react';
import KoreanMap from '../components/KoreanMap';
import { getNews, getDashboardSummary } from '../api/index';

const ALL_REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];

// ✅ [추가] DB에 아직 등록되지 않은 유력 후보들의 정당 매핑 (PolyMarketPage와 동일)
const CANDIDATE_PARTY_MAP = {
  '정원오': '더불어민주당', '오세훈': '국민의힘', '박형준': '국민의힘',
  '전재수': '더불어민주당', '김동연': '더불어민주당', '추미애': '더불어민주당',
  '신용한': '더불어민주당', '김영환': '국민의힘', '박수현': '더불어민주당',
  '김태흠': '국민의힘', '우상호': '더불어민주당', '김진태': '국민의힘',
  '민형배': '더불어민주당', '허태정': '더불어민주당', '이장우': '국민의힘',
  '홍준표': '국민의힘', '조경태': '국민의힘', '안철수': '국민의힘',
  '나경원': '국민의힘', '한동훈': '국민의힘', '조국': '조국혁신당',
  '이재명': '더불어민주당',
  // 영문명
  'Chong Won-oh': '더불어민주당', 'Oh Se-hoon': '국민의힘', 'Park Heong-joon': '국민의힘',
  'Chun Jae-soo': '더불어민주당', 'Kim Dong-yeon': '더불어민주당', 'Choo Mi-ae': '더불어민주당',
  'Shin Yong-han': '더불어민주당', 'Kim Young-hwan': '국민의힘', 'Park Soo-hyun': '더불어민주당',
  'Kim Tae-heum': '국민의힘', 'Woo Sang-ho': '더불어민주당', 'Kim Jin-tae': '국민의힘',
  'Min Hyung-bae': '더불어민주당', 'Huh Tae-jung': '더불어민주당', 'Lee Jang-woo': '국민의힘'
};

function VoteStats({ isLive }) {
  const parties = [
    { name: '민주당',   color: '#1A5DC8', seats: isLive ? 152 : 0, total: 245 },
    { name: '국민의힘', color: '#E03030', seats: isLive ? 86  : 0, total: 245 },
    { name: '기타',     color: '#B8C0CC', seats: isLive ? 7   : 0, total: 245 },
  ];
  return (
    <div className="card" style={{ padding: 0, marginBottom: 14 }}>
      <div className="vote-stats-row">
        <div className="vote-stat-block">
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 500 }}>전국 투표율</div>
          {isLive ? (
            <>
              <div className="vote-big blue">61.4%</div>
              <div className="vote-prog-bar"><div className="vote-prog-fill blue" style={{ width: '61.4%' }} /></div>
              <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>목표 70% 대비</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#AAA', fontStyle: 'italic', paddingTop: 12 }}>투표가 실시되기 전입니다.</div>
          )}
        </div>
        <div className="vote-stat-block">
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 500 }}>개표율</div>
          {isLive ? (
            <>
              <div className="vote-big green">43.2%</div>
              <div className="vote-prog-bar"><div className="vote-prog-fill green" style={{ width: '43.2%' }} /></div>
              <div className="realtime-tag active"><div className="realtime-dot active" />실시간 업데이트</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#AAA', fontStyle: 'italic', paddingTop: 12 }}>개표가 실시되기 전입니다.</div>
          )}
        </div>
        <div className="vote-stat-block">
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 500 }}>정당별 당선 현황</div>
          <div className="party-result-bar">
            {parties.map(p => {
              const pct = p.total ? Math.round((p.seats / p.total) * 100) : 0;
              return (
                <div key={p.name} className="party-bar-row">
                  <div className="party-dot" style={{ background: p.color }} />
                  <div className="party-name-sm">{p.name}</div>
                  <div className="party-bar-track"><div className="party-bar-fill" style={{ width: `${pct}%`, background: p.color }} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, minWidth: 72 }}>
                    <div className="party-pct" style={{ color: p.color }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: '#BBB', whiteSpace: 'nowrap' }}>{p.seats}/{p.total}석</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ isLive }) {
  const [news,        setNews]        = useState([]);
  const [polymarket,  setPolymarket]  = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [polyLoading, setPolyLoading] = useState(true);

  // 전체 선거 통계 & 판세 상태
  const [candStats, setCandStats] = useState({ total: 0, avgAge: 0, femalePct: 0 });
  const [winStats,  setWinStats]  = useState({ blue: 0, red: 0 });

  useEffect(() => {
    setNewsLoading(true);
    getNews('전국')
      .then(data => {
        const shuffled = data.sort(() => 0.5 - Math.random());
        setNews(shuffled.slice(0, 5));
      })
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, []);

  useEffect(() => {
    setPolyLoading(true);
    getDashboardSummary()
      .then(data => {
        // ✅ [수정] 폴리마켓 데이터로 정당별 예상 우세 지역 계산 (매핑 적용)
        let blue = 0;
        let red = 0;
        data.forEach(d => {
           // DB에서 온 정당 정보가 없으면 하드코딩 매핑에서 가져옴!
           const party = d.top_party || CANDIDATE_PARTY_MAP[d.top_candidate_ko] || CANDIDATE_PARTY_MAP[d.top_candidate];
           
           if (party === '더불어민주당') blue++;
           if (party === '국민의힘') red++;
        });
        setWinStats({ blue, red });

        const sorted = [...data]
          .sort((a, b) => b.probability_pct - a.probability_pct)
          .slice(0, 5);
        setPolymarket(sorted);
      })
      .catch(() => setPolymarket([]))
      .finally(() => setPolyLoading(false));
  }, []);

  useEffect(() => {
    Promise.all(ALL_REGIONS.map(r =>
      fetch(`/api/candidates/${encodeURIComponent(r)}?sg_type_label=광역단체장`).then(res => res.json())
    ))
    .then(results => {
      const all = results.flat();
      let totalAge = 0;
      let validAge = 0;
      let femaleCount = 0;
      all.forEach(c => {
        if (c.gender === '여') femaleCount++;
        const age = parseInt(c.age);
        if (!isNaN(age)) { totalAge += age; validAge++; }
      });
      setCandStats({
        total: all.length,
        femalePct: all.length > 0 ? Math.round((femaleCount / all.length) * 100) : 0,
        avgAge: validAge > 0 ? (totalAge / validAge).toFixed(1) : 0
      });
    })
    .catch(err => console.error(err));
  }, []);

  function timeAgo(pubDate) {
    if (!pubDate) return '';
    const diff = Date.now() - new Date(pubDate).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '방금 전';
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  }

  return (
    <div>
      {/* 섹션 1: 요약 통계 (실데이터 및 판세 반영) */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label"><span className="section-number">1</span>전체 선거 데이터 요약 (광역단체장 기준)</div>
        <div className="card-grid-4">
          <div className="stat-card">
            <div className="stat-label">등록 후보 인원</div>
            <div className="stat-value">{candStats.total > 0 ? `${candStats.total}명` : '로딩중'}</div>
            <div className="stat-sub">전국 17개 시도 기준</div>
          </div>
          <div className="stat-card" style={{ border: '2px solid #1A5DC8', background: '#F7FAFF' }}>
            <div className="stat-label" style={{ color: '#1A5DC8', fontWeight: 700 }}>민주당 우세 예상</div>
            <div className="stat-value" style={{ color: '#1A5DC8' }}>{polyLoading ? '-' : winStats.blue}곳</div>
            <div className="stat-sub" style={{ color: '#1A5DC8' }}>PolyMarket 확률 1위 기준</div>
          </div>
          <div className="stat-card" style={{ border: '2px solid #E03030', background: '#FFF7F7' }}>
            <div className="stat-label" style={{ color: '#E03030', fontWeight: 700 }}>국민의힘 우세 예상</div>
            <div className="stat-value" style={{ color: '#E03030' }}>{polyLoading ? '-' : winStats.red}곳</div>
            <div className="stat-sub" style={{ color: '#E03030' }}>PolyMarket 확률 1위 기준</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">후보 평균 연령</div>
            <div className="stat-value">{candStats.avgAge > 0 ? `${candStats.avgAge}세` : '로딩중'}</div>
            <div className="stat-sub">여성 후보 비율 {candStats.femalePct}%</div>
          </div>
        </div>
      </div>

      {/* 섹션 2: 투표율 + 지도 */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label"><span className="section-number">2</span>투표율 · 개표율 · 지역별 당선 현황</div>
        <VoteStats isLive={isLive} />
        <KoreanMap isLive={isLive} />
      </div>

      {/* 섹션 3+4: 뉴스 + 폴리마켓 */}
      <div className="two-col">
        <div>
          <div className="section-label"><span className="section-number">3</span>오늘의 주요 선거 뉴스 TOP 5</div>
          <div className="card">
            {newsLoading ? (
              <div style={{ textAlign: 'center', color: '#AAA', padding: 24, fontSize: 13 }}>뉴스 불러오는 중...</div>
            ) : news.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#AAA', padding: 24, fontSize: 13 }}>뉴스 데이터가 없습니다.</div>
            ) : (
              news.map((n, i) => (
                <div className="news-item" key={i} onClick={() => n.url && window.open(n.url, '_blank')}>
                  <div className={`news-rank ${i < 2 ? 'top' : ''}`}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div className="news-title">{n.title}</div>
                    <div className="news-meta">
                      {n.candidate && `${n.candidate} · `}{timeAgo(n.pub_date)}
                    </div>
                  </div>
                  <span style={{ color: '#CCC', fontSize: 14, alignSelf: 'center' }}>›</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="section-label"><span className="section-number">4</span>Polymarket 당선 확률 Top 5</div>
          <div className="card">
            {polyLoading ? (
              <div style={{ textAlign: 'center', color: '#AAA', padding: 24, fontSize: 13 }}>데이터 불러오는 중...</div>
            ) : polymarket.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#AAA', padding: 24, fontSize: 13 }}>폴리마켓 데이터가 없습니다.</div>
            ) : (
              polymarket.map((p, i) => (
                <div className="poly-item" key={i}>
                  <div style={{ flex: 1 }}>
                    <div className="poly-title">{p.region} {p.top_candidate_ko}</div>
                    <div className="poly-volume">
                      {p.top_party && <span style={{ fontSize: 11, color: '#888' }}>{p.top_party}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div className={`poly-pct ${p.probability_pct >= 60 ? 'high' : p.probability_pct >= 40 ? 'mid' : 'low'}`}>
                      {p.probability_pct}%
                    </div>
                    {p.price_change_1d != null && (
                      <div className={`poly-change ${p.price_change_1d > 0 ? 'up' : p.price_change_1d < 0 ? 'down' : 'flat'}`}>
                        {p.price_change_1d > 0 ? '▲' : p.price_change_1d < 0 ? '▼' : '—'}{' '}
                        {p.price_change_1d !== 0 ? `${Math.abs(p.price_change_1d * 100).toFixed(1)}%` : '변동없음'}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F0F2F5', fontSize: 11, color: '#AAA', textAlign: 'right' }}>
              Polymarket.com 기반 · 투자 권유 아님
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}