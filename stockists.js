var flydrateStockists = {
  ABZ: {
    name: "Aberdeen",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [
      { key: "", label: "Airport", units: ["Airside", "Arrivals", "Landside Costa"] }
    ]
  },
  BHD: {
    name: "Belfast City",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  BFS: {
    name: "Belfast International",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [{ key: "", label: "Airport", units: ["Airside Main"] }]
  },
  BHX: {
    name: "Birmingham",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [
      { key: "1", label: "Terminal 1", units: ["T1 Airside", "T1 First Hit Kiosk"] },
      { key: "2", label: "Terminal 2", units: ["T2 Airside"] }
    ]
  },
  BOH: {
    name: "Bournemouth",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  BRS: {
    name: "Bristol",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [{ key: "", label: "Airport", units: ["Airside", "Landside Main"] }]
  },
  CWL: {
    name: "Cardiff",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  EMA: {
    name: "East Midlands",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside 2", "Arrivals"] }]
  },
  EDI: {
    name: "Edinburgh",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [{ key: "", label: "Airport", units: ["Airside 1", "Airside 2", "Airside Pier"] }]
  },
  LGW: {
    name: "Gatwick",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [
      {
        key: "n",
        label: "North Terminal",
        units: ["Airside CTN", "Airside 1 Winning Post", "Arrivals", "Landside Interchange", "Pier 6"]
      },
      {
        key: "s",
        label: "South Terminal",
        units: ["Airside 2 Balcony", "Airside IDL", "Arrivals", "First Hit IDL"]
      }
    ]
  },
  GLA: {
    name: "Glasgow",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [
      {
        key: "",
        label: "Airport",
        units: ["Airside Main", "Airside Shuttle", "Domestic Arrivals", "International Pier"]
      }
    ]
  },
  LHR: {
    name: "Heathrow",
    security: "yes",
    securityNote: "YES – up to 2L",
    terminals: [
      { key: "2", label: "Terminal 2", units: ["Airside IDL", "Airside Pier"] },
      {
        key: "3",
        label: "Terminal 3",
        units: ["Airside 2 Transfers", "Airside IDL OSS", "Bus Station", "Landside Arrivals"]
      },
      {
        key: "4",
        label: "Terminal 4",
        units: ["Airside NEC OSS", "Airside SW Central", "Arrivals", "Landside Main"]
      },
      {
        key: "5",
        label: "Terminal 5",
        units: [
          "Airside Gate Level",
          "Airside IDL OSS",
          "Airside Luxury",
          "Airside Satellite B",
          "Arrivals",
          "Heathrow T5c",
          "Landside Departures (CTN)",
          "Landside Premium"
        ]
      }
    ]
  },
  LBA: {
    name: "Leeds Bradford",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside 2"] }]
  },
  LPL: {
    name: "Liverpool",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["L2 Airside", "Airside L3", "Arrivals"] }]
  },
  LCY: {
    name: "London City",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Blended Essentials", "Landside"] }]
  },
  LTN: {
    name: "Luton",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside 1", "Airside CTN", "Landside CTN"] }]
  },
  MAN: {
    name: "Manchester",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [
      { key: "1", label: "Terminal 1", units: ["T1 IDL"] },
      {
        key: "2",
        label: "Terminal 2",
        units: ["Arrivals", "Check In", "First Hit East", "First Hit West", "Main IDL"]
      },
      { key: "3", label: "Terminal 3", units: ["T3 Airside", "T3 Temp Unit"] }
    ]
  },
  NCL: {
    name: "Newcastle",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  PIK: {
    name: "Prestwick",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  SOU: {
    name: "Southampton",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [{ key: "", label: "Airport", units: ["Airside"] }]
  },
  STN: {
    name: "Stansted",
    security: "no",
    securityNote: "NO – 100ml limit",
    terminals: [
      {
        key: "",
        label: "Airport",
        units: ["Airside 2", "Airside IDL", "Arrivals", "First Hit", "Satellite 1", "Satellite 2", "Satellite 3"]
      }
    ]
  }
};

function stockIata(code) {
  const raw = String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
  return raw.length === 3 ? raw : "";
}

function stockTerminalKey(iata, raw) {
  const airport = flydrateStockists[stockIata(iata)];
  if (!airport || !raw) return "";
  const compact = String(raw)
    .toLowerCase()
    .replace(/terminal|term\.?|intl|international/g, " ")
    .replace(/[^a-z0-9]/g, "");
  if (!compact) return "";

  const aliases = {
    n: "n",
    north: "n",
    s: "s",
    south: "s",
    "5c": "5",
    t5c: "5"
  };
  let key = aliases[compact] || compact.replace(/^t/, "");
  if (airport.terminals.some((term) => term.key === key)) return key;
  return "";
}

function stockMatch(iata, terminal) {
  const code = stockIata(iata);
  const airport = flydrateStockists[code];
  if (!airport) return null;
  const key = stockTerminalKey(code, terminal);
  const matched = key ? airport.terminals.filter((term) => term.key === key) : [];
  const terminals = matched.length ? matched : airport.terminals;
  return {
    iata: code,
    name: airport.name,
    security: airport.security,
    securityNote: airport.securityNote,
    terminalKey: key,
    terminals,
    matchedTerminal: Boolean(matched.length)
  };
}

function securityCopy(airport) {
  if (airport.security === "yes") {
    return "Yes — a 250ml can can go through security (up to 2L).";
  }
  if (airport.security === "no") {
    return "No — 100ml liquids rule. Buy Flydrate after security.";
  }
  return airport.securityNote || "Security rules not listed.";
}
