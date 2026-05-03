import { useState, useMemo, useEffect, Fragment } from 'react';
import { getCandidates, getNews } from '../api/index';

const ELECTION_TYPES = ['전체', '광역단체장', '광역의회의원', '교육감', '국회의원보궐', '기초단체장', '기초의회의원'];

// ✅ [수정] 전국 17개 시도 모두 추가
const ALL_REGIONS = ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '전남광주통합', '경북', '경남', '제주'];

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

function SummaryCards({ candidates }) {
  const stats = useMemo(() => {
    const byParty = {};
    candidates.forEach(c => { byParty[c.party || '무소속'] = (byParty[c.party || '무소속'] || 0) + 1; });
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

function timeAgo(pubDate) {
  if (!pubDate) return '';
  const diff = Date.now() - new Date(pubDate).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '방금 전';
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: '#AAA', minWidth: 52, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#444' }}>{value}</span>
    </div>
  );
}

function CandidatePhoto({ c, color }) {
  const initials = c.name?.slice(-1) ?? '?';
  return (
    <div style={{
      width: 84, height: 106, borderRadius: 10,
      background: color + '14', border: `2px solid ${color}28`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 34, fontWeight: 800, color,
    }}>
      {initials}
    </div>
  );
}

function ExpandedDetail({ c }) {
  const [news,        setNews]        = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const ps    = pStyle(c.party);
  const color = ps.color;

  useEffect(() => {
    setNewsLoading(true);
    getNews('전체', c.name)
      .then(data => setNews((data || []).slice(0, 5)))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [c.name]);

  const birthday = c.birthday
    ? `${c.birthday.slice(0, 4)}.${c.birthday.slice(4, 6)}.${c.birthday.slice(6, 8)}`
    : null;

  return (
    <div style={{ padding: '20px 28px', background: '#F7F9FC', borderTop: `2px solid ${color}` }}>
      {/* ① 프로필 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 24, marginBottom: 20 }}>

        {/* 사진 */}
        <CandidatePhoto c={c} color={color} />

        {/* 기본 정보 */}
        <div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0D1B3E' }}>{c.name}</span>
            {c.hanja_name && (
              <span style={{ fontSize: 13, color: '#AAA', marginLeft: 7, fontWeight: 400 }}>{c.hanja_name}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ background: ps.bg, color: ps.color, padding: '3px 11px', borderRadius: 14, fontSize: 12, fontWeight: 700 }}>
              {c.party || '무소속'}
            </span>
            <span style={{ background: '#F0F2F5', color: '#555', padding: '3px 11px', borderRadius: 14, fontSize: 12, fontWeight: 600 }}>
              {c.sg_type_label}
            </span>
          </div>
          <InfoRow label="나이"     value={c.age ? `${c.age}세` : null} />
          <InfoRow label="성별"     value={c.gender === '남' ? '남성' : c.gender === '여' ? '여성' : c.gender} />
          <InfoRow label="생년월일" value={birthday} />
          <InfoRow label="직업"     value={c.job} />
          <InfoRow label="선거구"   value={`${c.sd_name || ''} ${c.sgg_name && c.sgg_name !== c.sd_name ? c.sgg_name : ''}`.trim()} />
        </div>

        {/* 경력·학력 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.06em', marginBottom: 10 }}>경력 및 학력</div>
          {c.career1 && (
            <div style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
              <span style={{ color: color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>▸</span>
              <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{c.career1}</span>
            </div>
          )}
          {c.career2 && (
            <div style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
              <span style={{ color: color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>▸</span>
              <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{c.career2}</span>
            </div>
          )}
          {c.education && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E8EC',
              fontSize: 12, color: '#777', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: '#999', marginRight: 6 }}>학력</span>
              {c.education}
            </div>
          )}
        </div>
      </div>

      {/* ② 뉴스 영역 */}
      <div style={{ borderTop: '1px solid #E5E8EC', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3E', marginBottom: 10 }}>
          {c.name} 관련 최신 뉴스
        </div>
        {newsLoading ? (
          <div style={{ color: '#AAA', fontSize: 13, padding: '8px 0' }}>뉴스 불러오는 중...</div>
        ) : news.length === 0 ? (
          <div style={{ color: '#AAA', fontSize: 13, padding: '8px 0' }}>최근 1년 이내 관련 뉴스가 없습니다.</div>
        ) : news.map((n, i) => (
          <div key={i}
            onClick={() => n.url && window.open(n.url, '_blank')}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 0',
              borderBottom: i < news.length - 1 ? '1px solid #F0F2F5' : 'none',
              cursor: n.url ? 'pointer' : 'default',
            }}>
            <span style={{ color: '#CBD0D8', fontSize: 10, flexShrink: 0, paddingTop: 4 }}>●</span>
            <span style={{ flex: 1, fontSize: 13, color: '#1A1A1A', lineHeight: 1.45 }}>{n.title}</span>
            <span style={{ fontSize: 11, color: '#AAA', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' }}>
              {timeAgo(n.pub_date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CandidatePanel() {
  const [search,         setSearch]         = useState('');
  const [typeFilter,     setTypeFilter]     = useState('전체'); 
  const [regionFilter,   setRegionFilter]   = useState('전체'); 
  const [partyFilter,    setPartyFilter]    = useState('전체');
  const [expandedKey,    setExpandedKey]    = useState(null);
  
  // ✅ [추가] 정렬 및 페이징 상태
  const [sortBy,         setSortBy]         = useState('name'); // 'name' | 'age'
  const [currentPage,    setCurrentPage]    = useState(1);
  const itemsPerPage = 20;

  const [candidates, setCandidates] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // ✅ [수정] 17개 지역 전체 호출 대응 로직
  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpandedKey(null);
    setCurrentPage(1); // 필터 변경 시 1페이지로 리셋

    const sgType = typeFilter !== '전체' ? typeFilter : '';
    
    const fetchRegion = (region) => {
      const url = sgType
        ? `/api/candidates/${encodeURIComponent(region)}?sg_type_label=${encodeURIComponent(sgType)}`
        : `/api/candidates/${encodeURIComponent(region)}`;
      return fetch(url).then(res => res.json());
    };

    // huboid 기준 중복 제거 (DB에 동일 huboid 중복 레코드 존재)
    const dedup = (list) => {
      const seen = new Set();
      return list.filter(c => {
        const key = c.huboid || `${c.name}_${c.sd_name}_${c.sgg_name}_${c.sg_type_label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    if (regionFilter === '전체') {
      const realRegions = ALL_REGIONS.filter(r => r !== '전체');
      Promise.all(realRegions.map(fetchRegion))
        .then(results => setCandidates(dedup(results.flat())))
        .catch(err => { setError('데이터를 불러오지 못했습니다.'); setCandidates([]); })
        .finally(() => setLoading(false));
    } else {
      fetchRegion(regionFilter)
        .then(data => setCandidates(dedup(data)))
        .catch(err => { setError('데이터를 불러오지 못했습니다.'); setCandidates([]); })
        .finally(() => setLoading(false));
    }
  }, [regionFilter, typeFilter]);

  // ✅ 클라이언트 사이드 필터 및 정렬
  const filteredAndSorted = useMemo(() => {
    let result = candidates.filter(c => {
      if (partyFilter === '소수정당' && MAJOR_PARTIES.has(c.party)) return false;
      if (partyFilter !== '전체' && partyFilter !== '소수정당' && c.party !== partyFilter) return false;
      if (search && ![c.name, c.party, c.career1, c.job, c.sgg_name].some(s => s && s.includes(search))) return false;
      return true;
    });

    // 정렬 로직 (이름순 vs 나이순)
    result.sort((a, b) => {
      if (sortBy === 'age') {
        const ageA = parseInt(a.age) || 999; // 나이 없으면 맨 뒤로
        const ageB = parseInt(b.age) || 999;
        return ageA - ageB;
      } else {
        return (a.name || '').localeCompare(b.name || '');
      }
    });

    return result;
  }, [candidates, partyFilter, search, sortBy]);

  // ✅ 페이징 로직 적용
  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const paginatedData = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 1~10 블록 페이징 계산
  const currentBlock = Math.ceil(currentPage / 10);
  const startPage = (currentBlock - 1) * 10 + 1;
  const endPage = Math.min(startPage + 9, totalPages);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const hasFilter = typeFilter !== '전체' || regionFilter !== '전체' || partyFilter !== '전체' || search;
  function reset() { setTypeFilter('전체'); setRegionFilter('전체'); setPartyFilter('전체'); setSearch(''); setSortBy('name'); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 등록 현황</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 · 실시간 조회</div>
      </div>

      <SummaryCards candidates={candidates} />

      <div className="card" style={{ marginBottom: 14, padding: '16px 18px' }}>
        <FilterRow label="선거 유형" options={ELECTION_TYPES}     value={typeFilter}   onChange={setTypeFilter} />
        <FilterRow label="지역"     options={ALL_REGIONS}         value={regionFilter} onChange={setRegionFilter} />
        <FilterRow label="정당"     options={PARTIES}             value={partyFilter}  onChange={setPartyFilter} getStyle={pStyle} />
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <div className="search-bar-wrap" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <span className="search-icon">🔍</span>
            <input className="search-bar" value={search} onChange={e => {setSearch(e.target.value); setCurrentPage(1);}} placeholder="이름, 정당, 선거구 검색..." />
          </div>
          
          {/* ✅ 정렬 버튼 추가 */}
          <div style={{ display: 'flex', background: '#F5F7FA', borderRadius: 8, padding: 3, border: '1px solid #E5E8EC' }}>
            <button onClick={() => setSortBy('name')} style={{ padding: '6px 12px', border: 'none', background: sortBy === 'name' ? 'white' : 'transparent', borderRadius: 5, fontSize: 12, fontWeight: 600, color: sortBy === 'name' ? '#1A5DC8' : '#888', cursor: 'pointer', boxShadow: sortBy === 'name' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              이름순
            </button>
            <button onClick={() => setSortBy('age')} style={{ padding: '6px 12px', border: 'none', background: sortBy === 'age' ? 'white' : 'transparent', borderRadius: 5, fontSize: 12, fontWeight: 600, color: sortBy === 'age' ? '#1A5DC8' : '#888', cursor: 'pointer', boxShadow: sortBy === 'age' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              나이순
            </button>
          </div>

          {hasFilter && (
            <button onClick={reset} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #E5E8EC', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
        {loading ? '데이터베이스에서 불러오는 중...' : (
          <><strong style={{ color: '#0D1B3E' }}>{filteredAndSorted.length}</strong>명 표시 중
          {[regionFilter, typeFilter, partyFilter].filter(f => f !== '전체').map((f, i) => (
            <span key={i} style={{ marginLeft: 5, color: '#1A5DC8', fontWeight: 600 }}>[{f}]</span>
          ))}
          </>
        )}
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#FEF0F0', borderRadius: 8, color: '#E03030', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

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
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>대용량 데이터를 처리 중입니다. 잠시만 기다려주세요...</td></tr>
            ) : paginatedData.map(c => {
              const key        = `${c.id}_${c.name}`; // id 사용 권장
              const isExpanded = expandedKey === key;
              const ps         = pStyle(c.party);
              const ss         = STATUS_STYLE[c.reg_status] ?? STATUS_STYLE['등록'];
              return (
                <Fragment key={key}>
                  <tr style={{ cursor: 'pointer', background: isExpanded ? '#EBF0FA' : undefined }}
                    onClick={() => setExpandedKey(isExpanded ? null : key)}>
                    <td style={{ fontSize: 11, color: '#888' }}>{c.sg_type_label}</td>
                    <td style={{ color: '#555', fontSize: 12 }}>{c.sd_name} {c.sgg_name !== c.sd_name ? c.sgg_name : ''}</td>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td style={{ color: '#888', fontSize: 12 }}>{c.gender}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ps.bg, color: ps.color }}>
                        {c.party || '무소속'}
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
                      <td colSpan={9} style={{ padding: 0 }}>
                        <ExpandedDetail c={c} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && paginatedData.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>해당 조건의 후보자 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
        
        {/* ✅ [추가] 1~10 블록 페이징 UI */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '20px 0', borderTop: '1px solid #E5E8EC', background: 'white' }}>
            <button 
              disabled={startPage === 1} 
              onClick={() => setCurrentPage(startPage - 1)}
              style={{ padding: '6px 12px', border: '1px solid #E5E8EC', background: 'white', borderRadius: 6, cursor: startPage === 1 ? 'not-allowed' : 'pointer', color: startPage === 1 ? '#CCC' : '#444' }}
            >
              이전
            </button>

            {pageNumbers.map(num => (
              <button 
                key={num} 
                onClick={() => setCurrentPage(num)}
                style={{ 
                  width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: currentPage === num ? '#1A5DC8' : 'transparent',
                  color: currentPage === num ? 'white' : '#666',
                  fontWeight: currentPage === num ? 700 : 500
                }}
              >
                {num}
              </button>
            ))}

            <button 
              disabled={endPage === totalPages} 
              onClick={() => setCurrentPage(endPage + 1)}
              style={{ padding: '6px 12px', border: '1px solid #E5E8EC', background: 'white', borderRadius: 6, cursor: endPage === totalPages ? 'not-allowed' : 'pointer', color: endPage === totalPages ? '#CCC' : '#444' }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}