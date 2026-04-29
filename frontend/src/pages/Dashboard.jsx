import { useState, useEffect } from 'react';
import KoreanMap from '../components/KoreanMap';
// ✅ [추가] API 함수 import — index.js에 이미 정의되어 있음
import { getNews, getDashboardSummary } from '../api/index';

// ✅ [변경 전] mock에서 NEWS, POLYMARKET import
// import { NEWS, POLYMARKET } from '../data/mock';

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
  // ✅ [추가] 실데이터 상태
  const [news,        setNews]        = useState([]);
  const [polymarket,  setPolymarket]  = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [polyLoading, setPolyLoading] = useState(true);

  // ✅ [추가] 뉴스 API 호출 (섹션 3) — 전국 공통 뉴스 최신 5건
  useEffect(() => {
    setNewsLoading(true);
    getNews('전국')
      .then(data => setNews(data.slice(0, 5)))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, []);

  // ✅ [추가] 폴리마켓 API 호출 (섹션 4) — dashboard/summary에서 확률 데이터 추출
  useEffect(() => {
    setPolyLoading(true);
    getDashboardSummary()
      .then(data => {
        // 확률 높은 순으로 정렬, 상위 5개
        const sorted = [...data]
          .sort((a, b) => b.probability_pct - a.probability_pct)
          .slice(0, 5);
        setPolymarket(sorted);
      })
      .catch(() => setPolymarket([]))
      .finally(() => setPolyLoading(false));
  }, []);

  // ✅ [변경] pub_date를 상대시간으로 변환하는 헬퍼
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
      {/* 섹션 1: 요약 통계 */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-label"><span className="section-number">1</span>전체 선거 데이터 요약</div>
        <div className="card-grid-4">
          {[
            { label: '총 선출직 수',   value: '4,450', sub: '광역·기초·의회·교육감 전체 합산' },
            { label: '전체 후보 인원', value: '8,578', sub: '2026-04-28 선관위 등록 기준' },
            { label: '여성 후보 비율', value: '24%',   sub: '전회 대비', badge: '▲ +2%p' },
            { label: '후보 평균 연령', value: '54.2세', sub: '최연소 29세 · 최연장 83세' },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
              {s.badge && <div className="stat-badge up">{s.badge}</div>}
            </div>
          ))}
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

        {/* ✅ [변경] 섹션 3 — mock NEWS → API 실데이터 */}
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
                    {/* ✅ candidate(후보자명) + timeAgo(pub_date) 표시 */}
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

        {/* ✅ [변경] 섹션 4 — mock POLYMARKET → getDashboardSummary 실데이터 */}
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
                    {/* ✅ top_candidate_ko(한글 후보명) + region 표시 */}
                    <div className="poly-title">{p.region} {p.top_candidate_ko}</div>
                    <div className="poly-volume">
                      {p.top_party && <span style={{ fontSize: 11, color: '#888' }}>{p.top_party}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div className={`poly-pct ${p.probability_pct >= 60 ? 'high' : p.probability_pct >= 40 ? 'mid' : 'low'}`}>
                      {p.probability_pct}%
                    </div>
                    {/* ✅ price_change_1d 실데이터 */}
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
