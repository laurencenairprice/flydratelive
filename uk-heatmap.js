var ukHeatmapBounds = {
  minLat: 49.85,
  maxLat: 58.75,
  minLon: -6.35,
  maxLon: 1.85
};

function ukProject(lat, lon, width, height) {
  const { minLat, maxLat, minLon, maxLon } = ukHeatmapBounds;
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * height;
  return { x, y };
}

function ukHeatColor(ratio) {
  const value = Math.max(0, Math.min(1, ratio));
  const hue = 190 - value * 190;
  const light = 88 - value * 38;
  return `hsl(${hue} 78% ${light}%)`;
}

function ukHeatGlowColor(ratio) {
  const value = Math.max(0, Math.min(1, ratio));
  const hue = 190 - value * 190;
  return `hsla(${hue}, 85%, 52%, ${0.16 + value * 0.5})`;
}

function ukHeatmapSvg(points, options) {
  const width = 560;
  const height = 720;
  const mapId = options.mapId || "heat";
  const getValue = options.getValue;
  const values = points.map(getValue);
  const maxValue = Math.max(...values, options.maxValue || 0, 0.001);

  const heatLayer = points.map((point) => {
    const value = getValue(point);
    const ratio = value / maxValue;
    const { x, y } = ukProject(point.lat, point.lon, width, height);
    const radius = 14 + ratio * 44;
    return `<g class="uk-heat-node" data-iata="${point.iata}">
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${ukHeatGlowColor(ratio)}" />
    </g>`;
  }).join("");

  const markers = points.map((point) => {
    const value = getValue(point);
    const ratio = value / maxValue;
    const { x, y } = ukProject(point.lat, point.lon, width, height);
    return `<g class="uk-heat-node" data-iata="${point.iata}">
      <circle cx="${x}" cy="${y}" r="${7 + ratio * 9}" fill="${ukHeatColor(ratio)}" stroke="#071016" stroke-width="1.2" />
      <text x="${x}" y="${y - 12 - ratio * 8}" text-anchor="middle" class="uk-heat-label">${point.iata}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" class="uk-heat-svg" role="img" aria-label="${options.title}">
    ${ukMapBasemapSvg(width, height, mapId)}
    <g clip-path="url(#ukLandClip-${mapId})" class="uk-heat-layer">${heatLayer}</g>
    ${markers}
  </svg>`;
}

function ukHeatLegend(maxLabel, tone) {
  return `<div class="uk-heat-legend">
    <span class="mono">Low</span>
    <span class="uk-heat-legend-bar uk-heat-legend-${tone}"></span>
    <span class="mono">${maxLabel}</span>
  </div>`;
}

function ukActivityBars(points, getValue, label) {
  const sorted = points.slice().sort((a, b) => getValue(b) - getValue(a)).slice(0, 8);
  const max = Math.max(...sorted.map(getValue), 0.001);
  const rows = sorted.map((point) => {
    const value = getValue(point);
    const pct = Math.round((value / max) * 100);
    return `<div class="uk-activity-row">
      <span class="mono uk-activity-code">${point.iata}</span>
      <span class="uk-activity-name">${point.name}</span>
      <span class="uk-activity-track"><span class="uk-activity-fill" style="width:${pct}%"></span></span>
      <span class="mono uk-activity-value">${label(value)}</span>
    </div>`;
  }).join("");
  return `<div class="uk-activity-list">${rows}</div>`;
}
