// Simplified UK outline (Natural Earth / world.geo.json GBR), lat/lon rings.
var ukMapRings = [
  [
    [-5.661949, 54.554603], [-6.197885, 53.867565], [-6.95373, 54.073702], [-7.572168, 54.059956],
    [-7.366031, 54.595841], [-7.572168, 55.131622], [-6.733847, 55.17286], [-5.661949, 54.554603]
  ],
  [
    [-3.005005, 58.635], [-4.073828, 57.553025], [-3.055002, 57.690019], [-1.959281, 57.6848],
    [-2.219988, 56.870017], [-3.119003, 55.973793], [-2.085009, 55.909998], [-2.005676, 55.804903],
    [-1.114991, 54.624986], [-0.430485, 54.464376], [0.184981, 53.325014], [0.469977, 52.929999],
    [1.681531, 52.73952], [1.559988, 52.099998], [1.050562, 51.806761], [1.449865, 51.289428],
    [0.550334, 50.765739], [-0.787517, 50.774989], [-2.489998, 50.500019], [-2.956274, 50.69688],
    [-3.617448, 50.228356], [-4.542508, 50.341837], [-5.245023, 49.96], [-5.776567, 50.159678],
    [-4.30999, 51.210001], [-3.414851, 51.426009], [-3.422719, 51.426848], [-4.984367, 51.593466],
    [-5.267296, 51.9914], [-4.222347, 52.301356], [-4.770013, 52.840005], [-4.579999, 53.495004],
    [-3.093831, 53.404547], [-3.09208, 53.404441], [-2.945009, 53.985], [-3.614701, 54.600937],
    [-3.630005, 54.615013], [-4.844169, 54.790971], [-5.082527, 55.061601], [-4.719112, 55.508473],
    [-5.047981, 55.783986], [-5.586398, 55.311146], [-5.644999, 56.275015], [-6.149981, 56.78501],
    [-5.786825, 57.818848], [-5.009999, 58.630013], [-4.211495, 58.550845], [-3.005005, 58.635]
  ]
];

function ukMapPath(width, height) {
  return ukMapRings.map((ring) => {
    const segments = ring.map(([lon, lat], index) => {
      const { x, y } = ukProject(lat, lon, width, height);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    return `${segments.join(" ")} Z`;
  }).join(" ");
}

function ukMapBasemapSvg(width, height, mapId) {
  const landPath = ukMapPath(width, height);
  return `
    <defs>
      <linearGradient id="ukSea-${mapId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d7ecef"/>
        <stop offset="100%" stop-color="#b9d6de"/>
      </linearGradient>
      <linearGradient id="ukLand-${mapId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eef3e8"/>
        <stop offset="45%" stop-color="#e3ebdc"/>
        <stop offset="100%" stop-color="#d2dcc8"/>
      </linearGradient>
      <clipPath id="ukLandClip-${mapId}">
        <path d="${landPath}" />
      </clipPath>
    </defs>
    <rect width="100%" height="100%" fill="url(#ukSea-${mapId})" />
    <path d="${landPath}" fill="url(#ukLand-${mapId})" stroke="#8fa59c" stroke-width="1.6" stroke-linejoin="round" />
    <path d="${landPath}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.55" transform="translate(0,-0.6)" />
  `;
}
