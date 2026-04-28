import { useState } from 'react';
import { CANDIDATE_DATA } from '../data/mock';

export default function CandidatePanel() {
  const [search, setSearch] = useState('');

  const filtered = CANDIDATE_DATA.filter(c =>
    c.name.includes(search) || c.region.includes(search) || c.party.includes(search)
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 등록 현황</div>
        <div style={{ fontSize: 13, color: '#888' }}>총 <strong style={{ color: '#0D1B3E' }}>148명</strong> 등록</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { l: '총 후보자',   v: '148', c: '#0D1B3E' },
          { l: '민주당',      v: '52',  c: '#1A5DC8' },
          { l: '국민의힘',    v: '51',  c: '#E03030' },
          { l: '기타/무소속', v: '45',  c: '#888'    },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', marginTop: 4 }}>{s.v}명</div>
          </div>
        ))}
      </div>

      <div className="search-bar-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-bar"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 지역, 정당으로 검색..."
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="reg-table">
          <thead>
            <tr><th>선거구</th><th>후보자명</th><th>정당</th><th>나이</th><th>주요 경력</th><th>지지율</th></tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={i}>
                <td style={{ color: '#888', fontSize: 12 }}>{c.region}</td>
                <td style={{ fontWeight: 700 }}>{c.name}</td>
                <td><span className={`party-chip ${c.partyKey}`}>{c.party}</span></td>
                <td style={{ color: '#555' }}>{c.age}세</td>
                <td style={{ color: '#555', fontSize: 12 }}>{c.career}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ height: '100%', borderRadius: 3, background: c.partyKey === 'blue' ? '#1A5DC8' : '#E03030', width: `${c.poll}%` }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.partyKey === 'blue' ? '#1A5DC8' : '#E03030', width: 32 }}>{c.poll}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}