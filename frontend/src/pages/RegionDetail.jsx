import { useState } from 'react';
import { PROVINCES } from '../data/mock';

export default function RegionDetail({ isLive }) {
  const [search, setSearch] = useState('');

  const rows = PROVINCES
    .filter(p => !search || p.name.includes(search) || p.short.includes(search))
    .map((p, i) => ({
      ...p,
      counted: isLive ? (25 + i * 4) % 100 : 0,
      dem:     isLive ? (p.party === 'blue' ? 48 + (i % 12) : 32 + (i % 15)) : 0,
      ppp:     isLive ? (p.party === 'red'  ? 48 + (i % 12) : 32 + (i % 15)) : 0,
      etc:     isLive ? 5 : 0,
      leading: isLive ? (p.party === 'blue' ? '민주당' : p.party === 'red' ? '국민의힘' : '—') : '—',
    }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 개표 현황</div>
        <div className={`realtime-tag ${isLive ? 'active' : 'inactive'}`}>
          <div className={`realtime-dot ${isLive ? 'active' : 'inactive'}`} />
          {isLive ? '실시간 업데이트 중' : '실시간 업데이트 중이 아님'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: '전국 개표율',       value: isLive ? '43.2%' : '0%',  sub: isLive ? '8,420 / 19,500 투표소' : '개표가 시작되지 않았습니다', color: '#1A9C4E' },
          { label: '민주당 선두 지역',  value: isLive ? '11곳'  : '0곳', sub: isLive ? '광역단체장 기준' : '집계 전', color: '#1A5DC8' },
          { label: '국민의힘 선두 지역', value: isLive ? '6곳'  : '0곳', sub: isLive ? '광역단체장 기준' : '집계 전', color: '#E03030' },
        ].map((c, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.color, fontSize: isLive ? 32 : 22 }}>{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="search-bar-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-bar"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="지역명으로 검색..."
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="reg-table">
          <thead>
            <tr><th>지역</th><th>개표율</th><th>민주당</th><th>국민의힘</th><th>기타</th><th>선두</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.short}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#1A9C4E', borderRadius: 3, width: `${r.counted}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#555', width: 36 }}>{r.counted}%</span>
                  </div>
                </td>
                <td style={{ color: isLive ? '#1A5DC8' : '#CCC', fontWeight: 700 }}>{r.dem}%</td>
                <td style={{ color: isLive ? '#E03030' : '#CCC', fontWeight: 700 }}>{r.ppp}%</td>
                <td style={{ color: '#888' }}>{r.etc}%</td>
                <td>
                  {r.leading === '—'
                    ? <span style={{ color: '#CCC' }}>—</span>
                    : <span className={`party-chip ${r.party === 'blue' ? 'blue' : 'red'}`}>{r.leading}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}