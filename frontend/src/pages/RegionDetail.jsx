import { useState, useMemo, Fragment } from 'react';
import { PROVINCES, CANDIDATE_DATA } from '../data/mock';

// ── 필터 옵션 ──────────────────────────────────────────────────────────────
const ELECTION_TYPES = ['전체','광역단체장','광역의회의원','교육감','국회의원보궐','기초단체장','기초의회의원'];
const REGIONS = ['전체','서울','부산','대구','인천','광주','대전','울산','세종','경기도','충청북도','충청남도','전라남도','경상북도','경상남도','강원도','전라북도','제주도'];
const PARTIES = ['전체','더불어민주당','국민의힘','개혁신당','조국혁신당','정의당','진보당','소수정당','무소속'];
const REGION_KW = {
  '서울':'서울','부산':'부산','대구':'대구','인천':'인천','광주':'광주','대전':'대전','울산':'울산','세종':'세종',
  '경기도':'경기','충청북도':'충북','충청남도':'충남','전라남도':'전남','경상북도':'경북','경상남도':'경남',
  '강원도':'강원','전라북도':'전북','제주도':'제주',
};

// ── 색상 ───────────────────────────────────────────────────────────────────
const PARTY_COLOR = {'더불어민주당':'#1A5DC8','국민의힘':'#E03030','개혁신당':'#D06010','조국혁신당':'#1A8C60','정의당':'#4A8C10','진보당':'#C01060'};
const PARTY_STYLE = {'더불어민주당':{bg:'#EBF0FA',color:'#1A5DC8'},'국민의힘':{bg:'#FEF0F0',color:'#E03030'},'개혁신당':{bg:'#FFF4E8',color:'#D06010'},'조국혁신당':{bg:'#E8F5F0',color:'#1A8C60'},'정의당':{bg:'#F0F5E8',color:'#4A8C10'},'진보당':{bg:'#FFF0F5',color:'#C01060'}};
function pColor(p) { return PARTY_COLOR[p] ?? '#888'; }
function pStyle(p) { return PARTY_STYLE[p] ?? { bg:'#F0F0F0', color:'#666' }; }

// 시도별 선거인 수 추정 (단위: 만명) — 투표수 계산용 mock
const VOTER_WAN = [780,260,160,240,110,110,85,30,900,125,105,150,130,145,185,240,55];

// ── FilterRow ──────────────────────────────────────────────────────────────
function FilterRow({ label, options, value, onChange, getStyle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#666', marginBottom:5, letterSpacing:'0.04em' }}>{label}</div>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {options.map(opt => {
          const active = value === opt;
          const style  = opt === '전체' ? {bg:'#0D1B3E',color:'white'} : (getStyle ? getStyle(opt) : {bg:'#1A5DC8',color:'white'});
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{
              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
              cursor:'pointer', border:'1px solid', fontFamily:'inherit', whiteSpace:'nowrap',
              background: active ? style.bg : 'white',
              color:      active ? (opt==='전체' ? 'white' : style.color) : '#888',
              borderColor:active ? (opt==='전체' ? '#0D1B3E' : style.color) : '#DDD',
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── 후보 카드 ──────────────────────────────────────────────────────────────
function CandidateCard({ rank, cand, isWon }) {
  const color = pColor(cand?.party);
  const ps    = pStyle(cand?.party);
  return (
    <div style={{ textAlign:'center', flex:1, padding:'0 12px' }}>
      <div style={{ marginBottom:10 }}>
        <span style={{ background: isWon ? '#E8A010' : '#7A8898', color:'white', fontSize:11, fontWeight:700, padding:'3px 14px', borderRadius:12 }}>
          {isWon ? '당선' : `${rank}위`}
        </span>
      </div>
      {/* 원형 아바타 (백엔드 연동 시 실제 사진으로 교체) */}
      <div style={{
        width:80, height:80, borderRadius:'50%',
        border:`3px solid ${color}`, background: color + '18',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:30, fontWeight:700, color, margin:'0 auto 10px',
      }}>
        {cand?.name?.slice(-1) ?? '?'}
      </div>
      <div style={{ fontSize:18, fontWeight:700, color:'#0D1B3E', marginBottom:3 }}>{cand?.name ?? '미정'}</div>
      <div style={{ marginBottom:10 }}>
        <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:600, background:ps.bg, color:ps.color }}>
          {cand?.party ?? '—'}
        </span>
      </div>
      <div style={{ fontSize:34, fontWeight:900, color, letterSpacing:'-0.04em', lineHeight:1 }}>
        {cand?.pct != null ? cand.pct.toFixed(1) : 0}%
      </div>
      <div style={{ fontSize:13, color:'#666', marginTop:6 }}>
        {cand?.votes != null ? cand.votes.toLocaleString() : '0'}표
      </div>
    </div>
  );
}

// ── 득표 비교 (중앙 막대 + 표차) ──────────────────────────────────────────
function VoteDiff({ rank1, rank2 }) {
  if (!rank1 || !rank2) return null;
  const h1 = Math.round(rank1.pct * 1.0);
  const h2 = Math.round(rank2.pct * 1.0);
  const hMax = Math.max(h1, h2);
  const diff = Math.abs(rank1.votes - rank2.votes);
  return (
    <div style={{ textAlign:'center', width:90, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:10 }}>
      <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:80, marginBottom:8 }}>
        <div style={{ width:22, borderRadius:'3px 3px 0 0', background:pColor(rank1.party), height:`${(h1/hMax)*100}%`, minHeight:4 }} />
        <div style={{ width:22, borderRadius:'3px 3px 0 0', background:pColor(rank2.party), height:`${(h2/hMax)*100}%`, minHeight:4 }} />
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:'#0D1B3E' }}>{diff.toLocaleString()}</div>
      <div style={{ fontSize:11, color:'#AAA', marginBottom:8 }}>표차</div>
      <div style={{ fontSize:13, color:'#CCC', fontWeight:700 }}>VS</div>
    </div>
  );
}

// ── PolyMarket 패널 ────────────────────────────────────────────────────────
function PolyMarketPanel({ data }) {
  if (!data) {
    return (
      <div style={{ border:'1px solid #E5E8EC', borderRadius:8, padding:'12px 16px', background:'#FAFBFC', marginTop:14 }}>
        <div style={{ fontSize:12, color:'#AAA', display:'flex', alignItems:'center', gap:8 }}>
          <span>📊</span>관련 PolyMarket 베팅이 없습니다.
        </div>
      </div>
    );
  }
  return (
    <div style={{ border:'1px solid #E5E8EC', borderRadius:8, overflow:'hidden', marginTop:14, background:'white' }}>
      <div style={{ padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>🗳️</span>
          <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4, color:'#1A1A1A' }}>{data.question}</div>
        </div>
        {data.items.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', padding:'8px 0', borderTop: i > 0 ? '1px solid #F0F2F5' : 'none' }}>
            <span style={{ flex:1, fontSize:13, color:'#333' }}>{item.name}</span>
            <span style={{ fontWeight:700, fontSize:14, marginRight:10, color:'#1A1A1A', minWidth:42, textAlign:'right' }}>{item.pct}%</span>
            <span style={{ background:'#E8F5E8', color:'#1A9C4E', padding:'3px 10px', borderRadius:5, fontSize:12, fontWeight:600, marginRight:4 }}>예.</span>
            <span style={{ background:'#FEF0F0', color:'#E03030', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:600 }}>아니...</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:8, borderTop:'1px solid #F0F2F5' }}>
          <span style={{ fontSize:11, color:'#AAA' }}>{data.volume} 거래량</span>
          <div style={{ display:'flex', gap:10, fontSize:16, color:'#CCC' }}>
            <span style={{ cursor:'pointer' }}>🔖</span>
            <span style={{ cursor:'pointer' }}>📤</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 뉴스 패널 ──────────────────────────────────────────────────────────────
function NewsPanel({ news }) {
  if (!news || news.length === 0) {
    return <div style={{ marginTop:14, fontSize:12, color:'#AAA' }}>관련 뉴스가 없습니다.</div>;
  }
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:8, letterSpacing:'0.04em' }}>관련 뉴스</div>
      {news.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{
          display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0',
          borderBottom: i < news.length - 1 ? '1px solid #F0F2F5' : 'none', textDecoration:'none',
        }}>
          <span style={{ color:'#CBD0D8', fontSize:10, flexShrink:0, paddingTop:4 }}>●</span>
          <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#1A1A1A', lineHeight:1.45 }}>{n.title}</span>
          <span style={{ fontSize:11, color:'#AAA', whiteSpace:'nowrap', flexShrink:0, alignSelf:'center' }}>
            {n.source} · {n.time}
          </span>
        </a>
      ))}
    </div>
  );
}

// ── 확장 패널 ──────────────────────────────────────────────────────────────
function ExpandedPanel({ row, isLive }) {
  // 백엔드 연동 시 useEffect + fetch('/api/results/{row.code}/detail') 로 교체
  if (!isLive) {
    return (
      <div style={{ padding:'24px 32px', textAlign:'center', color:'#AAA', fontSize:13, background:'#FAFBFC' }}>
        개표가 시작되기 전입니다. 6월 3일 선거 당일 오후 6시부터 상세 정보가 표시됩니다.
      </div>
    );
  }
  return (
    <div style={{ padding:'20px 28px', background:'#F7F9FC', borderTop:'2px solid #1A5DC8' }}>
      {/* ① 후보 비교 카드 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <CandidateCard rank={1} cand={row.rank1} isWon={true} />
        <VoteDiff rank1={row.rank1} rank2={row.rank2} />
        <CandidateCard rank={2} cand={row.rank2} isWon={false} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* ② PolyMarket */}
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:2, letterSpacing:'0.04em' }}>POLYMARKET 예측</div>
          <PolyMarketPanel data={row.polymarket} />
        </div>
        {/* ③ 관련 뉴스 */}
        <div>
          <NewsPanel news={row.news} />
        </div>
      </div>

      <div style={{ marginTop:12, fontSize:11, color:'#CCC', textAlign:'right' }}>
        * 후보 사진·실시간 득표율·뉴스는 백엔드 API 연동 후 실데이터로 교체됩니다.
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function RegionDetail({ isLive }) {
  const [expandedCode, setExpandedCode] = useState(null);
  const [typeFilter,   setTypeFilter]   = useState('전체');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [partyFilter,  setPartyFilter]  = useState('전체');
  const [search,       setSearch]       = useState('');

  const baseRows = useMemo(() => PROVINCES.map((p, i) => {
    const winP = p.party === 'blue' ? '더불어민주당' : '국민의힘';
    const losP = p.party === 'blue' ? '국민의힘' : '더불어민주당';

    const cands = CANDIDATE_DATA.filter(c =>
      c.region === p.name ||
      (p.name.includes('광주') && c.region.includes('광주')) ||
      (p.name.includes('전라남도') && c.region.includes('광주'))
    );
    const r1c = cands.find(c => c.party === winP);
    const r2c = cands.find(c => c.party === losP) ?? cands.find(c => c !== r1c);

    const r1Pct = isLive ? Math.min(68, 50 + (i * 13 + 2) % 18) : 0;
    const r2Pct = isLive ? Math.max(24, 90 - r1Pct - (i * 7 + 3) % 8) : 0;
    const scale = (VOTER_WAN[i] ?? 100) * 10000;
    const r1Votes = isLive ? Math.round(r1Pct / 100 * scale) : 0;
    const r2Votes = isLive ? Math.round(r2Pct / 100 * scale) : 0;

    const rank1 = r1c ? { name:r1c.name, party:r1c.party, pct:r1Pct, votes:r1Votes } : null;
    const rank2 = r2c ? { name:r2c.name, party:r2c.party, pct:r2Pct, votes:r2Votes } : null;

    const polymarket = isLive && rank1 ? {
      question: `2026 ${p.short} 광역단체장 선거`,
      volume: `$${100 + i * 45}K`,
      items: [
        { name: rank1.name, pct: Math.min(92, Math.round(r1Pct * 0.85 + 8)) },
        ...(rank2 ? [{ name: rank2.name, pct: Math.min(88, Math.round(r2Pct * 0.85 + 5)) }] : []),
      ],
    } : null;

    const news = isLive ? [
      { title: `${p.short} 개표 진행 중 — ${rank1?.name ?? '?'} 후보 ${r1Pct}%로 선두 유지`, source:'연합뉴스', url:'#', time:'방금 전' },
      { title: `2026 지방선거 ${p.short} 개표율 ${(25+i*4)%100}% 돌파`, source:'KBS', url:'#', time:`${1+(i%4)}시간 전` },
      { title: `${p.short} 유권자 반응 "이번 선거 역대급 관심"`, source:'한겨레', url:'#', time:`${2+(i%3)}시간 전` },
      { title: `${rank1?.name ?? '?'} 후보 당선 시 주요 공약 이행 계획`, source:'중앙일보', url:'#', time:`${3+(i%2)}시간 전` },
      { title: `${p.short} 선거 최종 투표율 ${(54+i*2)%75}% 기록`, source:'조선일보', url:'#', time:`${4+(i%3)}시간 전` },
    ] : [];

    return {
      ...p, type:'광역단체장',
      counted: isLive ? (25 + i * 4) % 100 : 0,
      rank1, rank2,
      diff: r1Pct - r2Pct,
      polyCandidate: rank1?.name ?? '—',
      polymarket, news,
    };
  }), [isLive]);

  const rows = useMemo(() => baseRows.filter(r => {
    if (typeFilter !== '전체' && r.type !== typeFilter) return false;
    if (regionFilter !== '전체') {
      const kw = REGION_KW[regionFilter] ?? regionFilter;
      if (!r.name.includes(kw) && !r.short.includes(kw)) return false;
    }
    if (partyFilter !== '전체') {
      if (!r.rank1 || r.rank1.party !== partyFilter) return false;
    }
    if (search && !r.name.includes(search) && !r.short.includes(search)) return false;
    return true;
  }), [baseRows, typeFilter, regionFilter, partyFilter, search]);

  const hasFilter = typeFilter !== '전체' || regionFilter !== '전체' || partyFilter !== '전체' || search;

  function reset() { setTypeFilter('전체'); setRegionFilter('전체'); setPartyFilter('전체'); setSearch(''); }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#0D1B3E' }}>선거 개표 현황</div>
        <div className={`realtime-tag ${isLive ? 'active' : 'inactive'}`}>
          <div className={`realtime-dot ${isLive ? 'active' : 'inactive'}`} />
          {isLive ? '실시간 업데이트 중' : '실시간 업데이트 중이 아님'}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'전국 개표율',        value: isLive ? '43.2%' : '0%',  sub: isLive ? '8,420 / 19,500 투표소' : '개표가 시작되지 않았습니다', color:'#1A9C4E' },
          { label:'민주당 선두 지역',   value: isLive ? '11곳'  : '0곳', sub: isLive ? '광역단체장 기준' : '집계 전', color:'#1A5DC8' },
          { label:'국민의힘 선두 지역', value: isLive ? '6곳'   : '0곳', sub: isLive ? '광역단체장 기준' : '집계 전', color:'#E03030' },
        ].map((c, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color:c.color, fontSize: isLive ? 32 : 22 }}>{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* 3단 필터 */}
      <div className="card" style={{ marginBottom:14, padding:'16px 18px' }}>
        <FilterRow label="선거 유형" options={ELECTION_TYPES} value={typeFilter}   onChange={setTypeFilter} />
        <FilterRow label="지역"     options={REGIONS}         value={regionFilter} onChange={setRegionFilter} />
        <FilterRow label="정당 (선두)" options={PARTIES}      value={partyFilter}  onChange={setPartyFilter} getStyle={pStyle} />
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
          <div className="search-bar-wrap" style={{ flex:1, marginBottom:0 }}>
            <span className="search-icon">🔍</span>
            <input className="search-bar" value={search} onChange={e => setSearch(e.target.value)} placeholder="지역명으로 검색..." />
          </div>
          {hasFilter && (
            <button onClick={reset} style={{ padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600, border:'1px solid #E5E8EC', background:'white', color:'#666', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize:12, color:'#AAA', marginBottom:8 }}>
        <strong style={{ color:'#0D1B3E' }}>{rows.length}</strong>개 지역 표시 중
        {[typeFilter, regionFilter, partyFilter].filter(f => f !== '전체').map((f, i) => (
          <span key={i} style={{ marginLeft:5, color:'#1A5DC8', fontWeight:600 }}>[{f}]</span>
        ))}
        <span style={{ marginLeft:8, color:'#CCC' }}>· 행 클릭 시 상세 정보 확인</span>
      </div>

      {/* 개표 테이블 */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="reg-table">
          <thead>
            <tr>
              <th>선거 유형</th>
              <th>지역</th>
              <th style={{ minWidth:120 }}>개표율</th>
              <th>1위 후보</th>
              <th>1위 득표율</th>
              <th>2위 후보</th>
              <th>2위 득표율</th>
              <th>득표율 차</th>
              <th>PM 예상</th>
              <th style={{ width:36 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isExpanded = r.code === expandedCode;
              return (
                <Fragment key={r.code}>
                  <tr
                    style={{ cursor:'pointer', background: isExpanded ? '#EBF0FA' : undefined }}
                    onClick={() => setExpandedCode(isExpanded ? null : r.code)}
                  >
                    <td style={{ fontSize:11, color:'#888' }}>{r.type}</td>
                    <td style={{ fontWeight:600 }}>{r.short}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'#F0F0F0', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'#1A9C4E', borderRadius:3, width:`${r.counted}%` }} />
                        </div>
                        <span style={{ fontSize:12, color:'#555', width:36 }}>{r.counted}%</span>
                      </div>
                    </td>

                    {/* 1위 */}
                    <td>
                      {r.rank1 ? (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontWeight:700 }}>{r.rank1.name}</span>
                          <span style={{ ...pStyle(r.rank1.party), display:'inline-block', padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:600, background:pStyle(r.rank1.party).bg, color:pStyle(r.rank1.party).color }}>
                            {r.rank1.party === '더불어민주당' ? '민주' : r.rank1.party === '국민의힘' ? '국힘' : r.rank1.party.slice(0,2)}
                          </span>
                        </span>
                      ) : <span style={{ color:'#CCC' }}>—</span>}
                    </td>
                    <td style={{ fontWeight:700, color: isLive ? pColor(r.rank1?.party) : '#CCC' }}>
                      {isLive && r.rank1 ? `${r.rank1.pct.toFixed(1)}%` : '—'}
                    </td>

                    {/* 2위 */}
                    <td>
                      {r.rank2 ? (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontWeight:600 }}>{r.rank2.name}</span>
                          <span style={{ display:'inline-block', padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:600, background:pStyle(r.rank2.party).bg, color:pStyle(r.rank2.party).color }}>
                            {r.rank2.party === '더불어민주당' ? '민주' : r.rank2.party === '국민의힘' ? '국힘' : r.rank2.party.slice(0,2)}
                          </span>
                        </span>
                      ) : <span style={{ color:'#CCC' }}>—</span>}
                    </td>
                    <td style={{ fontWeight:700, color: isLive ? pColor(r.rank2?.party) : '#CCC' }}>
                      {isLive && r.rank2 ? `${r.rank2.pct.toFixed(1)}%` : '—'}
                    </td>

                    {/* 득표차 */}
                    <td style={{ fontWeight:700, color: isLive ? pColor(r.rank1?.party) : '#CCC' }}>
                      {isLive ? `+${r.diff.toFixed(1)}%p` : '—'}
                    </td>

                    {/* PolyMarket 예상 */}
                    <td style={{ fontSize:12, color:'#555' }}>
                      {isLive ? r.polyCandidate : <span style={{ color:'#CCC' }}>—</span>}
                    </td>

                    {/* 확장 토글 */}
                    <td style={{ textAlign:'center', color:'#1A5DC8', fontSize:11, fontWeight:700 }}>
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  </tr>

                  {/* 확장 패널 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} style={{ padding:0 }}>
                        <ExpandedPanel row={r} isLive={isLive} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign:'center', color:'#AAA', padding:40 }}>
                  {hasFilter ? '해당 조건의 개표 데이터가 없습니다.' : '데이터가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}