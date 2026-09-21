import {
  deliverAlerts,
  evaluateEarlyWarnings,
  filterCooldown,
  loadAlertState,
  saveAlertState
} from "./alerts.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const UK_AIRPORTS = [
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

const UK_BY_ICAO = Object.fromEntries(UK_AIRPORTS.map((airport) => [airport.icao, airport]));
const UK_BY_IATA = Object.fromEntries(UK_AIRPORTS.map((airport) => [airport.iata, airport]));

function jsonResponse(body, status = 200, cacheSeconds = 0) {
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store"
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function proxyJsonResponse(upstream) {
  return upstream.text().then((body) => new Response(body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  }));
}

async function aerodataboxFetch(path, env) {
  if (!env.RAPIDAPI_KEY) {
    return { error: "Flight lookup is not configured.", status: 500 };
  }
  const upstream = await fetch(`https://aerodatabox.p.rapidapi.com${path}`, {
    headers: {
      "x-rapidapi-host": env.RAPIDAPI_HOST || "aerodatabox.p.rapidapi.com",
      "x-rapidapi-key": env.RAPIDAPI_KEY
    }
  });
  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: upstream.status, data };
}

function delayIndexValue(info) {
  const values = [info?.delayIndex].filter((value) => typeof value === "number");
  return values.length ? values[0] : 0;
}

function summariseBatch(batch) {
  if (!batch) {
    return {
      delayIndex: null,
      medianDelay: null,
      cancelled: 0,
      total: 0
    };
  }
  return {
    delayIndex: batch.delayIndex ?? null,
    medianDelay: batch.medianDelay ?? null,
    cancelled: batch.numCancelled ?? 0,
    total: batch.numTotal ?? 0
  };
}

function combinedDelayScore(departures, arrivals) {
  const dep = delayIndexValue(departures);
  const arr = delayIndexValue(arrivals);
  if (dep && arr) return (dep + arr) / 2;
  return dep || arr || 0;
}

function normaliseDelayRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.airportIcao) return [payload];
  return [];
}

function mapUkDelayRow(row) {
  const airport = UK_BY_ICAO[row.airportIcao];
  if (!airport) return null;
  const departures = summariseBatch(row.departuresDelayInformation);
  const arrivals = summariseBatch(row.arrivalsDelayInformation);
  const score = combinedDelayScore(row.departuresDelayInformation, row.arrivalsDelayInformation);
  return {
    iata: airport.iata,
    icao: airport.icao,
    name: airport.name,
    score,
    window: {
      from: row.from?.utc || row.from?.local || null,
      to: row.to?.utc || row.to?.local || null
    },
    departures,
    arrivals,
    cancelledTotal: departures.cancelled + arrivals.cancelled
  };
}

async function fetchUkDelays(env) {
  if (!env.RAPIDAPI_KEY) {
    return { error: "Flight lookup is not configured.", status: 500 };
  }
  const global = await aerodataboxFetch("/airports/delays", env);
  if (global.status >= 400) {
    return { error: global.data?.message || "Could not load airport delays.", status: global.status };
  }

  const rows = normaliseDelayRows(global.data)
    .map(mapUkDelayRow)
    .filter(Boolean);

  const seen = new Set(rows.map((row) => row.iata));
  const missing = UK_AIRPORTS.filter((airport) => !seen.has(airport.iata));

  for (const airport of missing.slice(0, 8)) {
    const single = await aerodataboxFetch(`/airports/iata/${airport.iata}/delays`, env);
    if (single.status < 400) {
      const mapped = normaliseDelayRows(single.data).map(mapUkDelayRow).filter(Boolean)[0];
      if (mapped) rows.push(mapped);
    }
  }

  rows.sort((a, b) => b.score - a.score || b.cancelledTotal - a.cancelledTotal);
  return { airports: rows, updatedAt: new Date().toISOString() };
}

function flightStatusLabel(flight) {
  const status = String(flight.status || "").toLowerCase();
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("divert")) return "Diverted";
  if (flight.departure?.delay || flight.arrival?.delay) return "Delayed";
  return flight.status || "Unknown";
}

function isDisruptedFlight(flight) {
  const status = String(flight.status || "").toLowerCase();
  if (status.includes("cancel") || status.includes("divert") || status.includes("uncertain")) return true;
  return Boolean(flight.departure?.delay || flight.arrival?.delay);
}

function simplifyFlight(flight, direction) {
  const number = flight.number || flight.callSign || "—";
  const airline = flight.airline?.name || flight.airline?.iata || "";
  const route = direction === "Arrival"
    ? `${flight.departure?.airport?.iata || "—"} → ${flight.arrival?.airport?.iata || "—"}`
    : `${flight.departure?.airport?.iata || "—"} → ${flight.arrival?.airport?.iata || "—"}`;
  return {
    number,
    airline,
    route,
    direction,
    status: flightStatusLabel(flight),
    scheduled: flight.departure?.scheduledTime?.local || flight.arrival?.scheduledTime?.local || null,
    revised: flight.departure?.revisedTime?.local || flight.arrival?.revisedTime?.local || null,
    delay: flight.departure?.delay || flight.arrival?.delay || null
  };
}

async function fetchUkAirportFlights(iata, env) {
  if (!env.RAPIDAPI_KEY) {
    return { error: "Flight lookup is not configured.", status: 500 };
  }
  const airport = UK_BY_IATA[String(iata || "").toUpperCase()];
  if (!airport) {
    return { error: "Unknown UK airport.", status: 400 };
  }

  const query = [
    "offsetMinutes=-240",
    "durationMinutes=360",
    "withLeg=true",
    "direction=Both",
    "withCancelled=true",
    "withCodeshared=true",
    "withCargo=false",
    "withPrivate=false",
    "withLocation=false"
  ].join("&");

  const upstream = await aerodataboxFetch(`/flights/airports/iata/${airport.iata}?${query}`, env);
  if (upstream.status >= 400) {
    return { error: upstream.data?.message || "Could not load flights.", status: upstream.status };
  }

  const departures = (upstream.data?.departures || []).filter(isDisruptedFlight).map((flight) => simplifyFlight(flight, "Departure"));
  const arrivals = (upstream.data?.arrivals || []).filter(isDisruptedFlight).map((flight) => simplifyFlight(flight, "Arrival"));
  const flights = [...departures, ...arrivals]
    .sort((a, b) => String(b.delay || "").localeCompare(String(a.delay || "")))
    .slice(0, 40);

  return {
    airport,
    flights,
    updatedAt: new Date().toISOString()
  };
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const COMPLAINT_PATTERN = /\b(delay(?:ed|s)?|cancel(?:led|lation|ing)?|queue|queued|stuck|stranded|nightmare|hours?\s+(?:waiting|wait)|missed\s+connection|divert(?:ed|ed)?)\b/i;

function scoreComplaintText(text, airport) {
  const body = String(text || "");
  if (!body) return 0;
  let score = 0;
  if (COMPLAINT_PATTERN.test(body)) score += 2;
  if (new RegExp(`\\b${airport.iata}\\b`, "i").test(body)) score += 1;
  if (new RegExp(airport.name.replace(/\s+/g, "\\s+"), "i").test(body)) score += 1;
  return score;
}

async function searchMastodonPosts(airport, limit = 8) {
  try {
    const mastodonQuery = encodeURIComponent(`${airport.name} delay airport`);
    const response = await fetch(
      `https://mastodon.social/api/v2/search?q=${mastodonQuery}&limit=${limit}&type=statuses`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.statuses || [])
      .map((status) => ({
        network: "mastodon",
        author: status.account?.display_name || status.account?.username || "Unknown",
        handle: status.account?.acct ? `@${status.account.acct}` : "",
        profileUrl: status.account?.url || null,
        postUrl: status.url || null,
        text: stripHtml(status.content).slice(0, 280),
        createdAt: status.created_at || null,
        complaintScore: scoreComplaintText(stripHtml(status.content), airport)
      }))
      .filter((post) => post.text.length > 20);
  } catch {
    return [];
  }
}

async function fetchNewsChatterCount(airport) {
  try {
    const query = encodeURIComponent(`${airport.name} airport delay OR cancelled`);
    const response = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en-GB&gl=GB&ceid=GB:en`,
      { headers: { "User-Agent": "FlydrateDelayBoard/1.0 (+https://flydrate.com)" } }
    );
    if (!response.ok) return 0;
    const xml = await response.text();
    return Math.min((xml.match(/<item>/g) || []).length, 100);
  } catch {
    return 0;
  }
}

function buildSocialLinks(airport) {
  const query = `${airport.name} airport delay OR cancelled flight`;
  const encoded = encodeURIComponent(query);
  return {
    x: `https://x.com/search?q=${encoded}&f=live`,
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${airport.name} airport delay`)}`,
    threads: `https://www.threads.net/search?q=${encoded}`,
    tiktok: `https://www.tiktok.com/search?q=${encoded}`
  };
}

function activityScoreFromSignals(posts, newsCount) {
  const postCount = posts.length;
  const complaintPosts = posts.filter((post) => post.complaintScore >= 2).length;
  const complaintWeight = posts.reduce((sum, post) => sum + post.complaintScore, 0);
  const raw = complaintPosts * 18 + complaintWeight * 8 + postCount * 6 + newsCount * 4;
  return {
    activityScore: Math.min(100, Math.round(raw)),
    postCount,
    complaintPosts,
    newsCount
  };
}

async function fetchAirportSocialActivity(airport) {
  const posts = await searchMastodonPosts(airport, 10);
  const newsCount = await fetchNewsChatterCount(airport);
  const metrics = activityScoreFromSignals(posts, newsCount);
  return {
    iata: airport.iata,
    name: airport.name,
    ...metrics,
    samplePosts: posts.slice(0, 3)
  };
}

async function fetchSocialActivityHeatmap() {
  const chunkSize = 5;
  const airports = [];
  for (let index = 0; index < UK_AIRPORTS.length; index += chunkSize) {
    const slice = UK_AIRPORTS.slice(index, index + chunkSize);
    const batch = await Promise.all(slice.map((airport) => fetchAirportSocialActivity(airport)));
    airports.push(...batch);
  }
  airports.sort((a, b) => b.activityScore - a.activityScore);
  return {
    airports,
    note: "Activity index combines public Mastodon posts and Google News mentions. It is a proxy for traveller frustration — not a full X/Instagram firehose.",
    updatedAt: new Date().toISOString()
  };
}

async function fetchSocialSignals(iata) {
  const airport = UK_BY_IATA[String(iata || "").toUpperCase()];
  if (!airport) {
    return { error: "Unknown UK airport.", status: 400 };
  }

  const query = `${airport.name} airport delay OR cancelled flight`;
  const links = buildSocialLinks(airport);
  const posts = await searchMastodonPosts(airport, 8);
  const newsCount = await fetchNewsChatterCount(airport);
  const metrics = activityScoreFromSignals(posts, newsCount);

  return {
    airport,
    query,
    links,
    posts,
    newsCount,
    activityScore: metrics.activityScore,
    note: "X and Instagram do not offer a free live search API. Use the platform links to find recent posts, and reach out from @flydrateofficial.",
    updatedAt: new Date().toISOString()
  };
}

function alertBoardUrl(env) {
  return env.ALERT_BOARD_URL || "https://laurencenairprice.github.io/flydratelive/uk-delays.html";
}

function alertChannelsConfigured(env) {
  return {
    email: Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL_TO),
    slack: Boolean(env.SLACK_WEBHOOK_URL),
    webhook: Boolean(env.ALERT_WEBHOOK_URL),
    kv: Boolean(env.ALERT_STATE)
  };
}

function isAuthorizedAlertRun(url, env) {
  const secret = env.ALERT_CRON_SECRET;
  if (!secret) return false;
  return url.searchParams.get("key") === secret;
}

async function runAlertCycle(env, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const delays = await fetchUkDelays(env);
  if (delays.error) {
    return { ok: false, error: delays.error, status: delays.status || 502 };
  }

  const state = (await loadAlertState(env.ALERT_STATE)) || {};
  const runCount = (state.runCount || 0) + 1;
  let socialPayload = state.social || { airports: [] };

  if (!dryRun && (runCount % 4 === 0 || options.refreshSocial)) {
    socialPayload = await fetchSocialActivityHeatmap();
    state.social = socialPayload;
  }

  const previousSnapshot = state.snapshot || null;
  const allAlerts = evaluateEarlyWarnings(previousSnapshot, delays, socialPayload);
  const { alerts: alertsToSend, nextSentAt } = filterCooldown(allAlerts, state.lastSentAt || {});

  let delivery = { delivered: false, channels: [], dryRun };
  if (alertsToSend.length && !dryRun) {
    delivery = await deliverAlerts(env, alertsToSend, alertBoardUrl(env), false);
    if (delivery.delivered) {
      state.lastSentAt = nextSentAt;
    }
  } else if (alertsToSend.length && dryRun) {
    delivery = await deliverAlerts(env, alertsToSend, alertBoardUrl(env), true);
  }

  if (!dryRun) {
    state.runCount = runCount;
    state.snapshot = {
      updatedAt: delays.updatedAt,
      airports: delays.airports,
      social: {
        updatedAt: socialPayload.updatedAt || delays.updatedAt,
        airports: socialPayload.airports || []
      }
    };
    state.lastCheckAt = new Date().toISOString();
    state.lastAlertCount = allAlerts.length;
    state.lastSentCount = delivery.delivered ? alertsToSend.length : 0;
    state.lastDelivery = delivery.channels || [];
    await saveAlertState(env.ALERT_STATE, state);
  }

  return {
    ok: true,
    checkedAt: dryRun ? new Date().toISOString() : state.lastCheckAt,
    allAlerts,
    alertsToSend,
    delivery,
    channelsConfigured: alertChannelsConfigured(env),
    snapshotSaved: Boolean(env.ALERT_STATE) && !dryRun
  };
}

async function handleFlightLookup(url, env) {
  if (!env.RAPIDAPI_KEY) {
    return jsonResponse({ error: "Flight lookup is not configured." }, 500);
  }
  const number = String(url.searchParams.get("number") || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const date = url.searchParams.get("date") || "";

  if (!number) {
    return jsonResponse({ error: "Enter a flight number." }, 400);
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: "Use date format YYYY-MM-DD." }, 400);
  }

  let api = `/flights/number/${number}`;
  if (date) api += `/${date}`;

  const upstream = await aerodataboxFetch(api, env);
  return new Response(JSON.stringify(upstream.data), {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/flight") {
      return handleFlightLookup(url, env);
    }

    if (url.pathname === "/api/uk-delays") {
      const payload = await fetchUkDelays(env);
      if (payload.error) return jsonResponse({ error: payload.error }, payload.status || 502);
      return jsonResponse(payload, 200, 120);
    }

    if (url.pathname === "/api/uk-delays/flights") {
      const payload = await fetchUkAirportFlights(url.searchParams.get("iata"), env);
      if (payload.error) return jsonResponse({ error: payload.error }, payload.status || 502);
      return jsonResponse(payload, 200, 90);
    }

    if (url.pathname === "/api/uk-delays/social") {
      const payload = await fetchSocialSignals(url.searchParams.get("iata"));
      if (payload.error) return jsonResponse({ error: payload.error }, payload.status || 502);
      return jsonResponse(payload, 200, 300);
    }

    if (url.pathname === "/api/uk-delays/social-activity") {
      const payload = await fetchSocialActivityHeatmap();
      return jsonResponse(payload, 200, 300);
    }

    if (url.pathname === "/api/uk-delays/alerts/preview") {
      const result = await runAlertCycle(env, { dryRun: true });
      if (!result.ok) return jsonResponse({ error: result.error }, result.status || 502);
      return jsonResponse({
        checkedAt: result.checkedAt,
        channelsConfigured: result.channelsConfigured,
        snapshotSaved: result.snapshotSaved,
        alerts: result.allAlerts,
        wouldNotify: result.alertsToSend,
        deliveryPreview: result.delivery
      }, 200, 30);
    }

    if (url.pathname === "/api/uk-delays/alerts/status") {
      const state = (await loadAlertState(env.ALERT_STATE)) || {};
      return jsonResponse({
        channelsConfigured: alertChannelsConfigured(env),
        snapshotSaved: Boolean(env.ALERT_STATE),
        lastCheckAt: state.lastCheckAt || null,
        lastAlertCount: state.lastAlertCount || 0,
        lastSentCount: state.lastSentCount || 0,
        lastDelivery: state.lastDelivery || [],
        cron: "Every 15 minutes (UTC) when Worker cron is deployed"
      }, 200, 30);
    }

    if (url.pathname === "/api/uk-delays/alerts/run") {
      if (!isAuthorizedAlertRun(url, env)) {
        return jsonResponse({ error: "Unauthorized." }, 401);
      }
      const result = await runAlertCycle(env, { dryRun: false, refreshSocial: true });
      if (!result.ok) return jsonResponse({ error: result.error }, result.status || 502);
      return jsonResponse(result, 200);
    }

    return jsonResponse({ error: "Not found." }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAlertCycle(env, { dryRun: false }));
  }
};
