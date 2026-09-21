var ukAirportRegistry = [
  { iata: "ABZ", icao: "EGPD", name: "Aberdeen" },
  { iata: "BHD", icao: "EGAC", name: "Belfast City" },
  { iata: "BFS", icao: "EGAA", name: "Belfast International" },
  { iata: "BHX", icao: "EGBB", name: "Birmingham" },
  { iata: "BOH", icao: "EGHH", name: "Bournemouth" },
  { iata: "BRS", icao: "EGGD", name: "Bristol" },
  { iata: "CWL", icao: "EGFF", name: "Cardiff" },
  { iata: "EMA", icao: "EGNX", name: "East Midlands" },
  { iata: "EDI", icao: "EGPH", name: "Edinburgh" },
  { iata: "LGW", icao: "EGKK", name: "Gatwick" },
  { iata: "GLA", icao: "EGPF", name: "Glasgow" },
  { iata: "LHR", icao: "EGLL", name: "Heathrow" },
  { iata: "LBA", icao: "EGNM", name: "Leeds Bradford" },
  { iata: "LPL", icao: "EGGP", name: "Liverpool" },
  { iata: "LCY", icao: "EGLC", name: "London City" },
  { iata: "LTN", icao: "EGGW", name: "Luton" },
  { iata: "MAN", icao: "EGCC", name: "Manchester" },
  { iata: "NCL", icao: "EGNT", name: "Newcastle" },
  { iata: "PIK", icao: "EGPK", name: "Prestwick" },
  { iata: "SOU", icao: "EGHI", name: "Southampton" },
  { iata: "STN", icao: "EGSS", name: "Stansted" }
];

function ukAirportByIata(code) {
  const iata = String(code || "").toUpperCase();
  return ukAirportRegistry.find((airport) => airport.iata === iata) || null;
}

function ukSocialQuery(airport) {
  return `${airport.name} airport delay OR cancelled`;
}

function ukSocialLinks(airport) {
  const query = ukSocialQuery(airport);
  const encoded = encodeURIComponent(query);
  const tag = encodeURIComponent(`${airport.name.replace(/\s+/g, "")}airport`);
  return {
    x: `https://x.com/search?q=${encoded}&f=live`,
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(airport.name + " airport delay")}`,
    threads: `https://www.threads.net/search?q=${encoded}`,
    tiktok: `https://www.tiktok.com/search?q=${encoded}`
  };
}

function ukOutreachDraft(airport) {
  return `Stuck at ${airport.name} (${airport.iata})? Sorry about the delay — if you're still at the airport, we'd love to send you a Flydrate to help you stay hydrated while you wait. DM us if you're interested.`;
}
