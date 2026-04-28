const BASE = '/api';

async function get(url) {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const getDashboardSummary = () => get('/dashboard/summary');
export const getRegionData       = (region) => get(`/regions/${encodeURIComponent(region)}`);
export const getCandidates       = (region) => get(`/candidates/${encodeURIComponent(region)}`);
export const getMarketHistory    = (region) => get(`/markets/${encodeURIComponent(region)}/history`);
export const getNews             = (region) => get(`/news/${encodeURIComponent(region)}`);
export const getAnalysis         = (region) => get(`/analysis/${encodeURIComponent(region)}`);