import { useState, useMemo, useEffect } from 'react';

const ALL_REGIONS = ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '전국'];
const CATEGORIES  = ['전체', '광역단체장', '국회의원보궐', '공통이슈'];

function FilterRow({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 5, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background:  active ? '#0D1B3E' : 'white',
              color:       active ? 'white' : '#888',
              borderColor: active ? '#0D1B3E' : '#DDD',
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function NewsPanel() {
  const [regionFilter,   setRegionFilter]   = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [search,         setSearch]         = useState('');
  
  const [news,       setNews]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 필터 변경 시 API 다시 호출
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    const catQuery = categoryFilter !== '전체' ? `&category=${encodeURIComponent(categoryFilter)}` : '';
    const url = `/api/news/${encodeURIComponent(regionFilter)}?limit=2000&days=365${catQuery}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => setNews(data))
      .catch(err => { setError('뉴스를 불러오지 못했습니다.'); setNews([]); })
      .finally(() => setLoading(false));
  }, [regionFilter, categoryFilter]);

  // 클라이언트 검색어 필터
  const filteredNews = useMemo(() => {
    if (!search) return news;
    return news.filter(n => 
      (n.title && n.title.includes(search)) || 
      (n.candidate && n.candidate.includes(search))
    );
  }, [news, search]);

  // 페이징 계산
  const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
  const paginatedData = filteredNews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const currentBlock = Math.ceil(currentPage / 10);
  const startPage = (currentBlock - 1) * 10 + 1;
  const endPage = Math.min(startPage + 9, totalPages);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const hasFilter = regionFilter !== '전체' || categoryFilter !== '전체' || search;
  function reset() { setRegionFilter('전체'); setCategoryFilter('전체'); setSearch(''); }

  // 날짜 포맷팅 헬퍼
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>네이버 뉴스 수집 현황</div>
        <div style={{ fontSize: 12, color: '#888' }}>수집된 뉴스 데이터 · AI 분석 대기중</div>
      </div>

      <div className="card" style={{ marginBottom: 14, padding: '16px 18px' }}>
        <FilterRow label="지역"     options={ALL_REGIONS} value={regionFilter}   onChange={setRegionFilter} />
        <FilterRow label="선거 유형" options={CATEGORIES}  value={categoryFilter} onChange={setCategoryFilter} />
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <div className="search-bar-wrap" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <span className="search-icon">🔍</span>
            <input 
              className="search-bar" 
              value={search} 
              onChange={e => {setSearch(e.target.value); setCurrentPage(1);}} 
              placeholder="기사 제목 또는 후보자 이름으로 검색..." 
            />
          </div>

          {hasFilter && (
            <button onClick={reset} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #E5E8EC', background: 'white', color: '#666', cursor: 'pointer' }}>
              필터 초기화
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>
        {loading ? '데이터베이스에서 불러오는 중...' : (
          <><strong style={{ color: '#0D1B3E' }}>{filteredNews.length}</strong>건의 기사 표시 중</>
        )}
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#FEF0F0', borderRadius: 8, color: '#E03030', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="reg-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '130px' }}>보도일시</th>
              <th style={{ width: '80px' }}>지역</th>
              <th style={{ width: '100px' }}>유형</th>
              <th style={{ width: '80px' }}>후보자</th>
              <th>기사 제목</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>수집된 뉴스를 불러오는 중입니다...</td></tr>
            ) : paginatedData.map((n, i) => (
              <tr key={n.id || i}>
                <td style={{ fontSize: 11, color: '#888' }}>{formatDate(n.pub_date)}</td>
                <td style={{ color: '#555', fontSize: 12, fontWeight: 600 }}>{n.region}</td>
                <td style={{ color: '#555', fontSize: 12 }}>{n.category}</td>
                <td style={{ fontWeight: 700, color: '#1A5DC8' }}>{n.candidate || '-'}</td>
                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={n.url} target="_blank" rel="noreferrer" style={{ color: '#333', textDecoration: 'none', fontWeight: 500 }}>
                    {n.title}
                  </a>
                </td>
              </tr>
            ))}
            {!loading && paginatedData.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#AAA', padding: 40 }}>조건에 맞는 뉴스가 없습니다.</td></tr>
            )}
          </tbody>
        </table>

        {/* 페이징 UI */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '20px 0', borderTop: '1px solid #E5E8EC', background: 'white' }}>
            <button 
              disabled={startPage === 1} 
              onClick={() => setCurrentPage(startPage - 1)}
              style={{ padding: '6px 12px', border: '1px solid #E5E8EC', background: 'white', borderRadius: 6, cursor: startPage === 1 ? 'not-allowed' : 'pointer', color: startPage === 1 ? '#CCC' : '#444' }}
            >이전</button>

            {pageNumbers.map(num => (
              <button 
                key={num} onClick={() => setCurrentPage(num)}
                style={{ 
                  width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: currentPage === num ? '#1A5DC8' : 'transparent',
                  color: currentPage === num ? 'white' : '#666',
                  fontWeight: currentPage === num ? 700 : 500
                }}
              >{num}</button>
            ))}

            <button 
              disabled={endPage === totalPages} 
              onClick={() => setCurrentPage(endPage + 1)}
              style={{ padding: '6px 12px', border: '1px solid #E5E8EC', background: 'white', borderRadius: 6, cursor: endPage === totalPages ? 'not-allowed' : 'pointer', color: endPage === totalPages ? '#CCC' : '#444' }}
            >다음</button>
          </div>
        )}
      </div>
    </div>
  );
}