import { useMemo } from 'react';
import { CANDIDATE_DATA } from '../data/mock';

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8', '국민의힘': '#E03030', '개혁신당': '#D06010',
  '조국혁신당': '#1A8C60', '정의당': '#4A8C10', '진보당': '#C01060',
  '무소속': '#888',
};
function pc(p) { return PARTY_COLOR[p] ?? '#7040C0'; }

// 수평 막대 하나
function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <div style={{ width: 90, fontSize: 12, color: '#444', textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: '#F0F2F5', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease', minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 36, fontSize: 12, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#AAA', flexShrink: 0 }}>{sub}</div>}
    </div>
  );
}

// 섹션 헤더
function SectionTitle({ num, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ background: '#0D1B3E', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>{title}</span>
    </div>
  );
}

export default function ElectionSummary() {
  const stats = useMemo(() => {
    const byParty  = {};
    const byRegion = {};
    const byAge    = { '20대': 0, '30대': 0, '40대': 0, '50대': 0, '60대': 0, '70대 이상': 0 };
    const byGender = { '남': 0, '여': 0 };

    CANDIDATE_DATA.forEach(c => {
      byParty[c.party]  = (byParty[c.party]  || 0) + 1;

      // 지역 두 글자로 압축
      const rKey = c.region.includes('광주·전남') ? '광주·전남' : c.region.slice(0, 2);
      byRegion[rKey] = (byRegion[rKey] || 0) + 1;

      if      (c.age < 30) byAge['20대']++;
      else if (c.age < 40) byAge['30대']++;
      else if (c.age < 50) byAge['40대']++;
      else if (c.age < 60) byAge['50대']++;
      else if (c.age < 70) byAge['60대']++;
      else                 byAge['70대 이상']++;

      byGender[c.gender] = (byGender[c.gender] || 0) + 1;
    });

    const total    = CANDIDATE_DATA.length;
    const avgAge   = Math.round(CANDIDATE_DATA.reduce((s, c) => s + c.age, 0) / total * 10) / 10;
    const femalePct = Math.round((byGender['여'] / total) * 100);

    return { byParty, byRegion, byAge, byGender, total, avgAge, femalePct };
  }, []);

  const sortedParties  = Object.entries(stats.byParty).sort((a, b) => b[1] - a[1]);
  const sortedRegions  = Object.entries(stats.byRegion).sort((a, b) => b[1] - a[1]);
  const maxParty       = Math.max(...Object.values(stats.byParty));
  const maxRegion      = Math.max(...Object.values(stats.byRegion));
  const maxAge         = Math.max(...Object.values(stats.byAge));

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 요약 통계</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 (2026-04-28) · 광역단체장 기준</div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { l: '총 후보자 수',   v: stats.total,         unit: '명',  c: '#0D1B3E' },
          { l: '평균 연령',      v: stats.avgAge,        unit: '세',  c: '#1A5DC8' },
          { l: '여성 후보 비율', v: `${stats.femalePct}`, unit: '%', c: '#C01060' },
          { l: '참여 정당 수',   v: Object.keys(stats.byParty).length, unit: '개', c: '#D06010' },
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
        {/* 정당별 현황 */}
        <div className="card">
          <SectionTitle num="1" title="정당별 후보 현황" />
          {sortedParties.map(([party, cnt]) => (
            <HBar key={party} label={party} value={cnt} max={maxParty} color={pc(party)}
              sub={`${Math.round(cnt / stats.total * 100)}%`} />
          ))}
        </div>

        {/* 지역별 현황 */}
        <div className="card">
          <SectionTitle num="2" title="지역별 후보 현황" />
          {sortedRegions.map(([region, cnt]) => (
            <HBar key={region} label={region} value={cnt} max={maxRegion} color="#1A5DC8" />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* 연령대별 분포 */}
        <div className="card">
          <SectionTitle num="3" title="연령대별 분포" />
          {Object.entries(stats.byAge).map(([group, cnt]) => (
            <HBar key={group} label={group} value={cnt} max={maxAge} color="#5A70D0"
              sub={cnt > 0 ? `${Math.round(cnt / stats.total * 100)}%` : ''} />
          ))}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F2F5', fontSize: 12, color: '#AAA' }}>
            최연소 {Math.min(...CANDIDATE_DATA.map(c => c.age))}세 · 최연장 {Math.max(...CANDIDATE_DATA.map(c => c.age))}세 · 평균 {stats.avgAge}세
          </div>
        </div>

        {/* 성별 현황 */}
        <div className="card">
          <SectionTitle num="4" title="성별 현황" />
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[['남', '#1A5DC8'], ['여', '#C01060']].map(([g, c]) => (
              <div key={g} style={{ flex: 1, textAlign: 'center', padding: '18px 0', borderRadius: 10, background: c + '12', border: `1.5px solid ${c}30` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.03em' }}>
                  {stats.byGender[g] ?? 0}
                </div>
                <div style={{ fontSize: 12, color: c, fontWeight: 600, marginTop: 4 }}>{g}성</div>
                <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
                  {Math.round(((stats.byGender[g] ?? 0) / stats.total) * 100)}%
                </div>
              </div>
            ))}
          </div>
          {/* 성비 막대 */}
          <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
            <div style={{ flex: stats.byGender['남'] ?? 0, background: '#1A5DC8' }} />
            <div style={{ flex: stats.byGender['여'] ?? 0, background: '#C01060' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#AAA' }}>
            <span style={{ color: '#1A5DC8', fontWeight: 600 }}>남 {Math.round(((stats.byGender['남'] ?? 0) / stats.total) * 100)}%</span>
            <span style={{ color: '#C01060', fontWeight: 600 }}>여 {Math.round(((stats.byGender['여'] ?? 0) / stats.total) * 100)}%</span>
          </div>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0F2F5' }}>
            <SectionTitle num="5" title="등록 상태 현황 (mock)" />
            {[
              { l: '등록', v: stats.total - 4, c: '#1A9C4E' },
              { l: '사퇴', v: 4,              c: '#888' },
            ].map(s => (
              <HBar key={s.l} label={s.l} value={s.v} max={stats.total} color={s.c}
                sub={`${Math.round(s.v / stats.total * 100)}%`} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: '#CCC', textAlign: 'right' }}>
        * 현재 데이터는 광역단체장 후보만 포함 · 전체 8,578명 통계는 백엔드 연동 후 업데이트됩니다.
      </div>
    </div>
  );
}