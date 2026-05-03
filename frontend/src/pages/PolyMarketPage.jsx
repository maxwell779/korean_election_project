import { useState, useEffect, useMemo } from 'react';

// 지원하는 9개 지역 (폴리마켓 API에 존재하는 지역)
const SUPPORTED_REGIONS = ['서울', '부산', '경기', '충북', '충남', '강원', '전남광주', '대전', '대구'];

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8',
  '국민의힘':     '#E03030',
  '조국혁신당':   '#1A8C60',
  '기타':         '#888',
};

// 지방선거 전체 정당 예측 마켓 매핑
const PARTY_MARKET_INFO = {
  'Democratic Party of Korea (DP)':  { name: '더불어민주당', color: '#1A5DC8' },
  'People Power Party (PPP)':        { name: '국민의힘',     color: '#E03030' },
  'Progressive Party (PP)':          { name: '진보당',       color: '#C01060' },
  'Reform Party (RP)':               { name: '개혁신당',     color: '#D06010' },
  'Rebuilding Korea Party (RKP)':    { name: '조국혁신당',   color: '#1A8C60' },
};

// 후보명 매핑 (영문 -> 한글 및 정당 추정)
const CANDIDATE_INFO = {
  'Chong Won-oh': { name: '정원오', party: '더불어민주당' },
  'Oh Se-hoon':   { name: '오세훈', party: '국민의힘' },
  'Park Heong-joon': { name: '박형준', party: '국민의힘' },
  'Chun Jae-soo': { name: '전재수', party: '더불어민주당' },
  'Kim Dong-yeon':{ name: '김동연', party: '더불어민주당' },
  'Choo Mi-ae':   { name: '추미애', party: '더불어민주당' },
  'Shin Yong-han':{ name: '신용한', party: '더불어민주당' },
  'Kim Young-hwan':{ name: '김영환', party: '국민의힘' },
  'Park Soo-hyun':{ name: '박수현', party: '더불어민주당' },
  'Kim Tae-heum': { name: '김태흠', party: '국민의힘' },
  'Woo Sang-ho':  { name: '우상호', party: '더불어민주당' },
  'Kim Jin-tae':  { name: '김진태', party: '국민의힘' },
  'Min Hyung-bae':{ name: '민형배', party: '더불어민주당' },
  'Huh Tae-jung': { name: '허태정', party: '더불어민주당' },
  'Lee Jang-woo': { name: '이장우', party: '국민의힘' },
  'Hong Joon-pyo':{ name: '홍준표', party: '국민의힘' },
  'Cho Kyoung-tae': { name: '조경태', party: '국민의힘' },
  'Ahn Cheol-soo':{ name: '안철수', party: '국민의힘' },
  'Na Kyung-won': { name: '나경원', party: '국민의힘' },
  'Han Dong-hoon':{ name: '한동훈', party: '국민의힘' },
  'Cho Kuk':      { name: '조국', party: '조국혁신당' },
  'Lee Jae-myung':{ name: '이재명', party: '더불어민주당' },
};

function getPartyColor(candidateEn) {
  const info = CANDIDATE_INFO[candidateEn];
  return info ? (PARTY_COLOR[info.party] || PARTY_COLOR['기타']) : PARTY_COLOR['기타'];
}

function getCandidateName(candidateEn) {
  const info = CANDIDATE_INFO[candidateEn];
  return info ? info.name : candidateEn;
}

export default function PolyMarketPage() {
  const [regionData,   setRegionData]   = useState({});
  const [partyMarket,  setPartyMarket]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [expandedRegion, setExpandedRegion] = useState(null);

  // 지방선거 전체 정당 예측 마켓 로드
  useEffect(() => {
    fetch('/api/markets/%EC%A7%80%EB%B0%A9%EC%84%A0%EA%B1%B0')
      .then(res => res.ok ? res.json() : [])
      .then(data => setPartyMarket([...data].sort((a, b) => b.probability - a.probability)))
      .catch(() => setPartyMarket([]));
  }, []);

  // 지역별 후보 데이터 로드
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

  // 판세 분석 데이터 가공
  const analysis = useMemo(() => {
    let blueWins = 0;
    let redWins  = 0;
    let otherWins = 0;
    const battlegrounds = [];
    
    let totalCandidates = 0;
    let probSum = 0;
    let over60Count = 0;
    let under40Count = 0;

    SUPPORTED_REGIONS.forEach(region => {
      const markets = regionData[region] || [];
      if (markets.length === 0) return;

      totalCandidates += markets.length;

      // 확률순 정렬
      const sorted = [...markets].sort((a, b) => b.probability_pct - a.probability_pct);
      const top1 = sorted[0];
      const top2 = sorted[1];
      
      markets.forEach(m => {
        probSum += m.probability_pct;
        if(m.probability_pct >= 60) over60Count++;
        if(m.probability_pct < 40) under40Count++;
      });

      // 예상 승리 당 카운트
      const topParty = CANDIDATE_INFO[top1.candidate]?.party;
      if (topParty === '더불어민주당') blueWins++;
      else if (topParty === '국민의힘') redWins++;
      else otherWins++;

      // 2위가 있는 지역은 모두 수집 → 격차가 작은 순으로 Top 3 표시
      if (top2) {
        const gap = top1.probability_pct - top2.probability_pct;
        battlegrounds.push({ region, gap, top1, top2 });
      }
    });

    // 격차가 가장 작은 순으로 정렬 (경합이 치열한 순)
    battlegrounds.sort((a, b) => a.gap - b.gap);
    const avgProb = totalCandidates > 0 ? Math.round(probSum / totalCandidates) : 0;

    return { 
      blueWins, 
      redWins, 
      otherWins, 
      battlegrounds: battlegrounds.slice(0, 3),
      totalCandidates,
      avgProb,
      over60Count,
      under40Count
    };
  }, [regionData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>폴리마켓 데이터를 불러오는 중입니다...</div>;
  if (error) return <div style={{ padding: 20, color: '#E03030', textAlign: 'center' }}>⚠️ {error}</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0D1B3E' }}>PolyMarket 판세 예측</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>해외 예측 시장 데이터를 기반으로 한 광역단체장 9곳 승패 예상</div>
        </div>
      </div>
      
      {/* 상단 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: '전체 후보 수',    v: analysis.totalCandidates, unit: '명',  c: '#0D1B3E' },
          { l: '평균 당선 확률',  v: analysis.avgProb,         unit: '%',   c: '#1A9C4E' },
          { l: '확률 60% 이상',   v: analysis.over60Count,     unit: '명',  c: '#1A5DC8' },
          { l: '확률 40% 미만',   v: analysis.under40Count,    unit: '명',  c: '#E03030' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
              {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 0. 정당별 승리 예측 (지방선거 전체 배팅) */}
      {partyMarket.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3E', marginBottom: 4 }}>
            🗳️ 정당별 승리 예측
          </div>
          <div style={{ fontSize: 11, color: '#AAA', marginBottom: 16 }}>
            PolyMarket · 전체 지방선거에서 어느 정당이 승리할 것인가
          </div>
          {partyMarket.map((m, i) => {
            const info = PARTY_MARKET_INFO[m.candidate] || { name: m.candidate, color: '#888' };
            const vol    = m.volume_24h ?? 0;
            const volStr = vol >= 1000 ? `$${(vol / 1000).toFixed(1)}K` : `$${vol.toFixed(0)}`;
            const pct    = m.probability_pct ?? m.probability * 100;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: i < partyMarket.length - 1 ? 11 : 0 }}>
                <div style={{ width: 3, height: 32, borderRadius: 2, background: info.color, flexShrink: 0 }} />
                <div style={{ width: 110, fontSize: 13, fontWeight: 600, color: '#222', flexShrink: 0 }}>
                  {info.name}
                </div>
                <div style={{ flex: 1, height: 10, background: '#F0F2F5', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: info.color,
                    borderRadius: 5, transition: 'width 0.6s ease', minWidth: pct > 0 ? 3 : 0 }} />
                </div>
                <div style={{ width: 58, textAlign: 'right', fontSize: 16, fontWeight: 800,
                  color: info.color, flexShrink: 0 }}>
                  {pct.toFixed(1)}%
                </div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: '#AAA', flexShrink: 0 }}>
                  {volStr}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. 종합 판세 (예상 의석) */}
      <div className="card" style={{ marginBottom: 20, background: '#F7F9FC', border: '1px solid #E5E8EC' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3E', marginBottom: 16 }}>🏆 정당별 예상 승리 지역 (총 9곳)</div>
        <div style={{ display: 'flex', gap: 12, height: 100 }}>
          {[
            { label: '더불어민주당 우세', count: analysis.blueWins, bg: '#EBF0FA', border: '#1A5DC8', color: '#1A5DC8' },
            { label: '국민의힘 우세',     count: analysis.redWins,  bg: '#FEF0F0', border: '#E03030', color: '#E03030' },
            { label: '그외 우세',         count: analysis.otherWins,bg: '#F5F0FF', border: '#7040C0', color: '#7040C0' },
          ].map(({ label, count, bg, border, color }) => (
            <div key={label} style={{ flex: count || 0.6, background: bg, borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${border}`, opacity: count === 0 ? 0.45 : 1 }}>
              <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 42, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 최대 경합 지역 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3E', marginBottom: 12 }}>🔥 상대적 경합 지역 Top 3 (1·2위 격차 기준)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {analysis.battlegrounds.map((b, i) => (
            <div key={i} className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#D06010' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', marginBottom: 12 }}>{b.region}</div>
              
              {/* 1위 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: getPartyColor(b.top1.candidate), marginRight: 4 }}>●</span>
                  {getCandidateName(b.top1.candidate)}
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: getPartyColor(b.top1.candidate) }}>{b.top1.probability_pct}%</span>
              </div>
              
              {/* 2위 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: getPartyColor(b.top2.candidate), marginRight: 4 }}>●</span>
                  {getCandidateName(b.top2.candidate)}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: getPartyColor(b.top2.candidate) }}>{b.top2.probability_pct}%</span>
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #E5E8EC', fontSize: 12, color: '#D06010', fontWeight: 600, textAlign: 'center' }}>
                격차 {b.gap.toFixed(1)}%p
              </div>
            </div>
          ))}
          {analysis.battlegrounds.length === 0 && (
             <div style={{ gridColumn: 'span 3', padding: 20, textAlign: 'center', color: '#888', background: '#F7F8FA', borderRadius: 8 }}>경합 지역 데이터를 분석할 수 없습니다.</div>
          )}
        </div>
      </div>

      {/* 3. 지역별 전체 후보 (아코디언 형태) */}

      <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3E', marginBottom: 12 }}>📍 지역별 후보 상세 예측</div>
      {SUPPORTED_REGIONS.map(region => {
        const markets = regionData[region] || [];
        if (markets.length === 0) return null;
        
        const isExpanded = expandedRegion === region;
        const topCand = markets.reduce((prev, current) => (prev.probability_pct > current.probability_pct) ? prev : current);

        return (
          <div key={region} className="card" style={{ marginBottom: 10, padding: 0 }}>
            {/* 요약 바 (항상 보임) */}
            <div 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: isExpanded ? '#FAFBFC' : 'white' }}
              onClick={() => setExpandedRegion(isExpanded ? null : region)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{region}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{markets.length}명 후보</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13 }}>
                  선두: <strong style={{ color: getPartyColor(topCand.candidate) }}>{getCandidateName(topCand.candidate)}</strong> ({topCand.probability_pct}%)
                </div>
                <span style={{ color: '#1A5DC8', fontSize: 12, fontWeight: 700 }}>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>

            {/* 상세 리스트 (펼쳤을 때만 보임) */}
            {isExpanded && (
              <div style={{ padding: '0 20px 16px', borderTop: '1px solid #F0F2F5' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                  <tbody>
                    {markets.sort((a,b) => b.probability_pct - a.probability_pct).map((m, i) => (
                      <tr key={i} style={{ borderBottom: i < markets.length - 1 ? '1px solid #F0F2F5' : 'none' }}>
                        <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: getPartyColor(m.candidate), marginRight: 8 }} />
                          {getCandidateName(m.candidate)} <span style={{ fontSize: 11, color: '#AAA', fontWeight: 400 }}>({m.candidate})</span>
                        </td>
                        <td style={{ textAlign: 'right', width: '120px' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: getPartyColor(m.candidate) }}>{m.probability_pct}%</span>
                        </td>
                        <td style={{ textAlign: 'right', width: '100px', fontSize: 12, color: '#888' }}>
                          볼륨: ${m.volume_24h?.toLocaleString() ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}