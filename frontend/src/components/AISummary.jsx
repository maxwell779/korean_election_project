import { useState } from 'react';
import { AI_SUGGESTIONS, AI_QA } from '../data/mock';

export default function AISummary() {
  const [query, setQuery]     = useState('');
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(q) {
    const question = q || query;
    if (!question.trim() || loading) return;
    setLoading(true);
    setQuery('');

    await new Promise(r => setTimeout(r, 900));

    const known = AI_QA[question];
    let text;
    if (known) {
      text = known;
    } else {
      try {
        const res = await fetch(`/api/chatbot?query=${encodeURIComponent('[' + question + ']')}`);
        const data = await res.json();
        text = data.message + '\n' + data.events.map(e => e.one_line).join('\n');
      } catch {
        text = '현재 AI 서비스에 일시적 오류가 있습니다. 잠시 후 다시 시도해주세요.';
      }
    }

    setAnswers(prev => [{ q: question, a: text }, ...prev]);
    setLoading(false);
  }

  return (
    <div className="ai-wrap">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="ai-logo-icon">🗳️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0D1B3E', marginTop: 8 }}>선거 AI 검색</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>2026 지방선거에 대해 무엇이든 물어보세요</div>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          className="ai-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="선거 관련 질문을 입력하세요..."
        />
        <button className="ai-send-btn" onClick={() => handleSearch()}>→</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {AI_SUGGESTIONS.map(s => (
          <button key={s} className="ai-chip" onClick={() => handleSearch(s)}>{s}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#AAA', fontSize: 13, margin: '16px 0' }}>
          <div className="ai-dots"><span /><span /><span /></div>
          <span>분석 중...</span>
        </div>
      )}

      {answers.map((a, i) => (
        <div className="ai-answer-card" key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="ai-q-tag">Q</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3E' }}>{a.q}</span>
          </div>
          <div
            style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: a.a }}
          />
        </div>
      ))}
    </div>
  );
}