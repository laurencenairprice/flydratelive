const aircraftData = {
  "Airbus A220": "modern",
  "Airbus A318": "typical",
  "Airbus A319": "typical",
  "Airbus A320": "typical",
  "Airbus A321": "typical",
  "Airbus A321neo": "typical",
  "Airbus A321LR": "typical",
  "Airbus A321XLR": "typical",
  "Airbus A300": "dry",
  "Airbus A310": "dry",
  "Airbus A330": "dry",
  "Airbus A330neo": "dry",
  "Airbus A340": "dry",
  "Airbus A350": "modern",
  "Airbus A380": "dry",
  "Boeing 737": "verydry",
  "Boeing 737 MAX": "verydry",
  "Boeing 747": "verydry",
  "Boeing 757": "dry",
  "Boeing 767": "dry",
  "Boeing 777": "verydry",
  "Boeing 787": "modern",
  "Embraer E170/E175": "typical",
  "Embraer E190/E195": "typical",
  "Embraer E2": "typical",
  "Embraer ERJ": "typical",
  "Bombardier CRJ": "typical",
  "McDonnell Douglas MD-80/90": "verydry",
  "McDonnell Douglas MD-11": "verydry"
};

const humidityFactor = { verydry: 1.10, dry: 1.05, typical: 1.02, modern: 1.00 };
const altitudeRate = { verydry: 6, dry: 5, typical: 4, modern: 3 };
const cabinLabel = {
  verydry: "Very dry cabin",
  dry: "Dry cabin",
  typical: "Typical commercial cabin",
  modern: "Higher-humidity modern cabin"
};

var flydrateFdFamilies = {
  b787: { rating: 1, cabin: "Higher-humidity modern cabin (~15% RH)", family: "787-8 / 787-9 / 787-10" },
  a350: { rating: 1, cabin: "Higher-humidity modern cabin (~15% RH)", family: "A350-900 / A350-1000" },
  a380: { rating: 2, cabin: "Potentially higher-humidity widebody", family: "A380-800" },
  a320: { rating: 3, cabin: "Typical modern narrowbody", family: "A320 family" },
  b737: { rating: 4, cabin: "Typical commercial cabin", family: "737 family / 737 MAX" },
  a330: { rating: 5, cabin: "Typical/dry widebody", family: "A330 / A330neo" },
  a340: { rating: 5, cabin: "Typical/dry widebody", family: "A340" },
  crj: { rating: 5, cabin: "Typical regional jet cabin", family: "CRJ family" },
  b767: { rating: 6, cabin: "Dry widebody", family: "767" },
  b757: { rating: 7, cabin: "Dry older-generation cabin", family: "757" },
  b777: { rating: 8, cabin: "Very dry in measured sample", family: "777 / 777-200 / 777-300ER" },
  a300: { rating: 8, cabin: "Older-generation widebody / dry", family: "A300 / A310" },
  b747: { rating: 9, cabin: "Very dry in measured sample", family: "747 / 747-400 / 747-8" },
  md11: { rating: 9, cabin: "Older widebody / dry environment", family: "MD-11" },
  md80: { rating: 10, cabin: "Older-generation / potentially very dry", family: "MD-80 / MD-90" },
  ejet: { rating: 4, cabin: "Typical regional jet cabin", family: "E170 / E175 / E190 / E195" },
  e2: { rating: 4, cabin: "Typical modern regional jet cabin", family: "E190-E2 / E195-E2" }
};

function fdForAircraft(name) {
  const n = String(name || "").toLowerCase();
  const rules = [
    [/787|dreamliner|b78[89x]/, "b787"],
    [/a350|a359|a35k|350-9|350-10/, "a350"],
    [/a380|a388|380-8/, "a380"],
    [/a321|a320|a319|a318|a20n|a21n/, "a320"],
    [/737|b73/, "b737"],
    [/a330|a332|a333|a339/, "a330"],
    [/a340|a342|a343|a345|a346/, "a340"],
    [/767|b76/, "b767"],
    [/757|b75/, "b757"],
    [/777|b77/, "b777"],
    [/747|b74/, "b747"],
    [/md-?11/, "md11"],
    [/md-?8|md-?9/, "md80"],
    [/a300|a310/, "a300"],
    [/e190-?e2|e195-?e2|embraer e2/, "e2"],
    [/e170|e175|e190|e195/, "ejet"],
    [/crj/, "crj"]
  ];
  for (const [pattern, key] of rules) {
    if (pattern.test(n)) return flydrateFdFamilies[key];
  }
  return null;
}

const $ = (id) => document.getElementById(id);

function flightApiBase() {
  const configured = document.documentElement.getAttribute("data-flight-api");
  if (configured) return configured.replace(/\/$/, "");
  return "";
}

function normaliseFlightNumber(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function matchAircraftName(model) {
  if (!model) return "Boeing 777";
  const raw = model.trim();
  const names = Object.keys(aircraftData);
  const lower = raw.toLowerCase();
  const direct = names.find((name) => lower === name.toLowerCase());
  if (direct) return direct;
  const contained = names.find((name) => lower.includes(name.toLowerCase()));
  if (contained) return contained;

  const rules = [
    [/a220|cs100|cs300/, "Airbus A220"],
    [/a318/, "Airbus A318"],
    [/a319/, "Airbus A319"],
    [/a321.?xlr|321xlr/, "Airbus A321XLR"],
    [/a321.?lr|321lr/, "Airbus A321LR"],
    [/a321.?n|321neo/, "Airbus A321neo"],
    [/a321/, "Airbus A321"],
    [/a320/, "Airbus A320"],
    [/a330.?n|330neo/, "Airbus A330neo"],
    [/a330/, "Airbus A330"],
    [/a340/, "Airbus A340"],
    [/a350/, "Airbus A350"],
    [/a380/, "Airbus A380"],
    [/a300/, "Airbus A300"],
    [/a310/, "Airbus A310"],
    [/737.?max|7m8|7m9/, "Boeing 737 MAX"],
    [/737/, "Boeing 737"],
    [/747/, "Boeing 747"],
    [/757/, "Boeing 757"],
    [/767/, "Boeing 767"],
    [/777/, "Boeing 777"],
    [/787|dreamliner/, "Boeing 787"],
    [/e175|e170/, "Embraer E170/E175"],
    [/e195|e190/, "Embraer E190/E195"],
    [/e2/, "Embraer E2"],
    [/erj/, "Embraer ERJ"],
    [/crj/, "Bombardier CRJ"],
    [/md-?11/, "McDonnell Douglas MD-11"],
    [/md-?8|md-?9/, "McDonnell Douglas MD-80/90"]
  ];
  for (const [pattern, name] of rules) {
    if (pattern.test(lower)) return name;
  }
  return raw;
}

function ensureAircraftOption(name) {
  const select = $("aircraft");
  const exists = [...select.options].some((option) => option.value === name);
  if (!exists) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
    if (!aircraftData[name]) aircraftData[name] = "typical";
  }
  select.value = name;
}

function parseAdbTime(value) {
  if (!value) return null;
  const raw = typeof value === "string" ? value : value.utc || value.local;
  if (!raw) return null;
  const normalised = String(raw).replace(" ", "T");
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(dep, arr) {
  if (!dep || !arr) return null;
  let hours = (arr.getTime() - dep.getTime()) / 3600000;
  if (hours < 0) hours += 24;
  if (hours <= 0 || hours > 30) return null;
  return Math.round(hours * 4) / 4;
}

function formatHours(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${hours.toFixed(hours % 1 ? 2 : 0)} h`;
  return `${whole}h ${String(minutes).padStart(2, "0")}m`;
}

function recommendedCans(hours) {
  if (hours <= 5) return 1;
  if (hours <= 10) return 2;
  if (hours <= 15) return 3;
  if (hours <= 20) return 4;
  return 5;
}

function buildFdScale() {
  const scale = $("fdScale");
  if (!scale || scale.childElementCount) return;
  for (let i = 1; i <= 10; i += 1) {
    const mark = document.createElement("span");
    mark.textContent = String(i);
    scale.appendChild(mark);
  }
}

function fdLabel(rating) {
  return `FD${String(rating).padStart(2, "0")}`;
}

function renderFd(aircraft) {
  const rating = fdForAircraft(aircraft);
  const score = $("fdScore");
  const cabin = $("fdCabin");
  const found = $("fdFound");
  const panel = $("fdPanel");
  const scale = $("fdScale");
  if (scale) {
    [...scale.children].forEach((mark, index) => {
      mark.classList.toggle("on", Boolean(rating) && index + 1 === rating.rating);
    });
  }
  if (panel) panel.dataset.fd = rating ? String(rating.rating) : "";

  if (!rating) {
    if (score) score.textContent = "FD—";
    if (cabin) cabin.textContent = "FD rating not listed for this aircraft type.";
    if (found) found.textContent = "";
    return rating;
  }

  const label = fdLabel(rating.rating);
  if (score) score.textContent = label;
  if (cabin) cabin.textContent = rating.cabin;
  if (found) found.textContent = `${label} · ${rating.cabin}`;
  return rating;
}

function calculate() {
  const aircraft = $("aircraft").value;
  renderFd(aircraft);
  const hours = parseFloat($("hours").value);
  if (!Number.isFinite(hours) || hours <= 0) {
    $("total").textContent = "—";
    $("details").textContent = "Enter a valid flight duration.";
    $("cans").textContent = "—";
    $("canDetails").textContent = "250 mL cans";
    return;
  }

  const category = aircraftData[aircraft] || "typical";
  const rating = fdForAircraft(aircraft);
  const normal = 2750 * (hours / 24);
  const cabin = 150 * (hours / 8) * humidityFactor[category];
  const altitude = altitudeRate[category] * hours;
  const total = normal + cabin + altitude;
  const cans = recommendedCans(hours);
  const score = rating ? fdLabel(rating.rating) : "FD—";

  $("total").textContent = `${(total / 1000).toFixed(2)} L`;
  $("details").textContent = `${aircraft} · ${score} · ${rating ? rating.cabin : cabinLabel[category]} · ${formatHours(hours)}`;
  $("cans").textContent = `${cans} × 250 mL`;
  $("canDetails").textContent =
    cans === 1 ? "1 can recommended for the journey" : `${cans} cans recommended across the journey`;
}

function setStatus(message, kind) {
  const el = $("flightStatus");
  el.textContent = message;
  el.dataset.kind = kind || "";
}

let journeyFrame = 0;
let journeyDelay = 0;

function buildHydrateCells() {
  const row = $("hydrateCells");
  if (!row || row.childElementCount) return;
  for (let i = 0; i < 20; i += 1) {
    row.appendChild(document.createElement("span"));
  }
}

function setHydration(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const on = Math.round((clamped / 100) * 20);
  $("hydratePct").textContent = `${Math.round(clamped)}%`;
  [...$("hydrateCells").children].forEach((cell, index) => {
    cell.classList.toggle("off", index >= on);
  });
}

function stopJourney() {
  if (journeyDelay) {
    clearTimeout(journeyDelay);
    journeyDelay = 0;
  }
  if (journeyFrame) cancelAnimationFrame(journeyFrame);
  journeyFrame = 0;
}

function playJourney(hours) {
  stopJourney();
  const plane = $("journeyPlane");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : Math.round(Math.min(18, Math.max(10, (hours || 12) * 0.8)) * 1000);

  const apply = (t) => {
    plane.style.left = `${t * 100}%`;
    setHydration((1 - t) * 100);
  };

  if (!duration) {
    apply(1);
    return;
  }

  apply(0);
  journeyDelay = setTimeout(() => {
    journeyDelay = 0;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      apply(t);
      if (t < 1) journeyFrame = requestAnimationFrame(tick);
    };
    journeyFrame = requestAnimationFrame(tick);
  }, 1500);
}

function countryFromAirport(airport, iata) {
  const raw = airport?.countryCode || iataCountry[String(iata || "").toUpperCase()] || "";
  const code = String(raw).toUpperCase();
  if (code === "UK") return "GB";
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

const iataCountry = {
  LHR: "GB", LGW: "GB", STN: "GB", LTN: "GB", MAN: "GB", EDI: "GB", GLA: "GB", BHX: "GB", BRS: "GB", NCL: "GB", BFS: "GB", LCY: "GB",
  SIN: "SG",
  JFK: "US", EWR: "US", LGA: "US", LAX: "US", SFO: "US", ORD: "US", MIA: "US", DFW: "US", ATL: "US", BOS: "US", SEA: "US", IAD: "US",
  CDG: "FR", ORY: "FR",
  AMS: "NL",
  FRA: "DE", MUC: "DE",
  MAD: "ES", BCN: "ES",
  FCO: "IT", MXP: "IT",
  DUB: "IE",
  ZRH: "CH", GVA: "CH",
  VIE: "AT",
  CPH: "DK", OSL: "NO", ARN: "SE", HEL: "FI",
  LIS: "PT",
  ATH: "GR",
  IST: "TR",
  DXB: "AE", AUH: "AE", DOH: "QA", BAH: "BH", MCT: "OM", RUH: "SA", JED: "SA",
  HND: "JP", NRT: "JP", KIX: "JP",
  ICN: "KR",
  PEK: "CN", PVG: "CN", CAN: "CN", HKG: "HK", TPE: "TW",
  BKK: "TH", DMK: "TH",
  KUL: "MY", CGK: "ID", MNL: "PH", SGN: "VN", HAN: "VN",
  SYD: "AU", MEL: "AU", BNE: "AU", PER: "AU", ADL: "AU", AKL: "NZ",
  DEL: "IN", BOM: "IN", BLR: "IN", MAA: "IN",
  JNB: "ZA", CPT: "ZA", NBO: "KE", CAI: "EG", LOS: "NG", ADD: "ET",
  GRU: "BR", GIG: "BR", EZE: "AR", SCL: "CL", LIM: "PE", MEX: "MX", CUN: "MX", YYZ: "CA", YVR: "CA",
  GUM: "GU", HNL: "US"
};

function setFlag(img, iso) {
  const code = String(iso || "").toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) {
    img.hidden = true;
    img.removeAttribute("src");
    return;
  }
  img.src = `https://flagcdn.com/w40/${code}.png`;
  img.hidden = false;
  img.onerror = () => {
    img.hidden = true;
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shopName(unit) {
  const name = String(unit || "").trim();
  if (!name) return "";
  return /^whsmiths?\b/i.test(name) ? name : `WHSmiths ${name}`;
}

function stockPanelHtml(role, code, terminal) {
  const iata = stockIata(code);
  const match = stockMatch(iata, terminal);
  const title = terminal && match?.matchedTerminal
    ? `${role} · ${iata} ${match.terminals[0].label}`
    : `${role} · ${iata || "—"}`;

  if (!match) {
    return `<article class="stock-panel">
      <p class="mono">${escapeHtml(title)}</p>
      <p class="stock-copy">Not available at this location, Shop at <a href="https://flydrate.com">www.Flydrate.com</a></p>
    </article>`;
  }

  const units = match.terminals
    .flatMap((term) => term.units.map((unit) => {
      const shop = shopName(unit);
      const place = match.matchedTerminal || match.terminals.length === 1
        ? shop
        : `${term.label}: ${shop}`;
      return `<li>${escapeHtml(place)}</li>`;
    }))
    .join("");

  return `<article class="stock-panel">
    <p class="mono">${escapeHtml(title)}</p>
    <p class="stock-security stock-security-${match.security}">${escapeHtml(securityCopy(match))}</p>
    <p class="stock-copy">Buy Flydrate at:</p>
    <ul class="stock-units">${units}</ul>
  </article>`;
}

function renderStock(info) {
  const grid = $("stockGrid");
  if (!grid) return;
  grid.innerHTML = [
    stockPanelHtml("Depart", info.fromCode, info.fromTerminal),
    stockPanelHtml("Arrive", info.toCode, info.toTerminal)
  ].join("");
}

function renderAirportDirectory() {
  const root = $("airportCards");
  if (!root) return;
  const cards = Object.entries(flydrateStockists)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([iata, airport]) => {
      const terminals = airport.terminals.map((term) => {
        const units = term.units.map((unit) => `<li>${escapeHtml(shopName(unit))}</li>`).join("");
        const heading = term.key ? term.label : "Units";
        return `<div class="airport-term">
          <p class="mono">${escapeHtml(heading)}</p>
          <ul class="stock-units">${units}</ul>
        </div>`;
      }).join("");
      return `<article class="airport-card">
        <header>
          <span class="codes">${escapeHtml(iata)}</span>
          <span class="stock-pill stock-pill-${airport.security}">${airport.security === "yes" ? "Through security" : "Buy after security"}</span>
        </header>
        <p class="airport-name">${escapeHtml(airport.name)}</p>
        <p class="stock-security stock-security-${airport.security}">${escapeHtml(securityCopy(airport))}</p>
        ${terminals}
      </article>`;
    })
    .join("");
  root.innerHTML = cards;
}

function showFlight(info) {
  $("route").textContent = info.route;
  $("aircraftFound").textContent = info.aircraftLabel;
  renderFd(info.aircraftName || info.aircraftLabel);
  $("durationFound").textContent = info.durationLabel;
  $("flightMeta").textContent = info.metaLabel;
  $("journeyFrom").textContent = info.fromCode || "—";
  $("journeyTo").textContent = info.toCode || "—";
  setFlag($("journeyFromFlag"), info.fromCountry);
  setFlag($("journeyToFlag"), info.toCountry);
  renderStock(info);
  $("flightInfo").hidden = false;
  playJourney(info.hours);
}

function pickFlight(payload) {
  const list = Array.isArray(payload) ? payload : payload?.data || payload?.flights || [];
  const flights = list.filter((flight) => flight && flight.isCargo !== true);
  const ranked = (flights.length ? flights : list).slice().sort((a, b) => {
    const score = (flight) => {
      let value = 0;
      if (flight.codeshareStatus === "IsOperator") value += 3;
      if (flight.aircraft?.model) value += 2;
      if (flight.status && String(flight.status).toLowerCase() !== "unknown") value += 1;
      return value;
    };
    return score(b) - score(a);
  });
  return ranked[0] || null;
}

function flightToView(flight, number) {
  const from = flight.departure?.airport?.iata || flight.departure?.airport?.icao || "—";
  const to = flight.arrival?.airport?.iata || flight.arrival?.airport?.icao || "—";
  const fromName = flight.departure?.airport?.name || from;
  const toName = flight.arrival?.airport?.name || to;
  const model = flight.aircraft?.model || flight.aircraft?.type || "";
  const matched = matchAircraftName(model || "Typical commercial cabin");
  const dep =
    parseAdbTime(flight.departure?.actualTime) ||
    parseAdbTime(flight.departure?.revisedTime) ||
    parseAdbTime(flight.departure?.scheduledTime);
  const arr =
    parseAdbTime(flight.arrival?.actualTime) ||
    parseAdbTime(flight.arrival?.revisedTime) ||
    parseAdbTime(flight.arrival?.scheduledTime);
  const hours = hoursBetween(dep, arr);
  const airline = flight.airline?.name || "";
  const status = flight.status || "Scheduled";
  const distance = flight.greatCircleDistance?.km
    ? `${Math.round(flight.greatCircleDistance.km)} km`
    : "";

  return {
    number: flight.number || number,
    route: `${from} → ${to}`,
    fromCode: from,
    toCode: to,
    fromTerminal: flight.departure?.terminal || "",
    toTerminal: flight.arrival?.terminal || "",
    fromCountry: countryFromAirport(flight.departure?.airport, from),
    toCountry: countryFromAirport(flight.arrival?.airport, to),
    routeLong: `${fromName} → ${toName}`,
    aircraftName: matched,
    aircraftLabel: model ? `Aircraft: ${model}` : `Aircraft: ${matched}`,
    hours,
    durationLabel: hours
      ? `Flight duration: ${formatHours(hours)}`
      : "Duration unavailable — enter hours below",
    metaLabel: [airline, status, distance].filter(Boolean).join(" · ")
  };
}

async function lookupFlight(event) {
  if (event) event.preventDefault();
  const number = normaliseFlightNumber($("flightNumber").value);
  const date = $("flightDate").value;
  $("flightInfo").hidden = true;

  if (!number) {
    setStatus("Enter a flight number, for example BA16.", "error");
    return;
  }

  setStatus("Finding flight…");
  $("findFlight").disabled = true;
  stopJourney();

  try {
    const query = new URLSearchParams({ number });
    if (date) query.set("date", date);
    const response = await fetch(`${flightApiBase()}/api/flight?${query.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Flight lookup failed.");
    }

    const flight = pickFlight(payload);
    if (!flight) {
      setStatus("No matching passenger flight found for that number and date.", "error");
      return;
    }

    const view = flightToView(flight, number);
    ensureAircraftOption(view.aircraftName);
    if (view.hours) $("hours").value = view.hours;
    showFlight(view);
    setStatus(`Flight ${view.number} found.`);
    calculate();
  } catch (error) {
    setStatus(error.message || "Could not reach flight data.", "error");
  } finally {
    $("findFlight").disabled = false;
  }
}

function populateAircraft() {
  const select = $("aircraft");
  select.innerHTML = "";
  Object.keys(aircraftData)
    .sort()
    .forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  select.value = "Boeing 777";
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function initCalculator() {
  if (initCalculator.done) return;
  initCalculator.done = true;
  populateAircraft();
  buildHydrateCells();
  buildFdScale();
  setHydration(100);
  renderAirportDirectory();
  $("flightDate").value = todayISO();
  $("lookupForm").addEventListener("submit", lookupFlight);
  $("hours").addEventListener("input", calculate);
  $("aircraft").addEventListener("change", calculate);
  calculate();
}

document.addEventListener("DOMContentLoaded", initCalculator);
if (document.readyState !== "loading") initCalculator();
