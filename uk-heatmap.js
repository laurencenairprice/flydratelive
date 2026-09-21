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
  return `hsla(${hue}, 85%, 52%, ${0.12 + value * 0.45})`;
}

function ukHeatmapSvg(points, options) {
  const width = 560;
  const height = 720;
  const getValue = options.getValue;
  const values = points.map(getValue);
  const maxValue = Math.max(...values, options.maxValue || 0, 0.001);

  const blobs = points.map((point) => {
    const value = getValue(point);
    const ratio = value / maxValue;
    const { x, y } = ukProject(point.lat, point.lon, width, height);
    const radius = 16 + ratio * 46;
    return `<g class="uk-heat-node" data-iata="${point.iata}">
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${ukHeatGlowColor(ratio)}" />
      <circle cx="${x}" cy="${y}" r="${8 + ratio * 10}" fill="${ukHeatColor(ratio)}" stroke="#071016" stroke-width="1.2" />
      <text x="${x}" y="${y - 14 - ratio * 8}" text-anchor="middle" class="uk-heat-label">${point.iata}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" class="uk-heat-svg" role="img" aria-label="${options.title}">
    <defs>
      <linearGradient id="ukHeatBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#eef8fa"/>
        <stop offset="100%" stop-color="#f4f2ec"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#ukHeatBg)" />
    <path d="M48 640 C120 610 170 670 250 650 C330 630 380 690 460 660 C500 645 520 610 540 580 L540 720 L48 720 Z" fill="#dbe7ea" opacity="0.55"/>
    <path d="M70 120 C140 80 220 60 320 70 C420 80 500 120 520 200 C535 260 520 340 480 420 C440 500 360 560 280 590 C200 620 120 600 80 520 C50 450 40 360 50 280 C55 220 60 170 70 120 Z" fill="#ffffff" stroke="#c8d6da" stroke-width="2"/>
    ${blobs}
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
