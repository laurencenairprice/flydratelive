(function () {
  const REFRESH_MS = 5 * 60 * 1000;
  let demoMode = false;
  let refreshTimer = null;

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

  function heatPointsFromAirports(airports, valuePicker) {
    return airports.map((airport) => {
      const meta = ukAirportByIata(airport.iata);
      if (!meta) return null;
      return {
        iata: airport.iata,
        name: airport.name || meta.name,
        lat: meta.lat,
        lon: meta.lon,
        value: valuePicker(airport)
      };
    }).filter(Boolean);
  }

  function renderDelayHeatmaps(airports) {
    const points = heatPointsFromAirports(airports, (airport) => airport.score || 0);
    const delayMount = $("delayHeatmapMount");
    const delayBars = $("delayHeatBars");
    if (!delayMount || !delayBars) return;
    delayMount.innerHTML = ukHeatmapSvg(points, {
      title: "UK airport delay heat map",
      mapId: "delay",
      maxValue: 5,
      getValue: (point) => point.value
    }) + ukHeatLegend("High disruption", "delay");
    delayBars.innerHTML = ukActivityBars(points, (point) => point.value, (value) => value.toFixed(1));
  }

  function renderSocialHeatmaps(payload) {
    const socialMount = $("socialHeatmapMount");
    const socialBars = $("socialHeatBars");
    const status = $("socialHeatStatus");
    if (!socialMount || !socialBars) return;
    const airports = payload?.airports || [];
    const points = heatPointsFromAirports(airports, (airport) => airport.activityScore || 0);
    socialMount.innerHTML = ukHeatmapSvg(points, {
      title: "UK airport complaint activity heat map",
      mapId: "social",
      maxValue: 100,
      getValue: (point) => point.value
    }) + ukHeatLegend("High activity", "social");
    socialBars.innerHTML = ukActivityBars(points, (point) => point.value, (value) => `${Math.round(value)} / 100`);
    if (status) {
      status.textContent = payload?.note || "Complaint activity refreshed.";
      status.dataset.tone = "ok";
    }
  }

  function mergeAirportSocial(delaysPayload, socialPayload) {
    const socialMap = Object.fromEntries((socialPayload?.airports || []).map((airport) => [airport.iata, airport]));
    return {
      ...delaysPayload,
      airports: (delaysPayload?.airports || []).map((airport) => {
        const social = socialMap[airport.iata] || {};
        return {
          ...airport,
          delayPosts: typeof social.postCount === "number" ? social.postCount : null,
          complaintPosts: typeof social.complaintPosts === "number" ? social.complaintPosts : null,
          newsMentions: typeof social.newsCount === "number" ? social.newsCount : null,
          activityScore: typeof social.activityScore === "number" ? social.activityScore : null
        };
      })
    };
  }

  function formatDelayPostsStat(airport) {
    if (airport.delayPosts == null) return "—";
    return String(airport.delayPosts);
  }

  function delayPostsCaption(airport) {
    if (airport.delayPosts == null) return "Public post sample not loaded";
    const bits = [`${airport.delayPosts} public post${airport.delayPosts === 1 ? "" : "s"} about delays`];
    if (airport.complaintPosts) bits.push(`${airport.complaintPosts} mention delays/cancellations`);
    if (airport.newsMentions) bits.push(`${airport.newsMentions} news mentions`);
    return bits.join(" · ");
  }

  function renderSummary(airports) {
    const disrupted = airports.filter((airport) => airport.score >= 2 || airport.cancelledTotal > 0);
    const totalPosts = airports.reduce((sum, airport) => sum + (airport.delayPosts || 0), 0);
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
      <div class="delay-stat">
        <p class="mono">Delay posts (sample)</p>
        <p class="delay-stat-value">${totalPosts || "—"}</p>
      </div>
    `;
  }

  function socialQuickLinksHtml(airport) {
    const meta = ukAirportByIata(airport.iata) || airport;
    const chips = ukSocialQuickLinks(meta).map((link) => {
      const network = link.network === "instagram" ? "IG" : "X";
      return `<a class="delay-social-chip delay-social-chip-${link.network}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span class="mono">${network}</span> ${escapeHtml(link.label)}</a>`;
    }).join("");
    return `<div class="delay-social-quick">
      <p class="mono">Search travellers</p>
      <div class="delay-social-chip-row">${chips}</div>
    </div>`;
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
        <div><dt class="mono">People posting</dt><dd title="${escapeHtml(delayPostsCaption(airport))}">${formatDelayPostsStat(airport)}</dd></div>
        <div><dt class="mono">News mentions</dt><dd>${airport.newsMentions == null ? "—" : airport.newsMentions}</dd></div>
      </dl>
      <p class="delay-post-caption">${escapeHtml(delayPostsCaption(airport))}</p>
      ${socialQuickLinksHtml(airport)}
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
    const quick = ukSocialQuickLinks(airport).map((link) => {
      const network = link.network === "instagram" ? "IG" : "X";
      return `<a class="delay-social-chip delay-social-chip-${link.network}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span class="mono">${network}</span> ${escapeHtml(link.label)}</a>`;
    }).join("");
    const linkRow = `
      <div class="delay-social-chip-row">${quick}</div>
      <div class="delay-social-links">
        <a class="btn" href="${escapeHtml(links.x)}" target="_blank" rel="noopener noreferrer">All X results</a>
        <a class="btn" href="${escapeHtml(links.instagram)}" target="_blank" rel="noopener noreferrer">All Instagram results</a>
        <a class="btn" href="${escapeHtml(links.threads)}" target="_blank" rel="noopener noreferrer">Threads</a>
        <a class="btn" href="${escapeHtml(links.tiktok)}" target="_blank" rel="noopener noreferrer">TikTok</a>
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

    const activityLine = typeof payload.activityScore === "number"
      ? `<p class="delay-detail-copy"><strong>Complaint activity index:</strong> ${payload.activityScore} / 100${payload.newsCount ? ` · ${payload.newsCount} recent news mentions` : ""}</p>`
      : "";

    return `
      <p class="mono delay-detail-kicker">Reach travellers talking about ${escapeHtml(airport.name)}</p>
      ${activityLine}
      <p class="delay-detail-copy">${escapeHtml(payload.note || "")}</p>
      ${linkRow}
      <label class="mono" for="outreach-${escapeHtml(airport.iata)}">Suggested DM / reply</label>
      <textarea class="delay-outreach" id="outreach-${escapeHtml(airport.iata)}" rows="4" readonly>${escapeHtml(draft)}</textarea>
      <button type="button" class="btn btn-solid delay-copy-btn" data-copy-target="outreach-${escapeHtml(airport.iata)}">Copy outreach message</button>
      ${posts ? `<div class="delay-posts">${posts}</div>` : `<p class="delay-detail-copy">No recent public posts found in our Mastodon sample. Use the platform searches above for X and Instagram.</p>`}`;
  }

  function applyDemoScenario() {
    demoMode = true;
    document.body.classList.add("delay-demo-active");
    $("delayDemoBanner")?.removeAttribute("hidden");
    const demoBtn = $("delayDemo");
    if (demoBtn) demoBtn.textContent = "Exit demo";

    const social = ukDemoSocialPayload();
    const merged = mergeAirportSocial(ukDemoDelaysPayload(), social);
    renderBoard(merged);
    renderDelayHeatmaps(merged.airports);
    renderSocialHeatmaps(social);
    renderAlertPreview(ukDemoAlertsPayload());
    $("socialHeatStatus").textContent = "Demo complaint activity loaded.";
    $("socialHeatStatus").dataset.tone = "ok";
    setStatus("Demo scenario active — Heathrow/Gatwick/Manchester under stress.", "ok");
    $("delayUpdated").textContent = "Demo data · not live";
  }

  function exitDemoScenario() {
    demoMode = false;
    document.body.classList.remove("delay-demo-active");
    $("delayDemoBanner")?.setAttribute("hidden", "");
    const demoBtn = $("delayDemo");
    if (demoBtn) demoBtn.textContent = "Run demo scenario";
    refreshAllLive();
  }

  function refreshAllLive() {
    loadDashboard();
    loadAlertPreview();
  }

  async function loadDashboard() {
    if (demoMode) return;
    const status = $("socialHeatStatus");
    if (status) {
      status.textContent = "Loading complaint activity…";
      status.dataset.tone = "info";
    }
    setStatus("Loading live UK airport disruption…");
    try {
      const base = flightApiBase();
      const [delayResponse, socialResponse] = await Promise.all([
        fetch(`${base}/api/uk-delays`),
        fetch(`${base}/api/uk-delays/social-activity`)
      ]);
      const delayPayload = await delayResponse.json();
      if (!delayResponse.ok) throw new Error(delayPayload.error || "Could not load delays.");

      let socialPayload = { airports: [] };
      if (socialResponse.ok) {
        socialPayload = await socialResponse.json();
        renderSocialHeatmaps(socialPayload);
        if (status) {
          status.textContent = socialPayload.note || "Complaint activity refreshed.";
          status.dataset.tone = "ok";
        }
      } else if (status) {
        status.textContent = "Post counts unavailable until the Worker is redeployed.";
        status.dataset.tone = "error";
      }

      const merged = mergeAirportSocial(delayPayload, socialPayload);
      renderBoard(merged);
      renderDelayHeatmaps(merged.airports);
      setStatus("Live disruption board refreshed.", "ok");
    } catch (error) {
      setStatus(`${error.message || "Could not load delays."} Try Run demo scenario.`, "error");
      if (status) {
        status.textContent = error.message || "Complaint activity unavailable.";
        status.dataset.tone = "error";
      }
    }
  }

  function renderAlertPreview(payload) {
    const status = $("alertStatus");
    const list = $("alertPreviewList");
    if (!status || !list) return;

    const channels = payload.channelsConfigured || {};
    const channelBits = [
      channels.email ? "Email" : null,
      channels.slack ? "Slack" : null,
      channels.webhook ? "Webhook" : null
    ].filter(Boolean);

    status.textContent = channelBits.length
      ? `Monitoring active. Notifications: ${channelBits.join(", ")}${channels.kv ? "" : " · KV not bound — trend alerts need ALERT_STATE"}`
      : "No notification channels configured yet — alerts will only show on this page until Resend/Slack secrets are added.";
    status.dataset.tone = channelBits.length ? "ok" : "error";

    const alerts = payload.alerts || [];
    if (!alerts.length) {
      list.innerHTML = `<p class="delay-detail-copy">No early-warning signals right now. Last check ${payload.checkedAt ? new Date(payload.checkedAt).toLocaleString("en-GB") : "—"}.</p>`;
      return;
    }

    list.innerHTML = alerts.map((alert) => `<article class="delay-alert-card delay-alert-${alert.severity}">
      <header>
        <span class="mono">${escapeHtml(alert.severity)}</span>
        <span class="mono">${alert.detectedAt ? escapeHtml(new Date(alert.detectedAt).toLocaleString("en-GB")) : ""}</span>
      </header>
      <h3>${escapeHtml(alert.title)}</h3>
      <p>${escapeHtml(alert.summary)}</p>
    </article>`).join("");
  }

  async function loadAlertPreview() {
    if (demoMode) return;
    try {
      const response = await fetch(`${flightApiBase()}/api/uk-delays/alerts/preview`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Alert preview unavailable.");
      renderAlertPreview(payload);
    } catch (error) {
      const status = $("alertStatus");
      if (status) {
        status.textContent = error.message || "Alert preview unavailable until the Worker is redeployed.";
        status.dataset.tone = "error";
      }
    }
  }

  async function loadDetail(iata, action) {
    const target = $(`detail-${iata}`);
    if (!target) return;
    target.hidden = false;
    const airport = ukAirportByIata(iata);
    if (demoMode) {
      const payload = ukDemoDetail(iata, action);
      target.innerHTML = action === "social"
        ? renderSocialDetail(airport, payload)
        : renderFlightsDetail(airport, payload);
      return;
    }
    target.innerHTML = `<p class="delay-detail-copy">Loading…</p>`;
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

    $("delayRefresh")?.addEventListener("click", () => {
      if (demoMode) exitDemoScenario();
      else refreshAllLive();
    });

    $("delayDemo")?.addEventListener("click", () => {
      if (demoMode) exitDemoScenario();
      else applyDemoScenario();
    });
  }

  function startRefreshTimer() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!demoMode) refreshAllLive();
    }, REFRESH_MS);
  }

  bindBoard();
  refreshAllLive();
  startRefreshTimer();

  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    applyDemoScenario();
  }
})();
