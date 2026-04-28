import { useState, useMemo, Fragment } from 'react';
import { CANDIDATE_DATA } from '../data/mock';

// ── 필터 옵션 ──────────────────────────────────────────────────────────────
const ELECTION_TYPES = [
  '전체', '광역단체장', '광역의회의원', '교육감', '국회의원보궐', '기초단체장', '기초의회의원',
];
const REGIONS = [
  '전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기도', '충청북도', '충청남도', '전라남도', '경상북도', '경상남도',
  '강원도', '전라북도', '제주도',
];
const PARTIES = [
  '전체', '더불어민주당', '국민의힘', '개혁신당', '조국혁신당',
  '정의당', '진보당', '소수정당', '무소속',
];
const REGION_KW = {
  '서울': '서울', '부산': '부산', '대구': '대구', '인천': '인천',
  '광주': '광주', '대전': '대전', '울산': '울산', '세종': '세종',
  '경기도': '경기', '충청북도': '충북', '충청남도': '충남',
  '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '강원도': '강원', '전라북도': '전북', '제주도': '제주',
};
const MAJOR_PARTIES = new Set(['더불어민주당', '국민의힘', '개혁신당', '조국혁신당', '정의당', '진보당', '무소속']);

// ── 색상 ───────────────────────────────────────────────────────────────────
const PARTY_STYLE = {
  '더불어민주당': { bg: '#EBF0FA', color: '#1A5DC8' },
  '국민의힘':     { bg: '#FEF0F0', color: '#E03030' },
  '진보당':       { bg: '#FFF0F5', color: '#C01060' },
  '조국혁신당':   { bg: '#E8F5F0', color: '#1A8C60' },
  '개혁신당':     { bg: '#FFF4E8', color: '#D06010' },
  '정의당':       { bg: '#F0F5E8', color: '#4A8C10' },
  '소수정당':     { bg: '#F5F0FF', color: '#7040C0' },
  '무소속':       { bg: '#F0F0F0', color: '#666' },
};
const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8', '국민의힘': '#E03030', '개혁신당': '#D06010',
  '조국혁신당': '#1A8C60', '정의당': '#4A8C10', '진보당': '#C01060',
};
function pStyle(p) { return PARTY_STYLE[p] ?? { bg: '#F0F0F0', color: '#666' }; }
function pColor(p) { return PARTY_COLOR[p] ?? '#888'; }

const STATUS_STYLE = {
  '등록':      { bg: '#E8F5E8', color: '#1A9C4E' },
  '사퇴':      { bg: '#F0F0F0', color: '#888' },
  '등록 무효': { bg: '#FEF0F0', color: '#E03030' },
  '사망':      { bg: '#2A2A2A', color: '#CCC' },
};

// ── 직업 파생 ──────────────────────────────────────────────────────────────
function deriveJob(career) {
  if (career.includes('변호사'))                                       return '변호사';
  if (career.includes('세무사'))                                       return '세무사';
  if (career.includes('교수') || career.includes('강사'))              return '교수';
  if (career.includes('아나운서'))                                     return '아나운서';
  if (career.includes('목사'))                                         return '종교인';
  if (career.includes('노동') || career.includes('노조'))              return '노동운동가';
  if (career.includes('경찰') || career.includes('검사') || career.includes('행정관') || career.includes('비서관') || career.includes('비서실장') || career.includes('공무원')) return '공직자';
  if (career.includes('국무총리') || career.includes('장관') || career.includes('청장')) return '공직자';
  if (career.includes('시장') || career.includes('도지사') || career.includes('구청장') || career.includes('군수') || career.includes('의원')) return '정치인';
  if (career.includes('당대표') || career.includes('최고위원') || career.includes('위원장') || career.includes('대변인') || career.includes('보좌관')) return '정당인';
  return '정치인';
}

// 사퇴 처리할 후보 (mock)
const WITHDRAWN = new Set(['이승현', '고낙정', '이성배', '이철수']);

// 요약 통계 (헤더)
const SUMMARY_STATS = [
  { l: '총 등록 후보자', v: '8,578', c: '#0D1B3E', sub: '2026-04-28 기준' },
  { l: '더불어민주당',   v: '3,988', c: '#1A5DC8', sub: '전체의 46.5%' },
  { l: '국민의힘',       v: '3,145', c: '#E03030', sub: '전체의 36.7%' },
  { l: '기타/무소속',    v: '1,445', c: '#888',    sub: '진보·조국·개혁 등' },
];

// ── FilterRow ──────────────────────────────────────────────────────────────
function FilterRow({ label, options, value, onChange, getStyle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 5, letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt;
          const style  = opt === '전체'
            ? { bg: '#0D1B3E', color: 'white' }
            : (getStyle ? getStyle(opt) : { bg: '#1A5DC8', color: 'white' });
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', whiteSpace: 'nowrap',
                background:  active ? style.bg : 'white',
                color:       active ? (opt === '전체' ? 'white' : style.color) : '#888',
                borderColor: active ? (opt === '전체' ? '#0D1B3E' : style.color) : '#DDD',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PolyMarket 패널 ────────────────────────────────────────────────────────
function PolyMarketPanel({ data }) {
  if (!data) {
    return (
      <div style={{ border: '1px solid #E5E8EC', borderRadius: 8, padding: '12px 16px', background: '#FAFBFC', marginTop: 14 }}>
        <div style={{ fontSize: 12, color: '#AAA', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📊</span>관련 PolyMarket 베팅이 없습니다.
        </div>
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid #E5E8EC', borderRadius: 8, overflow: 'hidden', marginTop: 14, background: 'white' }}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🗳️</span>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: '#1A1A1A' }}>{data.question}</div>
        </div>
        {data.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid #F0F2F5' : 'none' }}>
            <span style={{ flex: 1, fontSize: 13, color: '#333' }}>{item.name}</span>
            <span style={{ fontWeight: 700, fontSize: 14, marginRight: 10, color: '#1A1A1A', minWidth: 42, textAlign: 'right' }}>{item.pct}%</span>
            <span style={{ background: '#E8F5E8', color: '#1A9C4E', padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600, marginRight: 4 }}>예.</span>
            <span style={{ background: '#FEF0F0', color: '#E03030', padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600 }}>아니...</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #F0F2F5' }}>
          <span style={{ fontSize: 11, color: '#AAA' }}>{data.volume} 거래량</span>
          <div style={{ display: 'flex', gap: 10, fontSize: 16, color: '#CCC' }}>
            <span style={{ cursor: 'pointer' }}>🔖</span>
            <span style={{ cursor: 'pointer' }}>📤</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 뉴스 패널 ──────────────────────────────────────────────────────────────
function NewsPanel({ news }) {
  if (!news || news.length === 0) {
    return <div style={{ marginTop: 14, fontSize: 12, color: '#AAA' }}>관련 뉴스가 없습니다.</div>;
  }
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, letterSpacing: '0.04em' }}>관련 뉴스</div>
      {news.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
          borderBottom: i < news.length - 1 ? '1px solid #F0F2F5' : 'none', textDecoration: 'none',
        }}>
          <span style={{ color: '#CBD0D8', fontSize: 10, flexShrink: 0, paddingTop: 4 }}>●</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.45 }}>{n.title}</span>
          <span style={{ fontSize: 11, color: '#AAA', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' }}>
            {n.source} · {n.time}
          </span>
        </a>
      ))}
    </div>
  );
}

// ── 후보자 확장 패널 ───────────────────────────────────────────────────────
function CandidateExpandPanel({ cand }) {
  const ps = pStyle(cand.party);
  const pc = pColor(cand.party);

  const short = cand.region.length > 5 ? cand.region.slice(0, 2) : cand.region.slice(0, 2);

  const isMajor = cand.party === '더불어민주당' || cand.party === '국민의힘';
  const winPct  = isMajor ? Math.min(72, 48 + (cand.age % 20)) : Math.max(12, 20 + (cand.age % 15));
  const polymarket = {
    question: `2026 ${short} 광역단체장 — ${cand.name} 후보 당선`,
    volume: `$${80 + (cand.age % 9) * 15}K`,
    items: [
      { name: `${cand.name} 당선`, pct: winPct },
      { name: `낙선`, pct: 100 - winPct },
    ],
  };

  const news = [
    { title: `${cand.name} 후보, ${short} 유세 현장서 주요 공약 발표`, source: '연합뉴스', url: '#', time: '1시간 전' },
    { title: `${cand.party} ${short} 후보 지지율 최신 동향`, source: 'KBS', url: '#', time: '3시간 전' },
    { title: `2026 ${short} 광역단체장 선거 주요 후보 비교 분석`, source: 'MBC', url: '#', time: '5시간 전' },
    { title: `${cand.name} 후보 이력 · 정책 심층 분석`, source: '한겨레', url: '#', time: '어제' },
    { title: `${short} 선거구 유권자 여론조사 결과 공개`, source: '조선일보', url: '#', time: '2일 전' },
  ];

  return (
    <div style={{ padding: '20px 28px', background: '#F7F9FC', borderTop: '2px solid #1A5DC8' }}>
      {/* ① 후보 프로필 카드 */}
      <div style={{
        display: 'flex', gap: 20, padding: '18px 22px',
        background: 'white', borderRadius: 12, border: '1px solid #E5E8EC', marginBottom: 16,
      }}>
        {/* 사진 자리 (백엔드 연동 시 실제 사진으로 교체) */}
        <div style={{
          width: 80, height: 100, borderRadius: 8, flexShrink: 0,
          background: pc + '18', border: `2px solid ${pc}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: pc,
        }}>
          {cand.name.slice(-1)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0D1B3E', marginBottom: 7 }}>
            {cand.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 12,
              fontSize: 12, fontWeight: 600, background: ps.bg, color: ps.color,
            }}>
              {cand.party}
            </span>
            <span style={{ fontSize: 13, color: '#555' }}>
              {cand.age}세 · {cand.gender} · {cand.job}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
            {cand.career}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, border: '1px solid #CBD0D8',
              fontSize: 12, fontWeight: 600, color: '#444', textDecoration: 'none', background: 'white',
            }}
          >
            선관위 상세 ↗
          </a>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, border: '1px solid #CBD0D8',
            fontSize: 12, fontWeight: 600, color: '#444', background: 'white',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            공유 ⎘
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ② PolyMarket */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 2, letterSpacing: '0.04em' }}>
            POLYMARKET 예측
          </div>
          <PolyMarketPanel data={polymarket} />
        </div>
        {/* ③ 관련 뉴스 5건 */}
        <div>
          <NewsPanel news={news} />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#CCC', textAlign: 'right' }}>
        * 후보 사진·실시간 데이터는 백엔드 API 연동 후 실데이터로 교체됩니다.
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function CandidatePanel() {
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('전체');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [partyFilter,  setPartyFilter]  = useState('전체');
  const [expandedKey,  setExpandedKey]  = useState(null);

  const allCandidates = useMemo(() =>
    CANDIDATE_DATA.map(c => ({
      ...c,
      type:   c.type ?? '광역단체장',
      job:    deriveJob(c.career),
      status: WITHDRAWN.has(c.name) ? '사퇴' : '등록',
    }))
  , []);

  const filtered = useMemo(() => allCandidates.filter(c => {
    if (typeFilter !== '전체' && c.type !== typeFilter) return false;
    if (regionFilter !== '전체') {
      const kw = REGION_KW[regionFilter] ?? regionFilter;
      if (!c.region.includes(kw)) return false;
    }
    if (partyFilter === '소수정당' && MAJOR_PARTIES.has(c.party)) return false;
    if (partyFilter !== '전체' && partyFilter !== '소수정당' && c.party !== partyFilter) return false;
    if (search && ![c.name, c.region, c.party, c.career, c.job].some(s => s.includes(search))) return false;
    return true;
  }), [allCandidates, typeFilter, regionFilter, partyFilter, search]);

  const hasFilter = typeFilter !== '전체' || regionFilter !== '전체' || partyFilter !== '전체' || search;

  function reset() {
    setTypeFilter('전체'); setRegionFilter('전체'); setPartyFilter('전체'); setSearch('');
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 등록 현황</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 (2026-04-28)</div>
      </div>

      {/* 요약 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {SUMMARY_STATS.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', marginTop: 4, lineHeight: 1.1 }}>
              {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>명</span>
            </div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 3단 필터 카드 */}
      <div className="card" style={{ marginBottom: 14, padding: '16px 18px' }}>
        <FilterRow label="선거 유형" options={ELECTION_TYPES} value={typeFilter}   onChange={setTypeFilter} />
        <FilterRow label="지역"     options={REGIONS}         value={regionFilter} onChange={setRegionFilter} />
        <FilterRow label="정당"     options={PARTIES}         value={partyFilter}  onChange={setPartyFilter} getStyle={pStyle} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <div className="search-bar-wrap" style={{ flex: 1, marginBottom: 0 }}>
            <span className="search-icon">🔍</span>
            <input
              className="search-bar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 지역, 정당, 직업, 경력으로 검색..."
            />
          </div>
          {hasFilter && (
            <button
              onClick={reset}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid #E5E8EC', background: 'white', color: '#666',
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
        <strong style={{ color: '#0D1B3E' }}>{filtered.length}</strong>명 표시 중
        {[typeFilter, regionFilter, partyFilter].filter(f => f !== '전체').map((f, i) => (
          <span key={i} style={{ marginLeft: 5, color: '#1A5DC8', fontWeight: 600 }}>[{f}]</span>
        ))}
        <span style={{ marginLeft: 8, color: '#CCC' }}>· 행 클릭 시 상세 정보 확인</span>
      </div>

      {/* 테이블 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="reg-table">
          <thead>
            <tr>
              <th>선거 유형</th>
              <th>선거구</th>
              <th>후보자명</th>
              <th>성별</th>
              <th>정당</th>
              <th>나이</th>
              <th>직업</th>
              <th>주요 경력</th>
              <th>상태</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const key        = `${c.region}_${c.name}`;
              const isExpanded = expandedKey === key;
              const ps         = pStyle(c.party);
              const ss         = STATUS_STYLE[c.status] ?? STATUS_STYLE['등록'];
              return (
                <Fragment key={key}>
                  <tr
                    style={{ cursor: 'pointer', background: isExpanded ? '#EBF0FA' : undefined }}
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                  >
                    <td style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{c.type}</td>
                    <td style={{ color: '#555', fontSize: 12, whiteSpace: 'nowrap' }}>{c.region}</td>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td style={{ color: '#888', fontSize: 12 }}>{c.gender}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: ps.bg, color: ps.color,
                      }}>
                        {c.party}
                      </span>
                    </td>
                    <td style={{ color: '#555' }}>{c.age}세</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{c.job}</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{c.career}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: ss.bg, color: ss.color,
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: '#1A5DC8', fontSize: 11, fontWeight: 700 }}>
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <CandidateExpandPanel cand={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>
                  {hasFilter ? '해당 조건의 후보자 데이터가 없습니다.' : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}