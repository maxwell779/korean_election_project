import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';

const MAP_W      = 420;
const MAP_H      = 560;
const JEJU_W     = 100;
const JEJU_H     = 58;
const JEJU_NAME  = '제주특별자치도';

// 2023년 군위군 → 대구광역시 통합 보정
const DAEGU_CODE  = '22';   // provinces.geojson 대구 code
const GUNWI_NAME  = '군위군'; // municipalities.geojson name (code: 37310, _pcode: '37')

// GeoJSON uses 2013-vintage names (강원도, 전라북도 등)
const PROVINCE_INFO = {
  '서울특별시':     { short: '서울', party: '더불어민주당' },
  '부산광역시':     { short: '부산', party: '국민의힘' },
  '대구광역시':     { short: '대구', party: '국민의힘' },
  '인천광역시':     { short: '인천', party: '더불어민주당' },
  '광주광역시':     { short: '광주', party: '더불어민주당' },
  '대전광역시':     { short: '대전', party: '더불어민주당' },
  '울산광역시':     { short: '울산', party: '국민의힘' },
  '세종특별자치시': { short: '세종', party: '더불어민주당' },
  '경기도':         { short: '경기', party: '더불어민주당' },
  '강원도':         { short: '강원', party: '국민의힘' },
  '충청북도':       { short: '충북', party: '더불어민주당' },
  '충청남도':       { short: '충남', party: '더불어민주당' },
  '전라북도':       { short: '전북', party: '더불어민주당' },
  '전라남도':       { short: '전남', party: '더불어민주당' },
  '경상북도':       { short: '경북', party: '국민의힘' },
  '경상남도':       { short: '경남', party: '국민의힘' },
  '제주특별자치도': { short: '제주', party: '더불어민주당' },
};

const PARTY_COLOR = {
  '더불어민주당': '#1A5DC8',
  '국민의힘':     '#E03030',
};
const IDLE_COLOR = '#8A9BB8';

function getColor(name, isLive) {
  if (!isLive) return IDLE_COLOR;
  const info = PROVINCE_INFO[name];
  return info ? (PARTY_COLOR[info.party] ?? IDLE_COLOR) : IDLE_COLOR;
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

  // Fetch both GeoJSONs on mount (municipalities eager-loaded for 군위군 overlay)
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
    if (!muniCache.current) return; // still loading
    setSelectedProv({ code: String(code), name });
    setTooltip(null);
    setLevel('municipality');
  }, []);

  // ── Province-level render ────────────────────────────────────────────────
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

    // All provinces except Jeju
    svg.selectAll('path.prov')
      .data(mainFeatures)
      .enter()
      .append('path')
      .attr('class',        'prov')
      .attr('d',            path)
      .attr('fill',         d => getColor(d.properties.name, isLive))
      .attr('stroke',       'white')
      .attr('stroke-width', 1.2)
      .attr('cursor',       'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 0.72);
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, text: d.properties.name });
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

    // 군위군 overlay: 2023년 대구 편입 보정
    // municipalities.geojson은 군위군을 경북(37)으로 가지고 있으므로
    // 대구 색으로 덮어 그려서 시각 보정
    if (municipalities) {
      const gunwi = municipalities.features.find(f => f.properties.name === GUNWI_NAME);
      if (gunwi) {
        const daeguColor = getColor('대구광역시', isLive);
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

    // Jeju inset SVG
    if (jejuFeature && jejuSvgRef.current) {
      const jSvg  = d3.select(jejuSvgRef.current);
      jSvg.selectAll('*').remove();

      const jProj = d3.geoMercator()
        .fitExtent([[5, 5], [JEJU_W - 5, JEJU_H - 5]], jejuFeature);
      const jPath = d3.geoPath().projection(jProj);

      jSvg.append('path')
        .datum(jejuFeature)
        .attr('d',            jPath)
        .attr('fill',         getColor(JEJU_NAME, isLive))
        .attr('stroke',       'white')
        .attr('stroke-width', 1)
        .attr('cursor',       'pointer')
        .on('mouseenter', function() { d3.select(this).attr('opacity', 0.72); })
        .on('mouseleave', function() { d3.select(this).attr('opacity', 1);   })
        .on('click', () => handleProvinceClick(jejuFeature.properties.code, JEJU_NAME));

      jSvg.append('text')
        .attr('x',                JEJU_W / 2)
        .attr('y',                JEJU_H / 2)
        .attr('text-anchor',      'middle')
        .attr('dominant-baseline','middle')
        .attr('fill',             'white')
        .attr('font-size',        9)
        .attr('font-weight',      700)
        .attr('font-family',      "'Noto Sans KR', sans-serif")
        .attr('pointer-events',   'none')
        .text('제주');
    }
  }, [provinces, municipalities, level, isLive, handleProvinceClick]);

  // ── Municipality-level render ────────────────────────────────────────────
  useEffect(() => {
    if (!municipalities || level !== 'municipality' || !selectedProv) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 군위군: 경북 드릴다운에서 제외, 대구 드릴다운에 포함
    const features = municipalities.features.filter(f => {
      if (f.properties.name === GUNWI_NAME) return selectedProv.code === DAEGU_CODE;
      return f.properties._pcode === selectedProv.code;
    });
    if (features.length === 0) return;

    const collection = { type: 'FeatureCollection', features };
    const proj = d3.geoMercator()
      .fitExtent([[24, 24], [MAP_W - 24, MAP_H - 24]], collection);
    const path = d3.geoPath().projection(proj);

    svg.selectAll('path.muni')
      .data(features)
      .enter()
      .append('path')
      .attr('class',        'muni')
      .attr('d',            path)
      .attr('fill',         '#4E7EC5')
      .attr('stroke',       'white')
      .attr('stroke-width', 0.7)
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('fill', '#2D5EA8');
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip({ x: mx, y: my, text: d.properties.name });
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltip(t => t ? { ...t, x: mx, y: my } : null);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', '#4E7EC5');
        setTooltip(null);
      });

    svg.selectAll('text.muni-lbl')
      .data(features.filter(f => path.area(f) > 80))
      .enter()
      .append('text')
      .attr('class',            'muni-lbl')
      .attr('transform',        d => { const [cx, cy] = path.centroid(d); return `translate(${cx},${cy})`; })
      .attr('text-anchor',      'middle')
      .attr('dominant-baseline','middle')
      .attr('fill',             'white')
      .attr('font-size',        9)
      .attr('font-weight',      600)
      .attr('font-family',      "'Noto Sans KR', sans-serif")
      .attr('pointer-events',   'none')
      .text(d => d.properties.name);
  }, [municipalities, level, selectedProv]);

  // 군위군 포함 여부를 반영한 목록 (우측 패널)
  const muniList = useMemo(() => {
    if (!municipalities || !selectedProv) return [];
    return municipalities.features.filter(f => {
      if (f.properties.name === GUNWI_NAME) return selectedProv.code === DAEGU_CODE;
      return f.properties._pcode === selectedProv.code;
    });
  }, [municipalities, selectedProv]);

  const handleBack = () => {
    setLevel('province');
    setSelectedProv(null);
    setTooltip(null);
  };

  return (
    <div className="map-outer">
      {/* ── Header ── */}
      <div className="map-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0D1B3E' }}>
            {level === 'province' ? '시도별 현황' : `${selectedProv?.name} 시군구`}
          </div>
          <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
            {level === 'province'
              ? '지역을 클릭하면 시군구 지도로 이동합니다'
              : '시군구 단위 · 실시간 개표 연동 예정'}
          </div>
        </div>
        <div className="map-legend">
          {isLive ? (
            <>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#1A5DC8' }} />더불어민주당
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#E03030' }} />국민의힘
              </div>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#AAA' }}>개표 시작 전</span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Map SVG — fixed width */}
        <div style={{ position: 'relative', flexShrink: 0, width: MAP_W }}>
          {level === 'municipality' && (
            <button className="drilldown-back" onClick={handleBack}>
              ← 전국 지도
            </button>
          )}

          <svg
            ref={svgRef}
            width={MAP_W}
            height={MAP_H}
            style={{ display: 'block' }}
          />

          {/* Jeju inset — bottom-right, province level only */}
          {level === 'province' && (
            <div style={{
              position:     'absolute',
              bottom:       14,
              right:        14,
              border:       '1.5px solid #CBD0D8',
              borderRadius: 7,
              background:   'white',
              padding:      '3px 3px 0',
              boxShadow:    '0 1px 5px rgba(0,0,0,0.10)',
            }}>
              <svg
                ref={jejuSvgRef}
                width={JEJU_W}
                height={JEJU_H}
                style={{ display: 'block', cursor: 'pointer' }}
              />
              <div style={{
                textAlign:  'center',
                fontSize:   8.5,
                color:      '#888',
                padding:    '1px 0 3px',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}>
                제주특별자치도
              </div>
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position:      'absolute',
              left:          tooltip.x + 14,
              top:           tooltip.y - 10,
              background:    'rgba(13,27,62,0.88)',
              color:         'white',
              padding:       '4px 10px',
              borderRadius:  6,
              fontSize:      12,
              fontWeight:    600,
              pointerEvents: 'none',
              whiteSpace:    'nowrap',
              zIndex:        10,
            }}>
              {tooltip.text}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: 148, flexShrink: 0, overflowY: 'auto', maxHeight: MAP_H }}>
          {level === 'province' ? (
            <>
              <div className="map-panel-title">광역단체장 현황</div>
              <div className="map-panel-sub">클릭 → 시군구 이동</div>
              {provinces?.features.map((f, i) => {
                const info  = PROVINCE_INFO[f.properties.name];
                const color = getColor(f.properties.name, isLive);
                return (
                  <div
                    key={i}
                    style={{
                      display:        'flex',
                      justifyContent: 'space-between',
                      alignItems:     'center',
                      padding:        '5px 0',
                      borderBottom:   '1px solid #F0F2F5',
                      fontSize:       12,
                      cursor:         'pointer',
                    }}
                    onClick={() => handleProvinceClick(f.properties.code, f.properties.name)}
                  >
                    <span style={{ color: '#333' }}>{info?.short ?? f.properties.name}</span>
                    {isLive && info ? (
                      <span style={{ fontWeight: 700, color, fontSize: 11 }}>
                        {info.party === '더불어민주당' ? '민주' : '국힘'}
                      </span>
                    ) : (
                      <span style={{ color: '#CCC', fontSize: 11 }}>—</span>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="map-panel-title">
                {PROVINCE_INFO[selectedProv?.name]?.short ?? selectedProv?.name}
              </div>
              <div className="map-panel-sub">
                시군구 {muniList.length}개
                {selectedProv?.code === DAEGU_CODE && (
                  <span style={{ marginLeft: 4, fontSize: 10, color: '#1A5DC8' }}>
                    (군위군 포함)
                  </span>
                )}
              </div>
              {muniList.map((f, i) => (
                <div key={i} style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            5,
                  padding:        '4px 0',
                  borderBottom:   '1px solid #F5F5F5',
                  fontSize:       12,
                  color:          '#444',
                }}>
                  {f.properties.name}
                  {f.properties.name === GUNWI_NAME && (
                    <span style={{ fontSize: 9, color: '#1A5DC8', background: '#EBF0FA', padding: '1px 4px', borderRadius: 3 }}>
                      편입
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}