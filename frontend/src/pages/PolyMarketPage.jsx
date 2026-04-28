// PolyMarket 정보 탭 — 이번 선거 관련 베팅 정보 (정보 제공 전용, 베팅 기능 없음)

const ALL_BETS = [
  // ── 전국 통계 ──────────────────────────────────────────────────────────────
  { cat: '전국 통계', title: '민주당 광역단체장 과반(9석 이상) 달성', pct: 68, change: +5, vol: '$2.4M', dir: 'up' },
  { cat: '전국 통계', title: '전국 최종 투표율 60% 초과', pct: 81, change: +3, vol: '$1.8M', dir: 'up' },
  { cat: '전국 통계', title: '국민의힘 수도권 1석 이상 확보', pct: 41, change: -6, vol: '$1.2M', dir: 'down' },
  { cat: '전국 통계', title: '제3지대 정당 광역단체장 1석 이상 당선', pct: 18, change: +2, vol: '$0.8M', dir: 'up' },
  { cat: '전국 통계', title: '무소속 후보 광역단체장 1명 이상 당선', pct: 34, change: 0,  vol: '$0.5M', dir: 'flat' },

  // ── 수도권 ─────────────────────────────────────────────────────────────────
  { cat: '수도권',    title: '서울 민주당 후보 당선', pct: 62, change: +4, vol: '$3.1M', dir: 'up' },
  { cat: '수도권',    title: '경기 민주당 후보 당선', pct: 71, change: +7, vol: '$2.8M', dir: 'up' },
  { cat: '수도권',    title: '인천 민주당 후보 당선', pct: 55, change: -2, vol: '$1.1M', dir: 'down' },

  // ── 영남권 ─────────────────────────────────────────────────────────────────
  { cat: '영남권',    title: '부산 국민의힘 후보 당선',      pct: 58, change: -3, vol: '$1.5M', dir: 'down' },
  { cat: '영남권',    title: '대구 국민의힘 후보 당선',      pct: 76, change: +2, vol: '$0.9M', dir: 'up' },
  { cat: '영남권',    title: '경남 국민의힘 후보 당선',      pct: 64, change: 0,  vol: '$0.7M', dir: 'flat' },
  { cat: '영남권',    title: '경북 국민의힘 후보 당선',      pct: 79, change: +1, vol: '$0.6M', dir: 'up' },
  { cat: '영남권',    title: '울산 조국혁신당 후보 당선',    pct: 31, change: +8, vol: '$0.4M', dir: 'up' },

  // ── 호남권 ─────────────────────────────────────────────────────────────────
  { cat: '호남권',    title: '광주·전남 민주당 계열 후보 당선', pct: 85, change: +2, vol: '$0.8M', dir: 'up' },
  { cat: '호남권',    title: '전북 민주당 후보 당선',            pct: 88, change: +1, vol: '$0.6M', dir: 'up' },

  // ── 충청·강원·제주 ─────────────────────────────────────────────────────────
  { cat: '충청·강원·제주', title: '세종 민주당 후보 당선',       pct: 67, change: +5, vol: '$0.5M', dir: 'up' },
  { cat: '충청·강원·제주', title: '충북 민주당 후보 당선',       pct: 61, change: +3, vol: '$0.4M', dir: 'up' },
  { cat: '충청·강원·제주', title: '충남 민주당 후보 당선',       pct: 58, change: +2, vol: '$0.4M', dir: 'up' },
  { cat: '충청·강원·제주', title: '강원 국민의힘 후보 당선',     pct: 54, change: -4, vol: '$0.5M', dir: 'down' },
  { cat: '충청·강원·제주', title: '대전 민주당 후보 당선',       pct: 72, change: +6, vol: '$0.4M', dir: 'up' },
  { cat: '충청·강원·제주', title: '제주 결과 5%p 이내 접전',    pct: 45, change: +6, vol: '$0.3M', dir: 'up' },
];

const CAT_ORDER = ['전국 통계', '수도권', '영남권', '호남권', '충청·강원·제주'];
const CAT_COLOR = {
  '전국 통계': '#0D1B3E', '수도권': '#1A5DC8', '영남권': '#E03030',
  '호남권': '#1A8C60', '충청·강원·제주': '#D06010',
};

function PctBar({ pct, dir }) {
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

function ChangeTag({ change, dir }) {
  if (dir === 'flat') return <span style={{ fontSize: 12, color: '#AAA' }}>— 변동없음</span>;
  const color = dir === 'up' ? '#1A9C4E' : '#E03030';
  const arrow = dir === 'up' ? '▲' : '▼';
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{arrow} {Math.abs(change)}%p</span>;
}

export default function PolyMarketPage() {
  const totalVol = '$18.3M';
  const totalBets = ALL_BETS.length;

  const grouped = CAT_ORDER.map(cat => ({
    cat,
    items: ALL_BETS.filter(b => b.cat === cat),
  }));

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>PolyMarket 선거 베팅 현황</div>
          <div style={{ fontSize: 12, color: '#AAA', marginTop: 3 }}>2026 지방선거 관련 전체 예측 시장 · 정보 제공 전용</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#AAA', marginBottom: 3 }}>총 거래량</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0D1B3E', letterSpacing: '-0.03em' }}>{totalVol}</div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: '전체 예측 시장',   v: totalBets,  unit: '개',  c: '#0D1B3E' },
          { l: '평균 YES 확률',    v: Math.round(ALL_BETS.reduce((s,b) => s+b.pct, 0) / ALL_BETS.length), unit: '%', c: '#1A9C4E' },
          { l: '상승 베팅',        v: ALL_BETS.filter(b => b.dir === 'up').length,   unit: '개', c: '#1A5DC8' },
          { l: '하락 베팅',        v: ALL_BETS.filter(b => b.dir === 'down').length, unit: '개', c: '#E03030' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
              {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 카테고리별 베팅 목록 */}
      {grouped.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: CAT_COLOR[cat], flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>{cat}</span>
            <span style={{ fontSize: 11, color: '#AAA' }}>{items.length}개 시장</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px',
                borderBottom: i < items.length - 1 ? '1px solid #F0F2F5' : 'none',
              }}>
                {/* 제목 */}
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[cat], marginRight: 7, verticalAlign: 'middle' }} />
                  {b.title}
                </div>

                {/* YES 확률 + 막대 */}
                <PctBar pct={b.pct} dir={b.dir} />

                {/* 변동 */}
                <div style={{ minWidth: 72, textAlign: 'right' }}>
                  <ChangeTag change={b.change} dir={b.dir} />
                </div>

                {/* 거래량 */}
                <div style={{ minWidth: 56, textAlign: 'right', fontSize: 12, color: '#888', fontWeight: 600 }}>
                  {b.vol}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 6, padding: '12px 16px', background: '#FFFBE8', borderRadius: 8, border: '1px solid #F5E080', fontSize: 12, color: '#8A6A00' }}>
        ⚠️ 본 페이지는 Polymarket.com 데이터를 기반으로 한 정보 제공 전용입니다. 투자 권유나 베팅 기능을 제공하지 않습니다.
      </div>
    </div>
  );
}