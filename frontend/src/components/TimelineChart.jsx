import { useMemo } from 'react';
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TimelineChart({ marketData = [], events = [] }) {
  
  // 폴리마켓 확률 데이터와 뉴스 이벤트 데이터를 날짜 기준으로 병합
  const chartData = useMemo(() => {
    const map = {};
    
    // 1. 기본 선 그래프를 위한 폴리마켓 데이터
    marketData.forEach(m => {
      map[m.date] = { date: m.date, prob: m.probability_pct, events: [] };
    });

    // 2. 뉴스 이벤트 추가 (해당 날짜에 점 찍기 위함)
    let lastProb = 50; 
    events.forEach(e => {
      if (!map[e.date]) {
        map[e.date] = { date: e.date, prob: null, events: [] };
      }
      map[e.date].events.push(e);
      // 이벤트의 긍정/부정에 따라 마커(점) 색상을 결정
      map[e.date].markerScore = e.sentiment_score;
    });

    // 3. 날짜순 정렬 및 빈 공간 확률 채우기
    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(d => {
      if (d.prob !== null) lastProb = d.prob;
      else d.prob = lastProb; // 시장 데이터가 없는 날은 이전 확률 유지
    });

    return sorted;
  }, [marketData, events]);

  if (chartData.length === 0) return null;

  // 커스텀 툴팁 (마우스 올렸을 때)
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #E5E8EC', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '260px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>{data.date}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A5DC8', marginBottom: 8 }}>당선 예측 확률: {data.prob}%</div>
          {data.events && data.events.map((e, i) => {
            const color = e.sentiment_score >= 0.1 ? '#1A9C4E' : e.sentiment_score < -0.1 ? '#E03030' : '#888';
            return (
              <div key={i} style={{ fontSize: 11, color: '#555', marginTop: 6, paddingLeft: 8, borderLeft: `3px solid ${color}` }}>
                <strong style={{ color: '#111' }}>{e.one_line}</strong><br />
                {e.sentiment_label} 영향 ({e.sentiment_score})
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 260, marginTop: 16, paddingTop: 16, borderTop: '1px solid #E5E8EC' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10 }}>📈 폴리마켓 확률 변화 및 뉴스 이벤트</div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F5" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#AAA' }} tickMargin={10} minTickGap={20} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#AAA' }} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="prob" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
          <Scatter dataKey="prob">
            {chartData.map((entry, index) => {
              if (entry.events.length === 0) return <Cell key={`cell-${index}`} fill="transparent" />;
              const score = entry.markerScore;
              const color = score >= 0.1 ? '#1A9C4E' : score < -0.1 ? '#E03030' : '#888';
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}