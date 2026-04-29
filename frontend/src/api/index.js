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