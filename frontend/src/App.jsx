import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import RegionDetail from './pages/RegionDetail';
import CandidatePanel from './components/CandidatePanel';
import AISummary from './components/AISummary';
import { ELECTION_DATE } from './data/mock';

function Countdown() {
  const [t, setT] = useState({});

  useEffect(() => {
    const calc = () => {
      const diff = ELECTION_DATE - new Date();
      if (diff <= 0) return setT({ done: true });
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);

  if (t.done) return <span style={{ color: '#FF6B6B', fontWeight: 800 }}>선거일 당일!</span>;

  const Block = ({ v, l }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: l === 'DAYS' ? 36 : 22,
        fontWeight: l === 'DAYS' ? 900 : 700,
        color: l === 'DAYS' ? 'white' : 'rgba(255,255,255,0.7)',
        lineHeight: 1,
        letterSpacing: '-0.03em',
      }}>
        {l === 'DAYS' ? v : String(v).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2, letterSpacing: '0.05em' }}>{l}</div>
    </div>
  );
  const Sep = () => <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, marginBottom: 8 }}>:</div>;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <Block v={t.d} l="DAYS" /><Sep /><Block v={t.h} l="HRS" /><Sep /><Block v={t.m} l="MIN" /><Sep /><Block v={t.s} l="SEC" />
    </div>
  );
}

const TABS = [
  { id: 'main',     label: '메인' },
  { id: 'result',   label: '선거개표현황' },
  { id: 'register', label: '선거등록현황' },
  { id: 'ai',       label: 'AI 검색' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('main');
  const [isLive, setIsLive] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="site-header-left">
          <button
            className={`header-badge ${isLive ? 'live' : 'offline'}`}
            onClick={() => setIsLive(v => !v)}
          >
            <div className="live-dot" />
            {isLive ? 'LIVE' : 'OFFLINE'}
          </button>
          <div>
            <div className="header-title">🗳️ 2026 대한민국 지방선거</div>
            <div className="header-sub">제8회 전국동시지방선거 · 2026년 6월 3일 (수)</div>
          </div>
        </div>
        <Countdown />
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, gap: 6, padding: '0 10px', color: isLive ? '#1A9C4E' : '#AAA' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? '#1A9C4E' : '#CCC', animation: isLive ? 'pulse 1.5s infinite' : 'none' }} />
          {isLive ? '실시간 데이터 연동 중' : '데이터 연동 대기 중'}
        </div>
      </nav>

      <div className="tab-content">
        {activeTab === 'main'     && <Dashboard     isLive={isLive} />}
        {activeTab === 'result'   && <RegionDetail  isLive={isLive} />}
        {activeTab === 'register' && <CandidatePanel />}
        {activeTab === 'ai'       && <AISummary />}
      </div>
    </>
  );
}