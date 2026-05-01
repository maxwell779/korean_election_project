import { useState, useRef, useEffect } from 'react';
import { getAddressGuide, getPromiseMatch, getNewsSentimentChat } from '../api/index';
import TimelineChart from './TimelineChart';
import { getMarketHistory } from '../api/index';

const SG_TYPES = ['광역단체장', '교육감', '기초단체장', '광역의회의원', '기초의회의원'];

export default function AIAnalyzer() {
  const [activeSubTab, setActiveSubTab] = useState('guide'); // 'guide' | 'promise' | 'news'
  
  // 공통 상태
  const [address, setAddress] = useState('');
  
  // 1. 투표 가이드 상태
  const [guideData, setGuideData] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState('');

  // 2. 공약 챗봇 상태
  const [chatSgType, setChatSgType] = useState('광역단체장');
  const [keyword, setKeyword] = useState('');
  const [promiseHistory, setPromiseHistory] = useState([]);
  const [promiseLoading, setPromiseLoading] = useState(false);

  // 3. 뉴스 감성 분석 상태 (새로 추가됨!)
  const [newsCandidate, setNewsCandidate] = useState('');
  const [newsHistory, setNewsHistory] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // 스크롤 자동 이동용
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [promiseHistory, newsHistory]);

  // ── 핸들러 1: 투표 가이드 ──
  const handleGuideSearch = async () => {
    if (!address.trim()) return setGuideError('주소를 입력해주세요.');
    setGuideLoading(true); setGuideError('');
    try {
      const data = await getAddressGuide(address);
      setGuideData(data);
    } catch (err) { setGuideError('지역 정보를 불러오지 못했습니다.'); }
    finally { setGuideLoading(false); }
  };

  // ── 핸들러 2: 공약 키워드 분석 ──
  const handlePromiseSubmit = async () => {
    if (!keyword.trim() || !address.trim() || promiseLoading) return;
    const userMsg = keyword.trim();
    setKeyword('');
    setPromiseHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setPromiseLoading(true);
    try {
      const data = await getPromiseMatch(address, chatSgType, userMsg);
      setPromiseHistory(prev => [...prev, { 
        role: 'assistant', source: data.source, results: data.results,
        content: data.results.length > 0 ? `'${userMsg}' 키워드로 ${address} 후보를 분석했습니다.` : `'${userMsg}' 관련 후보를 찾지 못했습니다.`
      }]);
    } catch (err) { setPromiseHistory(prev => [...prev, { role: 'assistant', content: '분석 중 오류가 발생했습니다.' }]); }
    finally { setPromiseLoading(false); }
  };

// ── 핸들러 3: 뉴스 감성 분석 (수정됨) ──
  const handleNewsSubmit = async () => {
    if (!newsCandidate.trim() || newsLoading) return;
    const candName = newsCandidate.trim();
    setNewsCandidate('');
    
    setNewsHistory(prev => [...prev, { role: 'user', content: `${candName} 후보의 최신 뉴스 평판을 분석해줘.` }]);
    setNewsLoading(true);
    
    try {
      // 1. 챗봇 API 호출
      const data = await getNewsSentimentChat(candName);
      
      // 2. 💡 [핵심 수정] 주소(대구/서울)에 상관없이 무조건 '전체' 지역에서 해당 후보를 찾음!
      let marketHistory = [];
      try {
        marketHistory = await getMarketHistory('전체', candName);
      } catch (err) { 
        console.log('폴리마켓 데이터 없음'); 
      }

      setNewsHistory(prev => [...prev, { 
        role: 'assistant', 
        content: data.message,
        events: data.events,
        marketHistory: marketHistory // 차트 데이터 삽입!
      }]);
    } catch (err) { 
      setNewsHistory(prev => [...prev, { role: 'assistant', content: '뉴스 분석 중 오류가 발생했습니다.' }]); 
    }
    finally { setNewsLoading(false); }
  };

  // 렌더링 헬퍼 1: 공약 카드
  const renderPromiseCards = (results) => {
    if (!results || results.length === 0) return null;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
        {results.slice(0, 3).map((r, i) => {
          const color = r.매칭도 >= 60 ? '#1A9C4E' : r.매칭도 >= 30 ? '#D06010' : '#888';
          return (
            <div key={i} style={{ border: `2px solid ${color}`, borderRadius: '12px', padding: '16px', background: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0D1B3E' }}>{r.후보명}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{r.정당}</div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: color, lineHeight: 1.1 }}>{r.매칭도}%</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#444', marginTop: '8px', background: '#F5F7FA', padding: '4px', borderRadius: '4px' }}>📌 {r.매칭근거}</div>
            </div>
          );
        })}
      </div>
    );
  };

// 렌더링 헬퍼 2: 뉴스 이벤트 내부의 return 부분을 아래처럼 수정
  const renderNewsEvents = (events, marketHistory) => {
    if (!events || events.length === 0) return null;
    return (
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {events.map((e, i) => {
          const isPos = e.sentiment_score >= 0.1;
          const isNeg = e.sentiment_score < -0.1;
          const labelColor = isPos ? '#1A9C4E' : isNeg ? '#E03030' : '#888';
          const labelBg = isPos ? '#E8F5E8' : isNeg ? '#FEF0F0' : '#F0F0F0';
          return (
            <div key={i} style={{ padding: '14px', background: 'white', border: '1px solid #E5E8EC', borderRadius: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: labelBg, color: labelColor }}>
                  {e.sentiment_label} ({e.sentiment_score})
                </span>
                <span style={{ fontSize: '11px', color: '#888' }}>중요도: {e.importance}/5</span>
                <span style={{ fontSize: '11px', color: '#AAA', marginLeft: 'auto' }}>{e.date}</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A', marginBottom: '6px' }}>{e.title}</div>
              <div style={{ fontSize: '12px', color: '#1A5DC8', fontWeight: 600, marginBottom: '4px' }}>💡 {e.one_line}</div>
              <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>{e.summary}</div>
            </div>
          );
        })}
        {/* 🌟 여기에 방금 만든 통합 차트 추가! */}
        {marketHistory && marketHistory.length > 0 && (
           <TimelineChart marketData={marketHistory} events={events} />
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '10px' }}>
      
      {/* 주소 전역 설정 바 */}
      <div className="card" style={{ display: 'flex', gap: '12px', padding: '16px 20px', marginBottom: '20px', background: '#F7F9FC', alignItems: 'center' }}>
        <span style={{ fontSize: '24px' }}>📍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1A5DC8', marginBottom: '4px' }}>나의 선거구 설정</div>
          <input 
            value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="주소를 입력하세요 (예: 서울 강남구, 대구 달서구)"
            style={{ width: '100%', border: '1px solid #CBD0D8', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
          />
        </div>
      </div>

      {/* 내부 3단 탭 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveSubTab('guide')} style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', border: 'none', background: activeSubTab === 'guide' ? '#0D1B3E' : '#E5E8EC', color: activeSubTab === 'guide' ? 'white' : '#666' }}>
          🗳️ 내 투표 가이드
        </button>
        <button onClick={() => setActiveSubTab('promise')} style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', border: 'none', background: activeSubTab === 'promise' ? '#0D1B3E' : '#E5E8EC', color: activeSubTab === 'promise' ? 'white' : '#666' }}>
          🤝 공약 키워드 매칭
        </button>
        <button onClick={() => setActiveSubTab('news')} style={{ flex: 1, padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', border: 'none', background: activeSubTab === 'news' ? '#0D1B3E' : '#E5E8EC', color: activeSubTab === 'news' ? 'white' : '#666' }}>
          📰 뉴스 평판 분석
        </button>
      </div>

      {/* 탭 1: 투표 가이드 (기존 동일) */}
      {activeSubTab === 'guide' && (
        <div className="card">
          <button onClick={handleGuideSearch} style={{ width: '100%', padding: '12px', background: '#1A5DC8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '20px' }}>
            내 선거구 정보 확인하기
          </button>
          {guideError && <div style={{ color: '#E03030', fontSize: '13px', textAlign: 'center' }}>{guideError}</div>}
          {guideLoading && <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>선관위 데이터 조회 중...</div>}
          {guideData && !guideLoading && (
            <div>
              <div style={{ background: '#1A365D', color: 'white', padding: '24px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 500 }}>{guideData.sd_name} {guideData.sgg_name} 유권자</h3>
                <div style={{ fontSize: '42px', fontWeight: 900, lineHeight: 1 }}>총 {Object.keys(guideData.elections).length + 2}표</div>
              </div>
              {SG_TYPES.map(type => {
                const cands = guideData.elections[type];
                if (!cands || cands.length === 0) return null;
                return (
                  <div key={type} style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0D1B3E', marginBottom: '10px', borderBottom: '2px solid #E5E8EC', paddingBottom: '6px' }}>
                      {type} <span style={{ color: '#1A5DC8', fontSize: '12px' }}>({cands.length}명)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {cands.map((c, i) => (
                        <div key={i} style={{ background: '#F7F8FA', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', border: '1px solid #E5E8EC' }}>
                          <strong style={{ color: '#1A1A1A' }}>{c.name}</strong> <span style={{ color: '#888', fontSize: '11px' }}>{c.party || '무소속'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 공약 챗봇 (기존 chat과 동일) */}
      {activeSubTab === 'promise' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E8EC', background: '#F7F9FC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D1B3E' }}>어느 선거의 공약을 찾으시나요?</span>
            <select value={chatSgType} onChange={(e) => setChatSgType(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD0D8', outline: 'none' }}>
              {SG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#FAFBFC' }}>
            {promiseHistory.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: '12px 18px', borderRadius: '16px', fontSize: '14px', lineHeight: 1.5, background: msg.role === 'user' ? '#1A5DC8' : 'white', color: msg.role === 'user' ? 'white' : '#1A1A1A', border: msg.role === 'user' ? 'none' : '1px solid #E5E8EC' }}>
                  {msg.content}
                </div>
                {msg.results && renderPromiseCards(msg.results)}
              </div>
            ))}
            {promiseLoading && <div style={{ color: '#AAA', fontSize: 13, marginTop: '10px' }}>AI 분석 중...</div>}
            <div ref={scrollRef} />
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E8EC', background: 'white', display: 'flex', gap: '10px' }}>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePromiseSubmit()} placeholder="키워드 입력 (예: 부동산, 보육)" style={{ flex: 1, border: '1px solid #CBD0D8', borderRadius: '8px', padding: '12px 16px', outline: 'none' }} />
            <button onClick={handlePromiseSubmit} style={{ background: '#1A5DC8', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', cursor: 'pointer' }}>전송</button>
          </div>
        </div>
      )}

      {/* 탭 3: 뉴스 감성 분석 (새로 추가된 기능 활용!) */}
      {activeSubTab === 'news' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '600px', padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E8EC', background: '#F7F9FC' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D1B3E' }}>후보자 최신 뉴스 AI 감성 분석</span>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>Gemini AI가 후보자의 최근 2주간 뉴스를 분석하여 평판을 요약합니다.</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#FAFBFC' }}>
            {newsHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', paddingTop: '40px', fontSize: '14px', lineHeight: 1.6 }}>
                💡 <strong>분석할 후보자의 이름</strong>을 입력해보세요.<br/>(예: 오세훈, 김동연, 정원오)
              </div>
            ) : (
              newsHistory.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '12px 18px', borderRadius: '16px', fontSize: '14px', lineHeight: 1.5, background: msg.role === 'user' ? '#1A5DC8' : 'white', color: msg.role === 'user' ? 'white' : '#1A1A1A', border: msg.role === 'user' ? 'none' : '1px solid #E5E8EC' }}>
                    {msg.content}
                  </div>
                  {/* AI가 분석한 뉴스 이벤트 목록 렌더링 */}
                  {msg.events && renderNewsEvents(msg.events, msg.marketHistory)}
                </div>
              ))
            )}
            {newsLoading && <div style={{ color: '#AAA', fontSize: 13, marginTop: '10px' }}>뉴스를 수집하고 AI 감성 분석을 진행 중입니다...</div>}
            <div ref={scrollRef} />
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E8EC', background: 'white', display: 'flex', gap: '10px' }}>
            <input value={newsCandidate} onChange={e => setNewsCandidate(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNewsSubmit()} placeholder="후보자 이름 입력 (예: 한동훈)" style={{ flex: 1, border: '1px solid #CBD0D8', borderRadius: '8px', padding: '12px 16px', outline: 'none' }} />
            <button onClick={handleNewsSubmit} style={{ background: '#1A5DC8', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', cursor: 'pointer' }}>분석 시작</button>
          </div>
        </div>
      )}

    </div>
  );
}