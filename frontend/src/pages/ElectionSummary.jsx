import { useState, useEffect } from 'react';
import { getCandidateStats } from '../api/index';

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8', '국민의힘': '#E03030', '개혁신당': '#D06010',
  '조국혁신당': '#1A8C60', '정의당': '#4A8C10', '진보당': '#C01060',
  '무소속': '#888',
};
function pc(p) { return PARTY_COLOR[p] ?? '#7040C0'; }

function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <div style={{ width: 90, fontSize: 12, color: '#444', textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease', minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 36, fontSize: 12, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#AAA', flexShrink: 0, minWidth: 30 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ num, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ background: '#0D1B3E', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>{title}</span>
    </div>
  );
}

export default function ElectionSummary() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCandidateStats()
      .then(setStats)
      .catch(err => console.error('통계 로드 실패', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>전국 통계 집계 중...</div>;
  if (!stats)  return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>통계 데이터가 없습니다.</div>;

  const sortedParties = Object.entries(stats.by_party).sort((a, b) => b[1] - a[1]);
  const sortedRegions = Object.entries(stats.by_region).sort((a, b) => b[1] - a[1]);
  const ageOrder      = ['20대 이하', '30대', '40대', '50대', '60대', '70대 이상'];
  const maxParty      = Math.max(...Object.values(stats.by_party));
  const maxRegion     = Math.max(...Object.values(stats.by_region));
  const maxAge        = Math.max(...Object.values(stats.by_age_group));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 요약 통계</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 · 전체 후보자 기준</div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: '총 후보자 수',   v: stats.total.toLocaleString(), unit: '명', c: '#0D1B3E' },
          { l: '평균 연령',      v: stats.avg_age,                unit: '세', c: '#1A5DC8' },
          { l: '여성 후보 비율', v: stats.female_pct,             unit: '%',  c: '#C01060' },
          { l: '참여 정당 수',   v: Object.keys(stats.by_party).length, unit: '개', c: '#D06010' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
              {s.v}<span style={{ fontSize: 13, fontWeight: 500 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* 정당별 */}
        <div className="card">
          <SectionTitle num="1" title="정당별 후보 현황" />
          {sortedParties.map(([party, cnt]) => (
            <HBar key={party} label={party} value={cnt} max={maxParty} color={pc(party)}
              sub={`${Math.round(cnt / stats.total * 100)}%`} />
          ))}
        </div>
        {/* 지역별 */}
        <div className="card">
          <SectionTitle num="2" title="지역별 후보 현황" />
          {sortedRegions.map(([region, cnt]) => (
            <HBar key={region} label={region} value={cnt} max={maxRegion} color="#1A5DC8" />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* 연령대별 */}
        <div className="card">
          <SectionTitle num="3" title="연령대별 분포" />
          {ageOrder.map(group => {
            const cnt = stats.by_age_group[group] ?? 0;
            return (
              <HBar key={group} label={group} value={cnt} max={maxAge} color="#5A70D0"
                sub={cnt > 0 ? `${Math.round(cnt / stats.total * 100)}%` : '0%'} />
            );
          })}
        </div>

        {/* 성별 */}
        <div className="card">
          <SectionTitle num="4" title="성별 현황" />
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[['남', '#1A5DC8'], ['여', '#C01060']].map(([g, c]) => (
              <div key={g} style={{ flex: 1, textAlign: 'center', padding: '18px 0', borderRadius: 10, background: c + '12', border: `1.5px solid ${c}30` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.03em' }}>
                  {(stats.by_gender[g] ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: c, fontWeight: 600, marginTop: 4 }}>{g}성</div>
                <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
                  {Math.round(((stats.by_gender[g] ?? 0) / stats.total) * 100)}%
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
            <div style={{ flex: stats.by_gender['남'] ?? 0, background: '#1A5DC8' }} />
            <div style={{ flex: stats.by_gender['여'] ?? 0, background: '#C01060' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
            <span style={{ color: '#1A5DC8', fontWeight: 600 }}>남 {Math.round(((stats.by_gender['남'] ?? 0) / stats.total) * 100)}%</span>
            <span style={{ color: '#C01060', fontWeight: 600 }}>여 {Math.round(((stats.by_gender['여'] ?? 0) / stats.total) * 100)}%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: '#CCC', textAlign: 'right' }}>
        * 사퇴·등록무효 후보 제외 기준 · 선관위 데이터 기반
      </div>
    </div>
  );
}
