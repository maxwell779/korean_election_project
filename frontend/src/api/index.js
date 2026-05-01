// frontend/src/api/index.js
const BASE = '/api';

async function get(url) {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getDashboardSummary = () => get('/dashboard/summary');
export const getRegionData       = (region) => get(`/regions/${encodeURIComponent(region)}`);
export const getCandidates       = (region) => get(`/candidates/${encodeURIComponent(region)}`);

// 수정: 특정 후보자(candidate)가 있으면 파라미터로 넘김
export const getMarketHistory    = (region, candidate = '') => {
  const query = candidate ? `?candidate=${encodeURIComponent(candidate)}` : '';
  return get(`/markets/${encodeURIComponent(region)}/history${query}`);
};

// 수정: 특정 후보자(candidate)가 있으면 파라미터로 넘김
export const getNews             = (region, candidate = '') => {
  const query = candidate ? `?candidate=${encodeURIComponent(candidate)}` : '';
  return get(`/news/${encodeURIComponent(region)}${query}`);
};

// 수정: 특정 후보자(candidate)가 있으면 파라미터로 넘김
export const getAnalysis         = (region, candidate = '') => {
  const query = candidate ? `?candidate=${encodeURIComponent(candidate)}` : '';
  return get(`/analysis/${encodeURIComponent(region)}${query}`);
};

// 주소 기반 투표 가이드 및 선거구 후보자 조회
export const getAddressGuide = (addr) => {
  return get(`/guide?addr=${encodeURIComponent(addr)}`);
};

// AI 공약 키워드 매칭
export const getPromiseMatch = (addr, sgType, keyword) => {
  return get(`/promise-match?addr=${encodeURIComponent(addr)}&sg_type=${encodeURIComponent(sgType)}&keyword=${encodeURIComponent(keyword)}`);
};

// 후보자 뉴스 감성 분석 (챗봇)
export const getNewsSentimentChat = (candidateName) => {
  // 백엔드가 [이름] 형식을 요구하므로 프론트에서 알아서 감싸서 보냄
  const formattedQuery = `[${candidateName}]`;
  return get(`/chatbot?query=${encodeURIComponent(formattedQuery)}&days=14&importance_threshold=2`);
};