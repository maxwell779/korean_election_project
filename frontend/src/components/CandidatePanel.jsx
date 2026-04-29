import { useState, useMemo, useEffect, Fragment } from 'react';
// ✅ [변경 전] mock 데이터 import
// import { CANDIDATE_DATA } from '../data/mock';

// ✅ [변경 후] API 함수 import
import { getCandidates } from '../api/index';

// ── 필터 옵션
const ELECTION_TYPES = ['전체', '광역단체장', '광역의회의원', '교육감', '국회의원보궐', '기초단체장', '기초의회의원'];

// ✅ [변경] 지역 목록 — 폴리마켓 지원 지역(API에 데이터 있음) + 전체
const SUPPORTED_REGIONS = ['전체', '서울', '부산', '경기', '충북', '충남', '강원', '전남광주', '대전', '대구'];

const PARTIES = ['전체', '더불어민주당', '국민의힘', '개혁신당', '조국혁신당', '정의당', '진보당', '소수정당', '무소속'];
const MAJOR_PARTIES = new Set(['더불어민주당', '국민의힘', '개혁신당', '조국혁신당', '정의당', '진보당', '무소속']);

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
const STATUS_STYLE = {
  '등록':      { bg: '#E8F5E8', color: '#1A9C4E' },
  '사퇴':      { bg: '#F0F0F0', color: '#888' },
  '등록무효':  { bg: '#FEF0F0', color: '#E03030' },
};
function pStyle(p) { return PARTY_STYLE[p] ?? { bg: '#F0F0F0', color: '#666' }; }

function FilterRow({ label, options, value, onChange, getStyle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 5, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt;
          const style  = opt === '전체' ? { bg: '#0D1B3E', color: 'white' } : (getStyle ? getStyle(opt) : { bg: '#1A5DC8', color: 'white' });
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background:  active ? style.bg : 'white',
              color:       active ? (opt === '전체' ? 'white' : style.color) : '#888',
              borderColor: active ? (opt === '전체' ? '#0D1B3E' : style.color) : '#DDD',
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

// 요약 통계 (상단 카드) — 실데이터로 계산
function SummaryCards({ candidates }) {
  const stats = useMemo(() => {
    const byParty = {};
    candidates.forEach(c => { byParty[c.party] = (byParty[c.party] || 0) + 1; });
    const blue = byParty['더불어민주당'] || 0;
    const red  = byParty['국민의힘'] || 0;
    const etc  = candidates.length - blue - red;
    return { total: candidates.length, blue, red, etc };
  }, [candidates]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
      {[
        { l: '조회된 후보자', v: stats.total,  c: '#0D1B3E', unit: '명' },
        { l: '더불어민주당', v: stats.blue,    c: '#1A5DC8', unit: '명' },
        { l: '국민의힘',     v: stats.red,     c: '#E03030', unit: '명' },
        { l: '기타/무소속',  v: stats.etc,     c: '#888',    unit: '명' },
      ].map((s, i) => (
        <div className="stat-card" key={i}>
          <div className="stat-label">{s.l}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', marginTop: 4, lineHeight: 1.1 }}>
            {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>{s.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CandidatePanel() {
  const [search,         setSearch]         = useState('');
  const [typeFilter,     setTypeFilter]     = useState('광역단체장'); // ✅ 기본값: 광역단체장
  const [regionFilter,   setRegionFilter]   = useState('서울');       // ✅ 기본값: 서울
  const [partyFilter,    setPartyFilter]    = useState('전체');
  const [expandedKey,    setExpandedKey]    = useState(null);

  // ✅ [추가] API 데이터 상태
  const [candidates, setCandidates] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // ✅ [추가] 지역 변경 시 API 호출
  // regionFilter가 '전체'이면 서울 기본 조회
  useEffect(() => {
    const region = regionFilter === '전체' ? '서울' : regionFilter;
    setLoading(true);
    setError(null);
    setExpandedKey(null);

    // sg_type_label 파라미터: 광역단체장만 필터
    const sgType = typeFilter !== '전체' ? typeFilter : '';
    const url = sgType
      ? `/api/candidates/${encodeURIComponent(region)}?sg_type_label=${encodeURIComponent(sgType)}`
      : `/api/candidates/${encodeURIComponent(region)}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => setCandidates(data))
      .catch(err => { setError('데이터를 불러오지 못했습니다.'); setCandidates([]); })
      .finally(() => setLoading(false));
  }, [regionFilter, typeFilter]);

  // ✅ [변경] 클라이언트 사이드 필터 (정당 + 검색어만 — 지역/유형은 API로 처리)
  const filtered = useMemo(() => candidates.filter(c => {
    if (partyFilter === '소수정당' && MAJOR_PARTIES.has(c.party)) return false;
    if (partyFilter !== '전체' && partyFilter !== '소수정당' && c.party !== partyFilter) return false;
    if (search && ![c.name, c.party, c.career1, c.job].some(s => s && s.includes(search))) return false;
    return true;
  }), [candidates, partyFilter, search]);

  const hasFilter = typeFilter !== '광역단체장' || regionFilter !== '서울' || partyFilter !== '전체' || search;
  function reset() { setTypeFilter('광역단체장'); setRegionFilter('서울'); setPartyFilter('전체'); setSearch(''); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 등록 현황</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 · 실시간 조회</div>
      </div>

      {/* ✅ [변경] 실데이터 기반 요약 카드 */}
      <SummaryCards candidates={candidates} />

      {/* 필터 */}
      <div className="card" style={{ marginBottom: 14, padding: '16px 18px' }}>
        <FilterRow label="선거 유형" options={ELECTION_TYPES}     value={typeFilter}   onChange={setTypeFilter} />
        {/* ✅ [변경] 지역 필터 — SUPPORTED_REGIONS 사용 */}
        <FilterRow label="지역"     options={SUPPORTED_REGIONS}   value={regionFilter} onChange={setRegionFilter} />
        <FilterRow label="정당"     options={PARTIES}             value={partyFilter}  onChange={setPartyFilter} getStyle={pStyle} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <div className="search-bar-wrap" style={{ flex: 1, marginBottom: 0 }}>
            <span className="search-icon">🔍</span>
            <input className="search-bar" value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 정당, 경력으로 검색..." />
          </div>
          {hasFilter && (
            <button onClick={reset} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #E5E8EC', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
        {loading ? '불러오는 중...' : (
          <><strong style={{ color: '#0D1B3E' }}>{filtered.length}</strong>명 표시 중
          {[regionFilter, typeFilter, partyFilter].filter(f => f !== '전체').map((f, i) => (
            <span key={i} style={{ marginLeft: 5, color: '#1A5DC8', fontWeight: 600 }}>[{f}]</span>
          ))}
          <span style={{ marginLeft: 8, color: '#CCC' }}>· 행 클릭 시 상세 정보 확인</span></>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#FEF0F0', borderRadius: 8, color: '#E03030', fontSize: 13, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

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
              <th>주요 경력</th>
              <th>상태</th>
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>불러오는 중...</td></tr>
            ) : filtered.map(c => {
              const key        = `${c.sd_name}_${c.name}`;
              const isExpanded = expandedKey === key;
              const ps         = pStyle(c.party);
              const ss         = STATUS_STYLE[c.reg_status] ?? STATUS_STYLE['등록'];
              return (
                <Fragment key={key}>
                  <tr style={{ cursor: 'pointer', background: isExpanded ? '#EBF0FA' : undefined }}
                    onClick={() => setExpandedKey(isExpanded ? null : key)}>
                    <td style={{ fontSize: 11, color: '#888' }}>{c.sg_type_label}</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{c.sgg_name || c.sd_name}</td>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td style={{ color: '#888', fontSize: 12 }}>{c.gender}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ps.bg, color: ps.color }}>
                        {c.party}
                      </span>
                    </td>
                    <td style={{ color: '#555' }}>{c.age}세</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{c.career1}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color }}>
                        {c.reg_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: '#1A5DC8', fontSize: 11, fontWeight: 700 }}>
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ padding: '16px 24px', background: '#F7F9FC', borderTop: '2px solid #1A5DC8' }}>
                        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8 }}>
                          <strong>{c.name}</strong> ({c.party}) · {c.age}세 · {c.gender}<br />
                          {c.career1 && <span>경력: {c.career1}<br /></span>}
                          {c.career2 && <span>{c.career2}<br /></span>}
                          {c.education && <span>학력: {c.education}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>해당 조건의 후보자 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
