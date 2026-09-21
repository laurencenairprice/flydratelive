var ukAirportRegistry = [
  { iata: "ABZ", icao: "EGPD", name: "Aberdeen", lat: 57.201, lon: -2.198 },
  { iata: "BHD", icao: "EGAC", name: "Belfast City", lat: 54.618, lon: -5.872 },
  { iata: "BFS", icao: "EGAA", name: "Belfast International", lat: 54.657, lon: -6.216 },
  { iata: "BHX", icao: "EGBB", name: "Birmingham", lat: 52.454, lon: -1.748 },
  { iata: "BOH", icao: "EGHH", name: "Bournemouth", lat: 50.78, lon: -1.843 },
  { iata: "BRS", icao: "EGGD", name: "Bristol", lat: 51.383, lon: -2.719 },
  { iata: "CWL", icao: "EGFF", name: "Cardiff", lat: 51.397, lon: -3.343 },
  { iata: "EMA", icao: "EGNX", name: "East Midlands", lat: 52.831, lon: -1.328 },
  { iata: "EDI", icao: "EGPH", name: "Edinburgh", lat: 55.95, lon: -3.372 },
  { iata: "LGW", icao: "EGKK", name: "Gatwick", lat: 51.153, lon: -0.182 },
  { iata: "GLA", icao: "EGPF", name: "Glasgow", lat: 55.872, lon: -4.433 },
  { iata: "LHR", icao: "EGLL", name: "Heathrow", lat: 51.47, lon: -0.454 },
  { iata: "LBA", icao: "EGNM", name: "Leeds Bradford", lat: 53.866, lon: -1.661 },
  { iata: "LPL", icao: "EGGP", name: "Liverpool", lat: 53.334, lon: -2.85 },
  { iata: "LCY", icao: "EGLC", name: "London City", lat: 51.505, lon: 0.055 },
  { iata: "LTN", icao: "EGGW", name: "Luton", lat: 51.875, lon: -0.368 },
  { iata: "MAN", icao: "EGCC", name: "Manchester", lat: 53.354, lon: -2.273 },
  { iata: "NCL", icao: "EGNT", name: "Newcastle", lat: 55.037, lon: -1.691 },
  { iata: "PIK", icao: "EGPK", name: "Prestwick", lat: 55.509, lon: -4.587 },
  { iata: "SOU", icao: "EGHI", name: "Southampton", lat: 50.95, lon: -1.357 },
  { iata: "STN", icao: "EGSS", name: "Stansted", lat: 51.886, lon: 0.235 }
];

function ukAirportByIata(code) {
  const iata = String(code || "").toUpperCase();
  return ukAirportRegistry.find((airport) => airport.iata === iata) || null;
}

function ukAirportSlug(airport) {
  return String(airport.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ukSocialQuery(airport) {
  return `${airport.name} airport delay OR cancelled`;
}

function ukSocialLinks(airport) {
  const query = ukSocialQuery(airport);
  const encoded = encodeURIComponent(query);
  const slug = ukAirportSlug(airport);
  const iata = String(airport.iata || "").toLowerCase();
  const delayName = encodeURIComponent(`delay ${airport.name}`);
  const delayAirport = encodeURIComponent(`delay ${airport.name} airport`);
  const iataDelay = encodeURIComponent(`${airport.iata} delay`);

  return {
    x: `https://x.com/search?q=${encoded}&f=live`,
    xDelay: `https://x.com/search?q=${delayName}&f=live`,
    xDelayAirport: `https://x.com/search?q=${delayAirport}&f=live`,
    xIata: `https://x.com/search?q=${iataDelay}&f=live`,
    xHashtag: `https://x.com/hashtag/${encodeURIComponent(`${slug}delay`)}`,
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${airport.name} airport delay`)}`,
    instagramDelay: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`delay ${airport.name}`)}`,
    instagramTag: `https://www.instagram.com/explore/tags/${slug}delay/`,
    instagramTagDelay: `https://www.instagram.com/explore/tags/delay${slug}/`,
    instagramIata: `https://www.instagram.com/explore/tags/${iata}delay/`,
    threads: `https://www.threads.net/search?q=${encoded}`,
    tiktok: `https://www.tiktok.com/search?q=${encoded}`
  };
}

function ukSocialQuickLinks(airport) {
  const links = ukSocialLinks(airport);
  const slug = ukAirportSlug(airport);
  return [
    { network: "x", label: `delay ${airport.name}`, url: links.xDelay },
    { network: "x", label: `${airport.iata} delay`, url: links.xIata },
    { network: "x", label: `#${slug}delay`, url: links.xHashtag },
    { network: "instagram", label: `delay ${airport.name}`, url: links.instagramDelay },
    { network: "instagram", label: `#${slug}delay`, url: links.instagramTag },
    { network: "instagram", label: `#delay${slug}`, url: links.instagramTagDelay }
  ];
}

function ukOutreachDraft(airport) {
  return `Stuck at ${airport.name} (${airport.iata})? Sorry about the delay — if you're still at the airport, we'd love to send you a Flydrate to help you stay hydrated while you wait. DM us if you're interested.`;
}
