(function () {
  const REFRESH_MS = 5 * 60 * 1000;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flightApiBase() {
    const configured = document.documentElement.getAttribute("data-flight-api");
    return configured ? configured.replace(/\/$/, "") : "";
  }

  function setStatus(message, tone) {
    const node = $("delayStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone || "info";
  }

  function severityLabel(score) {
    if (score >= 3.5) return "High disruption";
    if (score >= 2) return "Moderate delays";
    if (score >= 1) return "Some delays";
    return "Mostly on time";
  }

  function severityClass(score) {
    if (score >= 3.5) return "delay-severity-high";
    if (score >= 2) return "delay-severity-mid";
    if (score >= 1) return "delay-severity-low";
    return "delay-severity-ok";
  }

  function formatDelay(value) {
    if (!value) return "—";
    return String(value).replace(/^PT/i, "").replace(/(\d+)M/i, "$1m").replace(/(\d+)H/i, "$1h ");
  }

  function renderSummary(airports) {
    const disrupted = airports.filter((airport) => airport.score >= 2 || airport.cancelledTotal > 0);
    $("delaySummary").innerHTML = `
      <div class="delay-stat">
        <p class="mono">Airports tracked</p>
        <p class="delay-stat-value">${airports.length}</p>
      </div>
      <div class="delay-stat">
        <p class="mono">Showing disruption</p>
        <p class="delay-stat-value">${disrupted.length}</p>
      </div>
      <div class="delay-stat">
        <p class="mono">Cancellations (2h window)</p>
        <p class="delay-stat-value">${airports.reduce((sum, airport) => sum + airport.cancelledTotal, 0)}</p>
      </div>
    `;
  }

  function airportCard(airport) {
    return `<article class="delay-card ${severityClass(airport.score)}" data-iata="${escapeHtml(airport.iata)}">
      <header class="delay-card-head">
        <div>
          <span class="codes">${escapeHtml(airport.iata)}</span>
          <p class="airport-name">${escapeHtml(airport.name)}</p>
        </div>
        <span class="delay-pill">${escapeHtml(severityLabel(airport.score))}</span>
      </header>
      <dl class="delay-metrics">
        <div><dt class="mono">Delay index</dt><dd>${airport.score ? airport.score.toFixed(1) : "—"}</dd></div>
        <div><dt class="mono">Cancelled</dt><dd>${airport.cancelledTotal}</dd></div>
        <div><dt class="mono">Dep median</dt><dd>${escapeHtml(formatDelay(airport.departures.medianDelay))}</dd></div>
        <div><dt class="mono">Arr median</dt><dd>${escapeHtml(formatDelay(airport.arrivals.medianDelay))}</dd></div>
      </dl>
      <div class="delay-card-actions">
        <button type="button" class="btn delay-load-btn" data-action="flights" data-iata="${escapeHtml(airport.iata)}">Live delays &amp; cancellations</button>
        <button type="button" class="btn delay-load-btn" data-action="social" data-iata="${escapeHtml(airport.iata)}">Travellers online</button>
      </div>
      <div class="delay-detail" id="detail-${escapeHtml(airport.iata)}" hidden></div>
    </article>`;
  }

  function renderBoard(payload) {
    const root = $("delayBoard");
    if (!root) return;
    const airports = payload.airports || [];
    renderSummary(airports);
    root.innerHTML = airports.map(airportCard).join("");
    $("delayUpdated").textContent = payload.updatedAt
      ? `Updated ${new Date(payload.updatedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : "";
  }

  function renderFlightsDetail(airport, payload) {
    const flights = payload.flights || [];
    if (!flights.length) {
      return `<p class="delay-detail-copy">No delayed or cancelled passenger flights in the last few hours for ${escapeHtml(airport.name)}.</p>`;
    }
    const rows = flights.map((flight) => `<tr>
      <td class="mono">${escapeHtml(flight.number)}</td>
      <td>${escapeHtml(flight.route)}</td>
      <td>${escapeHtml(flight.direction)}</td>
      <td>${escapeHtml(flight.status)}</td>
      <td class="mono">${escapeHtml(formatDelay(flight.delay))}</td>
    </tr>`).join("");
    return `
      <p class="mono delay-detail-kicker">Disrupted flights</p>
      <div class="delay-table-wrap">
        <table class="delay-table">
          <thead><tr><th>Flight</th><th>Route</th><th>Dir</th><th>Status</th><th>Delay</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderSocialDetail(airport, payload) {
    const links = payload.links || ukSocialLinks(airport);
    const draft = ukOutreachDraft(airport);
    const linkRow = `
      <div class="delay-social-links">
        <a class="btn" href="${escapeHtml(links.x)}" target="_blank" rel="noopener noreferrer">Search X (live)</a>
        <a class="btn" href="${escapeHtml(links.instagram)}" target="_blank" rel="noopener noreferrer">Search Instagram</a>
        <a class="btn" href="${escapeHtml(links.threads)}" target="_blank" rel="noopener noreferrer">Search Threads</a>
        <a class="btn" href="${escapeHtml(links.tiktok)}" target="_blank" rel="noopener noreferrer">Search TikTok</a>
      </div>`;

    const posts = (payload.posts || []).map((post) => `<article class="delay-post">
      <header>
        <p class="mono">${escapeHtml(post.network)} · ${escapeHtml(post.author)} ${escapeHtml(post.handle)}</p>
        <p class="delay-post-time">${post.createdAt ? escapeHtml(new Date(post.createdAt).toLocaleString("en-GB")) : ""}</p>
      </header>
      <p>${escapeHtml(post.text)}</p>
      <p class="delay-post-links">
        ${post.postUrl ? `<a href="${escapeHtml(post.postUrl)}" target="_blank" rel="noopener noreferrer">Open post</a>` : ""}
        ${post.profileUrl ? `<a href="${escapeHtml(post.profileUrl)}" target="_blank" rel="noopener noreferrer">Profile</a>` : ""}
      </p>
    </article>`).join("");

    return `
      <p class="mono delay-detail-kicker">Reach travellers talking about ${escapeHtml(airport.name)}</p>
      <p class="delay-detail-copy">${escapeHtml(payload.note || "")}</p>
      ${linkRow}
      <label class="mono" for="outreach-${escapeHtml(airport.iata)}">Suggested DM / reply</label>
      <textarea class="delay-outreach" id="outreach-${escapeHtml(airport.iata)}" rows="4" readonly>${escapeHtml(draft)}</textarea>
      <button type="button" class="btn btn-solid delay-copy-btn" data-copy-target="outreach-${escapeHtml(airport.iata)}">Copy outreach message</button>
      ${posts ? `<div class="delay-posts">${posts}</div>` : `<p class="delay-detail-copy">No recent public posts found in our Mastodon sample. Use the platform searches above for X and Instagram.</p>`}`;
  }

  async function loadBoard() {
    setStatus("Loading live UK airport disruption…");
    try {
      const response = await fetch(`${flightApiBase()}/api/uk-delays`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load delays.");
      renderBoard(payload);
      setStatus("Live disruption board refreshed.", "ok");
    } catch (error) {
      setStatus(error.message || "Could not load delays.", "error");
    }
  }

  async function loadDetail(iata, action) {
    const target = $(`detail-${iata}`);
    if (!target) return;
    target.hidden = false;
    target.innerHTML = `<p class="delay-detail-copy">Loading…</p>`;
    const airport = ukAirportByIata(iata);
    try {
      const path = action === "social" ? "/api/uk-delays/social" : "/api/uk-delays/flights";
      const response = await fetch(`${flightApiBase()}${path}?iata=${encodeURIComponent(iata)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      target.innerHTML = action === "social"
        ? renderSocialDetail(airport, payload)
        : renderFlightsDetail(airport, payload);
    } catch (error) {
      target.innerHTML = `<p class="delay-detail-copy">${escapeHtml(error.message || "Could not load details.")}</p>`;
    }
  }

  function bindBoard() {
    document.addEventListener("click", (event) => {
      const loadBtn = event.target.closest(".delay-load-btn");
      if (loadBtn) {
        loadDetail(loadBtn.dataset.iata, loadBtn.dataset.action);
        return;
      }
      const copyBtn = event.target.closest(".delay-copy-btn");
      if (copyBtn) {
        const field = $(copyBtn.dataset.copyTarget);
        if (!field) return;
        field.select();
        navigator.clipboard.writeText(field.value).catch(() => {});
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy outreach message"; }, 1600);
      }
    });

    $("delayRefresh")?.addEventListener("click", () => loadBoard());
  }

  bindBoard();
  loadBoard();
  setInterval(loadBoard, REFRESH_MS);
})();
