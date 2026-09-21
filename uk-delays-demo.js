function ukDemoDelaysPayload() {
  const elevated = {
    LHR: { score: 78, delayPosts: 9, complaintPosts: 6, newsMentions: 11, ig: 2 },
    LGW: { score: 62, delayPosts: 6, complaintPosts: 4, newsMentions: 7, ig: 1 },
    MAN: { score: 54, delayPosts: 5, complaintPosts: 3, newsMentions: 5, ig: 0 },
    STN: { score: 48, delayPosts: 4, complaintPosts: 3, newsMentions: 4, ig: 1 },
    BHX: { score: 36, delayPosts: 3, complaintPosts: 2, newsMentions: 3, ig: 0 },
    LTN: { score: 31, delayPosts: 2, complaintPosts: 1, newsMentions: 2, ig: 0 },
    EDI: { score: 18, delayPosts: 1, complaintPosts: 0, newsMentions: 1, ig: 0 },
    LCY: { score: 14, delayPosts: 1, complaintPosts: 0, newsMentions: 0, ig: 0 }
  };

  const airports = ukAirportRegistry.map((meta) => {
    const row = elevated[meta.iata] || {
      score: 6,
      delayPosts: 0,
      complaintPosts: 0,
      newsMentions: 0,
      ig: 0
    };
    return {
      iata: meta.iata,
      icao: meta.icao,
      name: meta.name,
      score: row.score,
      activityScore: row.score,
      delayPosts: row.delayPosts,
      complaintPosts: row.complaintPosts,
      newsMentions: row.newsMentions,
      instagramLinks: row.ig
        ? [{ url: `https://www.instagram.com/explore/tags/${meta.iata.toLowerCase()}delay/`, label: "Demo IG tag" }]
        : [],
      cancelledTotal: 0,
      departures: { medianDelay: null, cancelled: 0 },
      arrivals: { medianDelay: null, cancelled: 0 }
    };
  }).sort((a, b) => b.score - a.score || b.delayPosts - a.delayPosts);

  return {
    updatedAt: new Date().toISOString(),
    airports,
    source: "demo",
    demo: true
  };
}

function ukDemoSocialPayload() {
  const delays = ukDemoDelaysPayload();
  return {
    updatedAt: delays.updatedAt,
    note: "Demo data — simulates rising public chatter before headlines.",
    airports: delays.airports.map((airport) => ({
      iata: airport.iata,
      name: airport.name,
      activityScore: airport.score,
      postCount: airport.delayPosts,
      complaintPosts: airport.complaintPosts,
      newsCount: airport.newsMentions
    })),
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
    mode: "free-chatter-only",
    alerts: [
      {
        id: "systemic_chatter",
        type: "systemic_chatter",
        severity: "high",
        title: "Chatter rising at multiple UK airports",
        summary: "6 airports show elevated public chatter in the demo sample.",
        detectedAt: now
      },
      {
        id: "high_chatter_LHR",
        type: "high_chatter",
        severity: "critical",
        iata: "LHR",
        title: "Heathrow (LHR) — high public chatter",
        summary: "Chatter score 78/100 · 9 posts · 11 news hits · 2 IG links found.",
        detectedAt: now
      },
      {
        id: "chatter_spike_LGW",
        type: "chatter_spike",
        severity: "high",
        iata: "LGW",
        title: "Gatwick (LGW) — chatter spiking",
        summary: "Score up 24 points in the last check (demo).",
        detectedAt: now
      },
      {
        id: "early_chatter_STN",
        type: "complaint_burst",
        severity: "medium",
        iata: "STN",
        title: "Stansted (STN) — more delay/cancel mentions",
        summary: "3 new complaint-style posts in the public sample (demo).",
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
    posts: [
      {
        network: "mastodon",
        author: "Demo traveller",
        handle: "@demo",
        text: "Stuck at Heathrow for 3 hours — anyone know if BA139 is ever leaving?",
        postUrl: "https://mastodon.social/@demo/123",
        createdAt: new Date().toISOString()
      }
    ]
  }
};

function ukDemoDetail(iata, kind) {
  const row = ukDemoDetails[iata] || { flights: [], posts: [] };
  if (kind === "flights") return { flights: row.flights };
  return { posts: row.posts };
}
