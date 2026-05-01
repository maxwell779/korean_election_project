import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
// ✅ [추가] API 함수 import
import { getDashboardSummary } from '../api/index';

const MAP_W      = 420;
const MAP_H      = 560;
const JEJU_W     = 100;
const JEJU_H     = 58;
const JEJU_NAME  = '제주특별자치도';
const DAEGU_CODE  = '22';
const GUNWI_NAME  = '군위군';

// ✅ [추가] GeoJSON 전체 province명 → 폴리마켓 지역 단축명 매핑
const SD_TO_REGION = {
  '서울특별시':     '서울',
  '부산광역시':     '부산',
  '대구광역시':     '대구',
  '대전광역시':     '대전',
  '경기도':         '경기',
  '충청북도':       '충북',
  '충청남도':       '충남',
  '강원도':         '강원',
  '강원특별자치도': '강원',
  '전라남도':       '전남광주',
};

// ✅ [변경 전] PROVINCE_INFO 하드코딩 — party가 고정값이라 실데이터와 무관했음
// const PROVINCE_INFO = {
//   '서울특별시': { short: '서울', party: '더불어민주당' },
//   ...하드코딩...
// };

// ✅ [변경 후] short만 남기고, party/확률은 API에서 가져옴
const PROVINCE_INFO = {
  '서울특별시':     { short: '서울' },
  '부산광역시':     { short: '부산' },
  '대구광역시':     { short: '대구' },
  '인천광역시':     { short: '인천' },
  '광주광역시':     { short: '광주' },
  '대전광역시':     { short: '대전' },
  '울산광역시':     { short: '울산' },
  '세종특별자치시': { short: '세종' },
  '경기도':         { short: '경기' },
  '강원도':         { short: '강원' },
  '강원특별자치도': { short: '강원' },
  '충청북도':       { short: '충북' },
  '충청남도':       { short: '충남' },
  '전라북도':       { short: '전북' },
  '전라남도':       { short: '전남' },
  '경상북도':       { short: '경북' },
  '경상남도':       { short: '경남' },
  '제주특별자치도': { short: '제주' },
};

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8',
  '국민의힘':     '#E03030',
};
const IDLE_COLOR = '#8A9BB8';

// ✅ [변경 후] summaryMap(API 데이터)에서 party를 가져옴
function getColor(name, isLive, summaryMap) {
  if (!isLive) return IDLE_COLOR;
  const region  = SD_TO_REGION[name];
  const summary = region ? summaryMap[region] : null;
  if (!summary?.top_party) return IDLE_COLOR;
  return PARTY_COLOR[summary.top_party] ?? IDLE_COLOR;
}

export default function KoreanMap({ isLive = false }) {
  const svgRef     = useRef(null);
  const jejuSvgRef = useRef(null);
  const muniCache  = useRef(null);

  const [provinces,      setProvinces]      = useState(null);
  const [municipalities, setMunicipalities] = useState(null);
  const [level,          setLevel]          = useState('province');
  const [selectedProv,   setSelectedProv]   = useState(null);
  const [tooltip,        setTooltip]        = useState(null);

  // ✅ [추가] 대시보드 요약 데이터 상태
  const [summaryMap,  setSummaryMap]  = useState({});  // { '서울': {top_candidate_ko, top_party, probability_pct, ...} }
  const [loadingData, setLoadingData] = useState(false);

  // ✅ [추가] 대시보드 API 호출
  useEffect(() => {
    setLoadingData(true);
    getDashboardSummary()
      .then(data => {
        // region(서울, 부산...) 키로 변환
        const map = {};
        data.forEach(d => { map[d.region] = d; });
        setSummaryMap(map);
      })
      .catch(err => console.error('[KoreanMap] API 오류:', err))
      .finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    fetch('/provinces.geojson')
      .then(r => r.json())
      .then(setProvinces)
      .catch(err => console.error('provinces.geojson:', err));
  }, []);

  useEffect(() => {
    fetch('/municipalities.geojson')
      .then(r => r.json())
      .then(data => {
        data.features.forEach(f => {
          f.properties._pcode = String(f.properties.code).padStart(5, '0').substring(0, 2);
        });
        muniCache.current = data;
        setMunicipalities(data);
      })
      .catch(err => console.error('municipalities.geojson:', err));
  }, []);

  const handleProvinceClick = useCallback((code, name) => {
    if (!muniCache.current) return;
    setSelectedProv({ code: String(code), name });
    setTooltip(null);
    setLevel('municipality');
  }, []);

  // ✅ [변경 후] getColor에 summaryMap 전달
  useEffect(() => {
    if (!provinces || level !== 'province') return;

    const mainFeatures = provinces.features.filter(f => f.properties.name !== JEJU_NAME);
    const jejuFeature  = provinces.features.find(f => f.properties.name === JEJU_NAME);

    const svg  = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const proj = d3.geoMercator()
      .center([127.7, 36.5])
      .scale(4800)
      .translate([MAP_W / 2, MAP_H / 2]);
    const path = d3.geoPath().projection(proj);

    svg.selectAll('path.prov')
      .data(mainFeatures)
      .enter()
      .append('path')
      .attr('class',        'prov')
      .attr('d',            path)
      // ✅ [변경] summaryMap 기반 색상
      .attr('fill',         d => getColor(d.properties.name, isLive, summaryMap))
      .attr('stroke',       'white')
      .attr('stroke-width', 1.2)
      .attr('cursor',       'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 0.72);
        const [mx, my] = d3.pointer(event, svgRef.current);
        // ✅ [변경] 툴팁에 확률 정보 표시
        const region  = SD_TO_REGION[d.properties.name];
        const summary = region ? summaryMap[region] : null;
        const tooltipText = summary
          ? `${d.properties.name}\n${summary.top_candidate_ko} ${summary.probability_pct}%`
          : d.properties.name;
        setTooltip({ x: mx, y: my, text: tooltipText });
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip(t => t ? { ...t, x: mx, y: my } : null);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1);
        setTooltip(null);
      })
      .on('click', (_, d) => handleProvinceClick(d.properties.code, d.properties.name));

    svg.selectAll('text.prov-lbl')
      .data(mainFeatures)
      .enter()
      .append('text')
      .attr('class',            'prov-lbl')
      .attr('transform',        d => { const [cx, cy] = path.centroid(d); return `translate(${cx},${cy})`; })
      .attr('text-anchor',      'middle')
      .attr('dominant-baseline','middle')
      .attr('fill',             'white')
      .attr('font-size',        10)
      .attr('font-weight',      700)
      .attr('font-family',      "'Noto Sans KR', sans-serif")
      .attr('pointer-events',   'none')
      .text(d => PROVINCE_INFO[d.properties.name]?.short ?? '');

    if (municipalities) {
      const gunwi = municipalities.features.find(f => f.properties.name === GUNWI_NAME);
      if (gunwi) {
        const daeguColor = getColor('대구광역시', isLive, summaryMap);
        svg.append('path')
          .datum(gunwi)
          .attr('class',        'gunwi-overlay')
          .attr('d',            path)
          .attr('fill',         daeguColor)
          .attr('stroke',       'white')
          .attr('stroke-width', 1.2)
          .attr('cursor',       'pointer')
          .on('mouseenter', function(event) {
            d3.select(this).attr('opacity', 0.72);
            const [mx, my] = d3.pointer(event, svgRef.current);
            setTooltip({ x: mx, y: my, text: '대구광역시' });
          })
          .on('mousemove', function(event) {
            const [mx, my] = d3.pointer(event, svgRef.current);
            setTooltip(t => t ? { ...t, x: mx, y: my } : null);
          })
          .on('mouseleave', function() {
            d3.select(this).attr('opacity', 1);
            setTooltip(null);
          })
          .on('click', () => handleProvinceClick(DAEGU_CODE, '대구광역시'));
      }
    }

    if (jejuFeature && jejuSvgRef.current) {
      const jSvg  = d3.select(jejuSvgRef.current);
      jSvg.selectAll('*').remove();
      const jProj = d3.geoMercator().fitExtent([[5, 5], [JEJU_W - 5, JEJU_H - 5]], jejuFeature);
      const jPath = d3.geoPath().projection(jProj);
      jSvg.append('path')
        .datum(jejuFeature)
        .attr('d',            jPath)
        .attr('fill',         getColor(JEJU_NAME, isLive, summaryMap))
        .attr('stroke',       'white')
        .attr('stroke-width', 1)
        .attr('cursor',       'pointer')
        .on('mouseenter', function() { d3.select(this).attr('opacity', 0.72); })
        .on('mouseleave', function() { d3.select(this).attr('opacity', 1);   })
        .on('click', () => handleProvinceClick(jejuFeature.properties.code, JEJU_NAME));
      jSvg.append('text')
        .attr('x', JEJU_W / 2).attr('y', JEJU_H / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', 'white').attr('font-size', 9).attr('font-weight', 700)
        .attr('font-family', "'Noto Sans KR', sans-serif")
        .attr('pointer-events', 'none').text('제주');
    }
  }, [provinces, municipalities, level, isLive, summaryMap, handleProvinceClick]);

  useEffect(() => {
    if (!municipalities || level !== 'municipality' || !selectedProv) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const features = municipalities.features.filter(f => {
      if (f.properties.name === GUNWI_NAME) return selectedProv.code === DAEGU_CODE;
      return f.properties._pcode === selectedProv.code;
    });
    if (features.length === 0) return;
    const collection = { type: 'FeatureCollection', features };
    const proj = d3.geoMercator().fitExtent([[24, 24], [MAP_W - 24, MAP_H - 24]], collection);
    const path = d3.geoPath().projection(proj);
    svg.selectAll('path.muni').data(features).enter().append('path')
      .attr('class', 'muni').attr('d', path).attr('fill', '#4E7EC5')
      .attr('stroke', 'white').attr('stroke-width', 0.7)
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('fill', '#2D5EA8');
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, text: d.properties.name });
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip(t => t ? { ...t, x: mx, y: my } : null);
      })
      .on('mouseleave', function() { d3.select(this).attr('fill', '#4E7EC5'); setTooltip(null); });
    svg.selectAll('text.muni-lbl').data(features.filter(f => path.area(f) > 80)).enter().append('text')
      .attr('class', 'muni-lbl')
      .attr('transform', d => { const [cx, cy] = path.centroid(d); return `translate(${cx},${cy})`; })
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', 'white').attr('font-size', 9).attr('font-weight', 600)
      .attr('font-family', "'Noto Sans KR', sans-serif").attr('pointer-events', 'none')
      .text(d => d.properties.name);
  }, [municipalities, level, selectedProv]);

  const muniList = useMemo(() => {
    if (!municipalities || !selectedProv) return [];
    return municipalities.features.filter(f => {
      if (f.properties.name === GUNWI_NAME) return selectedProv.code === DAEGU_CODE;
      return f.properties._pcode === selectedProv.code;
    });
  }, [municipalities, selectedProv]);

  const handleBack = () => { setLevel('province'); setSelectedProv(null); setTooltip(null); };

  return (
    <div className="map-outer">
      <div className="map-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0D1B3E' }}>
            {level === 'province' ? '시도별 현황' : `${selectedProv?.name} 시군구`}
          </div>
          <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
            {level === 'province' ? '지역을 클릭하면 시군구 지도로 이동합니다' : '시군구 단위 · 실시간 개표 연동 예정'}
          </div>
        </div>
        <div className="map-legend">
          {isLive ? (
            <>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#1A5DC8' }} />더불어민주당</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#E03030' }} />국민의힘</div>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#AAA' }}>개표 시작 전</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flexShrink: 0, width: MAP_W }}>
          {level === 'municipality' && (
            <button className="drilldown-back" onClick={handleBack}>← 전국 지도</button>
          )}
          <svg ref={svgRef} width={MAP_W} height={MAP_H} style={{ display: 'block' }} />
          {level === 'province' && (
            <div style={{ position: 'absolute', bottom: 14, right: 14, border: '1.5px solid #CBD0D8', borderRadius: 7, background: 'white', padding: '3px 3px 0', boxShadow: '0 1px 5px rgba(0,0,0,0.10)' }}>
              <svg ref={jejuSvgRef} width={JEJU_W} height={JEJU_H} style={{ display: 'block', cursor: 'pointer' }} />
              <div style={{ textAlign: 'center', fontSize: 8.5, color: '#888', padding: '1px 0 3px', fontFamily: "'Noto Sans KR', sans-serif" }}>제주특별자치도</div>
            </div>
          )}
          {tooltip && (
            <div style={{ position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 10, background: 'rgba(13,27,62,0.88)', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'pre-line', zIndex: 10 }}>
              {tooltip.text}
            </div>
          )}
        </div>

        {/* ✅ [완벽 수정] width: 200과 글자 자르기(ellipsis)를 없애고 flex: 1로 남은 공간 100% 활용 */}
        <div style={{ flex: 1, minWidth: 250, overflowY: 'auto', maxHeight: MAP_H, paddingRight: 12 }}>
          {level === 'province' ? (
            <>
              <div className="map-panel-title" style={{ marginBottom: 12 }}>광역단체장 현황</div>
              <div className="map-panel-sub" style={{ marginBottom: 8 }}>
                {loadingData ? '데이터 로딩 중...' : '클릭 → 시군구 이동'}
              </div>
              {provinces?.features.map((f, i) => {
                const info   = PROVINCE_INFO[f.properties.name];
                const region = SD_TO_REGION[f.properties.name];
                const summary = region ? summaryMap[region] : null;
                const color  = getColor(f.properties.name, isLive, summaryMap);
                return (
                  // ✅ 텍스트 잘림(maxWidth, ellipsis) 속성 완전 제거 및 패딩 확대
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F0F2F5', cursor: 'pointer' }}
                    onClick={() => handleProvinceClick(f.properties.code, f.properties.name)}>
                    
                    <span style={{ color: '#1A1A1A', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {info?.short ?? f.properties.name}
                    </span>
                    
                    {summary ? (
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontWeight: 800, color, fontSize: 13 }}>
                          {summary.top_candidate_ko}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontWeight: 600 }}>
                          확률 {summary.probability_pct}%
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#CCC', fontSize: 12 }}>—</span>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="map-panel-title">{PROVINCE_INFO[selectedProv?.name]?.short ?? selectedProv?.name}</div>
              <div className="map-panel-sub">시군구 {muniList.length}개{selectedProv?.code === DAEGU_CODE && <span style={{ marginLeft: 4, fontSize: 10, color: '#1A5DC8' }}>(군위군 포함)</span>}</div>
              {muniList.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 0', borderBottom: '1px solid #F5F5F5', fontSize: 13, color: '#444' }}>
                  {f.properties.name}
                  {f.properties.name === GUNWI_NAME && <span style={{ fontSize: 10, color: '#1A5DC8', background: '#EBF0FA', padding: '2px 6px', borderRadius: 4 }}>편입</span>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
