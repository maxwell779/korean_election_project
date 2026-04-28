export default function KoreanMap({ isLive }) {
  return (
    <div className="map-outer">
      <div className="map-header">
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3E', marginBottom: 3 }}>지역별 당선 현황</div>
          <div style={{ fontSize: 11, color: '#AAA' }}>지도 컴포넌트 구현 예정</div>
        </div>
        <div className="map-legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: '#1A5DC8' }} />민주당</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#E03030' }} />국민의힘</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#8090A8' }} />집계 전</div>
        </div>
      </div>
      <div style={{
        height: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FA',
        borderRadius: 8,
        color: '#AAA',
        fontSize: 14,
        flexDirection: 'column',
        gap: 8,
      }}>
        <span style={{ fontSize: 32 }}>🗺️</span>
        <span>한국 지도 — 별도 작업 예정</span>
      </div>
    </div>
  );
}