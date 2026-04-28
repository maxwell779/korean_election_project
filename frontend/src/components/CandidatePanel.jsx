import { useState, useMemo } from 'react';
import { CANDIDATE_DATA } from '../data/mock';

const PARTY_STYLE = {
  '더불어민주당': { bg: '#EBF0FA', color: '#1A5DC8' },
  '국민의힘':     { bg: '#FEF0F0', color: '#E03030' },
  '진보당':       { bg: '#FFF0F5', color: '#C01060' },
  '조국혁신당':   { bg: '#E8F5F0', color: '#1A8C60' },
  '개혁신당':     { bg: '#FFF4E8', color: '#D06010' },
  '정의당':       { bg: '#F0F5E8', color: '#4A8C10' },
};
function partyStyle(party) {
  return PARTY_STYLE[party] ?? { bg: '#F0F0F0', color: '#666' };
}

const SUMMARY_STATS = [
  { l: '총 등록 후보자', v: '8,578', c: '#0D1B3E', sub: '2026-04-28 기준' },
  { l: '더불어민주당',   v: '3,988', c: '#1A5DC8', sub: '전체의 46.5%' },
  { l: '국민의힘',       v: '3,145', c: '#E03030', sub: '전체의 36.7%' },
  { l: '기타/무소속',    v: '1,445', c: '#888',    sub: '진보·조국·개혁 등' },
];

export default function CandidatePanel() {
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('전체');

  const parties = useMemo(() => {
    const set = new Set(CANDIDATE_DATA.map(c => c.party));
    return ['전체', ...Array.from(set)];
  }, []);

  const filtered = useMemo(() =>
    CANDIDATE_DATA.filter(c => {
      const matchSearch = !search ||
        c.name.includes(search) ||
        c.region.includes(search) ||
        c.party.includes(search) ||
        c.career.includes(search);
      const matchParty = partyFilter === '전체' || c.party === partyFilter;
      return matchSearch && matchParty;
    }),
  [search, partyFilter]);

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 등록 현황</div>
        <div style={{ fontSize: 12, color: '#888' }}>
          광역단체장 기준 · 선관위 공식 데이터 (2026-04-28)
        </div>
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

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {parties.map(p => {
          const active = partyFilter === p;
          const style = p === '전체' ? { bg: '#0D1B3E', color: 'white' } : partyStyle(p);
          return (
            <button
              key={p}
              onClick={() => setPartyFilter(p)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: active ? style.bg : 'white',
                color: active ? (p === '전체' ? 'white' : style.color) : '#888',
                borderColor: active ? (p === '전체' ? '#0D1B3E' : style.color) : '#DDD',
                fontFamily: 'inherit',
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="search-bar-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-bar"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 지역, 정당, 경력으로 검색..."
        />
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
        광역단체장 <strong style={{ color: '#0D1B3E' }}>{filtered.length}</strong>명 표시 중
        <span style={{ marginLeft: 8, color: '#CCC' }}>· 전체 후보자 데이터는 백엔드 연동 후 확장 예정</span>
      </div>

      {/* 테이블 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="reg-table">
          <thead>
            <tr>
              <th>선거구</th>
              <th>후보자명</th>
              <th>성별</th>
              <th>정당</th>
              <th>나이</th>
              <th>주요 경력</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const ps = partyStyle(c.party);
              return (
                <tr key={i}>
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
                  <td style={{ color: '#555', fontSize: 12 }}>{c.career}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#AAA', padding: 32 }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}