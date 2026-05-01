import { useState, useMemo, useEffect } from 'react';

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8', '국민의힘': '#E03030', '개혁신당': '#D06010',
  '조국혁신당': '#1A8C60', '정의당': '#4A8C10', '진보당': '#C01060',
  '무소속': '#888',
};
function pc(p) { return PARTY_COLOR[p] ?? '#7040C0'; }

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
function pStyle(p) { return PARTY_STYLE[p] ?? { bg: '#F0F0F0', color: '#666' }; }

const ALL_REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];

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
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ [수정] 컴포넌트 마운트 시 전국 17개 시도 데이터 병렬 수집
  useEffect(() => {
    setLoading(true);
    Promise.all(
      ALL_REGIONS.map(r => 
        fetch(`/api/candidates/${encodeURIComponent(r)}?sg_type_label=광역단체장`)
          .then(res => res.json())
      )
    )
    .then(results => setCandidates(results.flat()))
    .catch(err => console.error("요약 데이터 로드 실패", err))
    .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (candidates.length === 0) return null;

    const byParty  = {};
    const byRegion = {};
    const byAge    = { '20대': 0, '30대': 0, '40대': 0, '50대': 0, '60대': 0, '70대 이상': 0 };
    const byGender = { '남': 0, '여': 0 };
    let totalAge = 0;
    let validAgeCount = 0;
    
    // 등록/사퇴 상태 카운트
    let regCount = 0;
    let dropCount = 0;

    candidates.forEach(c => {
      byParty[c.party || '무소속'] = (byParty[c.party || '무소속'] || 0) + 1;
      
      const rKey = c.sd_name ? c.sd_name.slice(0, 2) : '기타';
      byRegion[rKey] = (byRegion[rKey] || 0) + 1;

      const age = parseInt(c.age);
      if (!isNaN(age)) {
        totalAge += age;
        validAgeCount++;
        if      (age < 30) byAge['20대']++;
        else if (age < 40) byAge['30대']++;
        else if (age < 50) byAge['40대']++;
        else if (age < 60) byAge['50대']++;
        else if (age < 70) byAge['60대']++;
        else               byAge['70대 이상']++;
      }

      const gender = c.gender || '미상';
      byGender[gender] = (byGender[gender] || 0) + 1;

      if (c.reg_status === '사퇴' || c.reg_status === '등록무효') dropCount++;
      else regCount++;
    });

    const total    = candidates.length;
    const avgAge   = validAgeCount > 0 ? (Math.round(totalAge / validAgeCount * 10) / 10) : 0;
    const femalePct = Math.round(((byGender['여'] || 0) / total) * 100) || 0;

    return { byParty, byRegion, byAge, byGender, total, avgAge, femalePct, regCount, dropCount };
  }, [candidates]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>실제 데이터베이스에서 전국 통계를 계산 중입니다...</div>;
  if (!stats) return <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>통계 데이터가 없습니다.</div>;

  const sortedParties  = Object.entries(stats.byParty).sort((a, b) => b[1] - a[1]);
  const sortedRegions  = Object.entries(stats.byRegion).sort((a, b) => b[1] - a[1]);
  const maxParty       = Math.max(...Object.values(stats.byParty));
  const maxRegion      = Math.max(...Object.values(stats.byRegion));
  const maxAge         = Math.max(...Object.values(stats.byAge));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3E' }}>선거 요약 통계</div>
        <div style={{ fontSize: 12, color: '#888' }}>선관위 공식 데이터 · 광역단체장 기준</div>
      </div>

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
        <div className="card">
          <SectionTitle num="1" title="정당별 후보 현황" />
          {sortedParties.map(([party, cnt]) => (
            <HBar key={party} label={party} value={cnt} max={maxParty} color={pc(party)}
              sub={`${Math.round(cnt / stats.total * 100)}%`} />
          ))}
        </div>
        <div className="card">
          <SectionTitle num="2" title="지역별 후보 현황" />
          {sortedRegions.map(([region, cnt]) => (
            <HBar key={region} label={region} value={cnt} max={maxRegion} color="#1A5DC8" />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card">
          <SectionTitle num="3" title="연령대별 분포" />
          {Object.entries(stats.byAge).map(([group, cnt]) => (
            <HBar key={group} label={group} value={cnt} max={maxAge} color="#5A70D0"
              sub={cnt > 0 ? `${Math.round(cnt / stats.total * 100)}%` : '0%'} />
          ))}
        </div>

        <div className="card">
          <SectionTitle num="4" title="성별 현황" />
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[['남', '#1A5DC8'], ['여', '#C01060']].map(([g, c]) => (
              <div key={g} style={{ flex: 1, textAlign: 'center', padding: '18px 0', borderRadius: 10, background: c + '12', border: `1.5px solid ${c}30` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.03em' }}>
                  {stats.byGender[g] ?? 0}
                </div>
                <div style={{ fontSize: 12, color: c, fontWeight: 600, marginTop: 4 }}>{g}성</div>
              </div>
            ))}
          </div>

          <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
            <div style={{ flex: stats.byGender['남'] ?? 0, background: '#1A5DC8' }} />
            <div style={{ flex: stats.byGender['여'] ?? 0, background: '#C01060' }} />
          </div>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0F2F5' }}>
            <SectionTitle num="5" title="등록 상태 현황" />
            {[
              { l: '등록', v: stats.regCount, c: '#1A9C4E' },
              { l: '사퇴/무효', v: stats.dropCount, c: '#888' },
            ].map(s => (
              <HBar key={s.l} label={s.l} value={s.v} max={stats.total} color={s.c}
                sub={`${Math.round(s.v / stats.total * 100)}%`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}