export default function TimelineChart({ region, data }) {
  return (
    <div style={{
      height: 200,
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
      <span style={{ fontSize: 28 }}>📈</span>
      <span>폴리마켓 확률 추이 차트 — 별도 작업 예정</span>
      {region && <span style={{ fontSize: 12 }}>{region}</span>}
    </div>
  );
}