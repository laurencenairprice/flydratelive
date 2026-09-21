function ukDemoDelaysPayload() {
  const elevated = {
    LHR: { score: 4.2, cancelled: 22, dep: "PT1H35M", arr: "PT1H05M" },
    LGW: { score: 3.7, cancelled: 14, dep: "PT1H10M", arr: "PT45M" },
    MAN: { score: 3.3, cancelled: 11, dep: "PT55M", arr: "PT40M" },
    STN: { score: 2.9, cancelled: 9, dep: "PT50M", arr: "PT35M" },
    BHX: { score: 2.6, cancelled: 7, dep: "PT42M", arr: "PT30M" },
    LTN: { score: 2.4, cancelled: 6, dep: "PT38M", arr: "PT28M" },
    EDI: { score: 2.1, cancelled: 4, dep: "PT25M", arr: "PT20M" },
    LCY: { score: 2.0, cancelled: 3, dep: "PT22M", arr: "PT18M" }
  };

  const airports = ukAirportRegistry.map((meta) => {
    const row = elevated[meta.iata] || {
      score: 0.35,
      cancelled: 0,
      dep: "PT6M",
      arr: "PT8M"
    };
    return {
      iata: meta.iata,
      icao: meta.icao,
      name: meta.name,
      score: row.score,
      cancelledTotal: row.cancelled,
      departures: { medianDelay: row.dep, cancelled: Math.floor(row.cancelled / 2), delayIndex: row.score },
      arrivals: { medianDelay: row.arr, cancelled: Math.ceil(row.cancelled / 2), delayIndex: row.score - 0.2 }
    };
  }).sort((a, b) => b.score - a.score || b.cancelledTotal - a.cancelledTotal);

  return {
    updatedAt: new Date().toISOString(),
    airports,
    demo: true
  };
}

function ukDemoSocialPayload() {
  const scores = {
    LHR: 88,
    LGW: 72,
    MAN: 61,
    STN: 54,
    BHX: 41,
    LTN: 38,
    EDI: 22,
    LCY: 19
  };

  return {
    updatedAt: new Date().toISOString(),
    note: "Demo data — simulates rising public frustration before headlines.",
    airports: ukAirportRegistry.map((meta) => ({
      iata: meta.iata,
      name: meta.name,
      activityScore: scores[meta.iata] || 8,
      postCount: scores[meta.iata] ? 6 : 0,
      complaintPosts: scores[meta.iata] ? 4 : 0,
      newsCount: scores[meta.iata] ? 8 : 0
    })).sort((a, b) => b.activityScore - a.activityScore),
    demo: true
  };
}

function ukDemoAlertsPayload() {
  const now = new Date().toISOString();
  return {
    checkedAt: now,
    channelsConfigured: { email: true, slack: false, webhook: false, kv: true },
    snapshotSaved: false,
    demo: true,
    alerts: [
      {
        id: "systemic_stress",
        type: "systemic_stress",
        severity: "critical",
        title: "Multiple UK airports under stress",
        summary: "6 airports show elevated delay index (≥ 2.0). This may be a network-wide issue developing.",
        detectedAt: now
      },
      {
        id: "high_delay_LHR",
        type: "high_delay",
        severity: "critical",
        iata: "LHR",
        title: "Heathrow (LHR) — high disruption",
        summary: "Delay index 4.2 with 22 cancellations in the current window.",
        detectedAt: now
      },
      {
        id: "worsening_LGW",
        type: "rapid_worsening",
        severity: "high",
        iata: "LGW",
        title: "Gatwick (LGW) — delays worsening fast",
        summary: "Delay index jumped 1.4 since the last check (2.3 → 3.7).",
        detectedAt: now
      },
      {
        id: "early_chatter_STN",
        type: "early_chatter",
        severity: "medium",
        iata: "STN",
        title: "Stansted (STN) — traveller chatter rising early",
        summary: "Public complaint activity up 24 points while delay index is still 2.9. Worth watching before media picks it up.",
        detectedAt: now
      }
    ],
    wouldNotify: []
  };
}

var ukDemoDetails = {
  LHR: {
    flights: [
      { number: "BA139", route: "LHR → BOM", direction: "Departure", status: "Delayed", delay: "PT2H10M" },
      { number: "VS300", route: "LHR → JFK", direction: "Departure", status: "Delayed", delay: "PT1H45M" },
      { number: "LH921", route: "FRA → LHR", direction: "Arrival", status: "Delayed", delay: "PT1H20M" },
      { number: "BA286", route: "LHR → SFO", direction: "Departure", status: "Cancelled", delay: "—" }
    ],
    social: {
      activityScore: 88,
      newsCount: 12,
      posts: [{
        network: "mastodon",
        author: "Terminal tired",
        handle: "@pax_lhr",
        text: "Three hours at Heathrow T5 and still no gate. Absolute chaos at security spillover.",
        createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
        postUrl: "https://mastodon.social/@example/1",
        profileUrl: "https://mastodon.social/@example"
      }],
      note: "Demo sample post — use platform search links for real outreach."
    }
  },
  LGW: {
    flights: [
      { number: "EZY8421", route: "LGW → BCN", direction: "Departure", status: "Delayed", delay: "PT1H05M" },
      { number: "BA2575", route: "LGW → GVA", direction: "Departure", status: "Cancelled", delay: "—" }
    ],
    social: {
      activityScore: 72,
      newsCount: 6,
      posts: [{
        network: "mastodon",
        author: "Gatwick queue",
        handle: "@southbound",
        text: "Gatwick North queueing for hours — flights sliding every 20 minutes.",
        createdAt: new Date(Date.now() - 42 * 60000).toISOString(),
        postUrl: "https://mastodon.social/@example/2",
        profileUrl: "https://mastodon.social/@example"
      }],
      note: "Demo sample post."
    }
  }
};

function ukDemoDetail(iata, action) {
  const airport = ukAirportByIata(iata);
  const bundle = ukDemoDetails[iata] || {
    flights: [
      { number: "XX000", route: `${iata} → —`, direction: "Departure", status: "Delayed", delay: "PT35M" }
    ],
    social: {
      activityScore: 28,
      newsCount: 2,
      posts: [],
      note: "Demo mode — low sample activity for this airport."
    }
  };
  if (action === "social") {
    return { ...bundle.social, links: ukSocialLinks(airport) };
  }
  return { flights: bundle.flights, airport, updatedAt: new Date().toISOString() };
}
