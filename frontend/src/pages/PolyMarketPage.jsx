import { useState, useEffect } from 'react';
// ✅ [추가] API 함수 import
import { getDashboardSummary } from '../api/index';

// ✅ [변경 전] 모든 데이터 하드코딩
// const ALL_BETS = [ { cat: '전국 통계', title: '민주당 광역단체장 과반...' ... } ]

// ✅ [변경 후] 폴리마켓 지원 지역 목록 (markets API에 데이터 있는 지역)
const SUPPORTED_REGIONS = ['서울', '부산', '경기', '충북', '충남', '강원', '전남광주', '대전', '대구'];

const CAT_COLOR = {
  '서울': '#0D1B3E', '부산': '#E03030', '경기': '#1A5DC8',
  '대구': '#8B0000', '대전': '#1A8C60', '전남광주': '#D06010',
  '충북': '#5A70D0', '충남': '#7A40B0', '강원': '#2A7A5A',
};

function PctBar({ pct }) {
  const color = pct >= 60 ? '#1A9C4E' : pct >= 40 ? '#D06010' : '#E03030';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, height: 6, background: '#F0F2F5', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function ChangeTag({ change }) {
  if (change == null || change === 0) return <span style={{ fontSize: 12, color: '#AAA' }}>— 변동없음</span>;
  const pct   = (change * 100).toFixed(1);
  const color = change > 0 ? '#1A9C4E' : '#E03030';
  const arrow = change > 0 ? '▲' : '▼';
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{arrow} {Math.abs(pct)}%p</span>;
}

export default function PolyMarketPage() {
  // ✅ [추가] 실데이터 상태
  const [regionData, setRegionData] = useState({}); // { '서울': MarketPriceOut[], ... }
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ✅ [추가] 각 지역별 markets API 호출
  useEffect(() => {
    setLoading(true);
    Promise.all(
      SUPPORTED_REGIONS.map(region =>
        fetch(`/api/markets/${encodeURIComponent(region)}`)
          .then(res => res.ok ? res.json() : [])
          .then(data => ({ region, data }))
          .catch(() => ({ region, data: [] }))
      )
    )
      .then(results => {
        const map = {};
        results.forEach(({ region, data }) => { map[region] = data; });
        setRegionData(map);
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  // ✅ [변경] 요약 통계 — 실데이터 기반
  const allMarkets = Object.values(regionData).flat();
  const totalBets  = allMarkets.length;
  const avgPct     = totalBets > 0
    ? Math.round(allMarkets.reduce((s, m) => s + m.probability_pct, 0) / totalBets)
    : 0;
  const highPct    = allMarkets.filter(m => m.probability_pct >= 60).length;
  const lowPct     = allMarkets.filter(m => m.probability_pct < 40).length;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>PolyMarket 선거 베팅 현황</div>
          <div style={{ fontSize: 12, color: '#AAA', marginTop: 3 }}>2026 지방선거 관련 예측 시장 · 정보 제공 전용</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {/* ✅ [변경] 지원 지역 수 표시 */}
          <div style={{ fontSize: 11, color: '#AAA', marginBottom: 3 }}>지원 지역</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0D1B3E', letterSpacing: '-0.03em' }}>
            {SUPPORTED_REGIONS.length}개
          </div>
        </div>
      </div>

      {/* ✅ [변경] 요약 카드 — 실데이터 기반 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: '전체 후보 수',    v: loading ? '—' : totalBets, unit: '명',  c: '#0D1B3E' },
          { l: '평균 당선 확률',  v: loading ? '—' : avgPct,   unit: '%',   c: '#1A9C4E' },
          { l: '확률 60% 이상',   v: loading ? '—' : highPct,  unit: '명',  c: '#1A5DC8' },
          { l: '확률 40% 미만',   v: loading ? '—' : lowPct,   unit: '명',  c: '#E03030' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
              {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#AAA', padding: 40, fontSize: 14 }}>
          데이터 불러오는 중...
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 16px', background: '#FEF0F0', borderRadius: 8, color: '#E03030', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ✅ [변경] 지역별 후보 목록 — API 실데이터 */}
      {!loading && SUPPORTED_REGIONS.map(region => {
        const markets = regionData[region] || [];
        if (markets.length === 0) return null;
        return (
          <div key={region} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: CAT_COLOR[region] || '#888', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>{region}</span>
              <span style={{ fontSize: 11, color: '#AAA' }}>{markets.length}명 후보</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {markets.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', borderBottom: i < markets.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
                  {/* ✅ candidate_ko(한글명) 표시 */}
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[region] || '#888', marginRight: 7, verticalAlign: 'middle' }} />
                    {m.candidate_ko || m.candidate}
                    <span style={{ fontSize: 11, color: '#AAA', fontWeight: 400, marginLeft: 6 }}>({m.candidate})</span>
                  </div>

                  {/* 확률 막대 */}
                  <PctBar pct={m.probability_pct} />

                  {/* 1일 변동 */}
                  <div style={{ minWidth: 72, textAlign: 'right' }}>
                    <ChangeTag change={m.price_change_1d} />
                  </div>

                  {/* 24h 거래량 */}
                  <div style={{ minWidth: 72, textAlign: 'right', fontSize: 12, color: '#888', fontWeight: 600 }}>
                    ${m.volume_24h?.toLocaleString('en', { maximumFractionDigits: 0 }) ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 6, padding: '12px 16px', background: '#FFFBE8', borderRadius: 8, border: '1px solid #F5E080', fontSize: 12, color: '#8A6A00' }}>
        ⚠️ 본 페이지는 Polymarket.com 데이터를 기반으로 한 정보 제공 전용입니다. 투자 권유나 베팅 기능을 제공하지 않습니다.
      </div>
    </div>
  );
}
