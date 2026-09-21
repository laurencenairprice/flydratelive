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

async function fetchSocialSignals(iata) {
  const airport = UK_BY_IATA[String(iata || "").toUpperCase()];
  if (!airport) {
    return { error: "Unknown UK airport.", status: 400 };
  }

  const query = `${airport.name} airport delay OR cancelled flight`;
  const encoded = encodeURIComponent(query);
  const links = {
    x: `https://x.com/search?q=${encoded}&f=live`,
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${airport.name} airport delay`)}`,
    threads: `https://www.threads.net/search?q=${encoded}`,
    tiktok: `https://www.tiktok.com/search?q=${encoded}`
  };

  let posts = [];
  try {
    const mastodonQuery = encodeURIComponent(`${airport.name} delay airport`);
    const response = await fetch(
      `https://mastodon.social/api/v2/search?q=${mastodonQuery}&limit=8&type=statuses`,
      { headers: { Accept: "application/json" } }
    );
    if (response.ok) {
      const payload = await response.json();
      posts = (payload.statuses || [])
        .map((status) => ({
          network: "mastodon",
          author: status.account?.display_name || status.account?.username || "Unknown",
          handle: status.account?.acct ? `@${status.account.acct}` : "",
          profileUrl: status.account?.url || null,
          postUrl: status.url || null,
          text: stripHtml(status.content).slice(0, 280),
          createdAt: status.created_at || null
        }))
        .filter((post) => post.text.length > 20);
    }
  } catch {
    posts = [];
  }

  return {
    airport,
    query,
    links,
    posts,
    note: "X and Instagram do not offer a free live search API. Use the platform links to find recent posts, and reach out from @flydrateofficial.",
    updatedAt: new Date().toISOString()
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

    return jsonResponse({ error: "Not found." }, 404);
  }
};
