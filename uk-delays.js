(function () {
  const REFRESH_MS = 5 * 60 * 1000;
  let demoMode = false;
  let refreshTimer = null;
  let viewingHistorical = false;

  function ukTodayInputValue() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  }

  function initDateControls() {
    const dateInput = $("delayDate");
    if (!dateInput) return;
    dateInput.value = ukTodayInputValue();
    dateInput.max = ukTodayInputValue();
  }

  function boardQueryString() {
    const date = $("delayDate")?.value;
    const hour = $("delayHour")?.value || "14";
    if (!date) return "";
    const params = new URLSearchParams({ date, hour });
    return `?${params.toString()}`;
  }

  function updateViewModeLabels(payload) {
    viewingHistorical = Boolean(payload?.historical);
    const date = $("delayDate")?.value || ukTodayInputValue();
    const hour = $("delayHour")?.value || "14";
    const updated = $("delayUpdated");
    if (!updated) return;
    if (demoMode) {
      updated.textContent = "Demo data · not live";
      return;
    }
    if (viewingHistorical) {
      updated.textContent = `Historical view · ${date} at ${hour}:00 UK`;
    } else if (payload?.updatedAt) {
      updated.textContent = `Live · updated ${new Date(payload.updatedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

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
    if (score >= 60) return "High chatter";
    if (score >= 35) return "Rising noise";
    if (score >= 15) return "Some mentions";
    return "Quiet";
  }

  function severityClass(score) {
    if (score >= 60) return "delay-severity-high";
    if (score >= 35) return "delay-severity-mid";
    if (score >= 15) return "delay-severity-low";
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
      title: "UK airport chatter heat map",
      mapId: "delay",
      maxValue: 100,
      getValue: (point) => point.value
    }) + ukHeatLegend("High chatter", "delay");
    delayBars.innerHTML = ukActivityBars(points, (point) => point.value, (value) => `${Math.round(value)} / 100`);
  }

  function renderSocialHeatmaps(payload) {
    const socialMount = $("socialHeatmapMount");
    const socialBars = $("socialHeatBars");
    const status = $("socialHeatStatus");
    if (!socialMount || !socialBars) return;
    const airports = payload?.airports || [];
    const points = heatPointsFromAirports(airports, (airport) => airport.activityScore || 0);
    socialMount.innerHTML = ukHeatmapSvg(points, {
      title: "UK airport chatter ranking map",
      mapId: "social",
      maxValue: 100,
      getValue: (point) => point.value
    }) + ukHeatLegend("High chatter", "social");
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
    const active = airports.filter((airport) => airport.score >= 15 || (airport.delayPosts || 0) > 0);
    const totalPosts = airports.reduce((sum, airport) => sum + (airport.delayPosts || 0), 0);
    const totalIg = airports.reduce((sum, airport) => sum + (airport.instagramLinks?.length || 0), 0);
    $("delaySummary").innerHTML = `
      <div class="delay-stat">
        <p class="mono">Airports tracked</p>
        <p class="delay-stat-value">${airports.length}</p>
      </div>
      <div class="delay-stat">
        <p class="mono">With chatter</p>
        <p class="delay-stat-value">${active.length}</p>
      </div>
      <div class="delay-stat">
        <p class="mono">Public posts</p>
        <p class="delay-stat-value">${totalPosts || "—"}</p>
      </div>
      <div class="delay-stat">
        <p class="mono">IG links found</p>
        <p class="delay-stat-value">${totalIg || "—"}</p>
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
        <div><dt class="mono">Chatter score</dt><dd>${airport.score ? Math.round(airport.score) : "—"}</dd></div>
        <div><dt class="mono">People posting</dt><dd title="${escapeHtml(delayPostsCaption(airport))}">${formatDelayPostsStat(airport)}</dd></div>
        <div><dt class="mono">News mentions</dt><dd>${airport.newsMentions == null ? "—" : airport.newsMentions}</dd></div>
        <div><dt class="mono">IG links</dt><dd>${airport.instagramLinks?.length || 0}</dd></div>
      </dl>
      <p class="delay-post-caption">${escapeHtml(delayPostsCaption(airport))}</p>
      ${socialQuickLinksHtml(airport)}
      <div class="delay-card-actions">
        <button type="button" class="btn delay-load-btn" data-action="detail" data-iata="${escapeHtml(airport.iata)}">Posts, news &amp; IG</button>
        <a class="btn" href="index.html#top">Look up a flight</a>
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
    updateViewModeLabels(payload);
  }

  function renderChatterDetail(airport, payload) {
    const news = (payload.news || []).map((item) => `<li><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></li>`).join("");
    const posts = (payload.posts || []).map((post) => `<article class="delay-post">
      <header><p class="mono">${escapeHtml(post.network)} · ${escapeHtml(post.author)}</p></header>
      <p>${escapeHtml(post.text)}</p>
      ${post.postUrl ? `<p class="delay-post-links"><a href="${escapeHtml(post.postUrl)}" target="_blank" rel="noopener noreferrer">Open post</a></p>` : ""}
    </article>`).join("");
    const igLinks = (payload.instagramLinks || []).map((link) =>
      `<a class="delay-social-chip delay-social-chip-instagram" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span class="mono">IG</span> ${escapeHtml(link.label.slice(0, 48))}</a>`
    ).join("");
    const links = payload.links || ukSocialLinks(airport);
    const igSearch = ukSocialQuickLinks(airport).filter((link) => link.network === "instagram").map((link) =>
      `<a class="delay-social-chip delay-social-chip-instagram" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span class="mono">IG</span> ${escapeHtml(link.label)}</a>`
    ).join("");

    return `
      <p class="mono delay-detail-kicker">Free web signals · ${escapeHtml(airport.name)}</p>
      <p class="delay-detail-copy">${escapeHtml(payload.note || "")}</p>
      <p class="mono delay-detail-kicker">Instagram links found in public sources</p>
      <div class="delay-social-chip-row">${igLinks || "<span class=\"delay-detail-copy\">None in today’s news/social sample — use live IG search below.</span>"}</div>
      <p class="mono delay-detail-kicker">Search Instagram live</p>
      <div class="delay-social-chip-row">${igSearch}</div>
      <p class="mono delay-detail-kicker">News</p>
      <ul class="stock-units">${news || "<li>No news items for this filter.</li>"}</ul>
      <p class="mono delay-detail-kicker">Public posts</p>
      <div class="delay-posts">${posts || "<p class=\"delay-detail-copy\">No matching posts in the sample.</p>"}</div>
      <p class="delay-detail-copy">Need aircraft-level delay for a specific flight? Use the <a href="index.html#top">main calculator</a> (live flight API).</p>`;
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

  function setDemoBanner(title, message) {
    const banner = $("delayDemoBanner");
    if (!banner) return;
    banner.removeAttribute("hidden");
    const titleNode = $("delayDemoBannerTitle");
    const textNode = $("delayDemoBannerText");
    if (titleNode) titleNode.textContent = title;
    if (textNode) textNode.textContent = message;
  }

  function hideDemoBanner() {
    $("delayDemoBanner")?.setAttribute("hidden", "");
  }

  function renderSampleDashboard(apiMissing) {
    const date = $("delayDate")?.value || ukTodayInputValue();
    const hour = $("delayHour")?.value || "14";
    const historical = date !== ukTodayInputValue();
    viewingHistorical = historical;

    const social = ukDemoSocialPayload();
    const merged = mergeAirportSocial(ukDemoDelaysPayload(), social);
    merged.historical = historical;
    merged.viewDate = date;
    merged.updatedAt = new Date().toISOString();

    renderBoard(merged);
    renderDelayHeatmaps(merged.airports);
    renderSocialHeatmaps(social);
    $("socialHeatStatus").textContent = historical
      ? `Sample post counts for ${date} (demo).`
      : "Sample complaint activity (demo).";
    $("socialHeatStatus").dataset.tone = "ok";

    if (historical) {
      renderAlertPreview({
        checkedAt: new Date().toISOString(),
        channelsConfigured: {},
        alerts: []
      });
    } else {
      renderAlertPreview(ukDemoAlertsPayload());
    }

    if (apiMissing) {
      setDemoBanner(
        "Sample data — free board API not live yet",
        `Example chatter for ${date} at ${hour}:00 UK. Redeploy the Cloudflare Worker (GitHub Action: Deploy Cloudflare Worker, needs CLOUDFLARE_API_TOKEN) so /api/uk-board serves live news, social, and IG links. Flight lookup on the calculator is separate and already works.`
      );
      setStatus(`Sample data for ${date} — /api/uk-board not deployed on the Worker yet.`, "error");
    }
    updateViewModeLabels(merged);
  }

  function applyDemoScenario() {
    demoMode = true;
    document.body.classList.add("delay-demo-active");
    const demoBtn = $("delayDemo");
    if (demoBtn) demoBtn.textContent = "Exit demo";

    setDemoBanner(
      "Demo mode",
      "Simulated London/Midlands disruption — sample heat maps, alerts, and outreach panels. No live API data."
    );

    const social = ukDemoSocialPayload();
    const merged = mergeAirportSocial(ukDemoDelaysPayload(), social);
    renderBoard(merged);
    renderDelayHeatmaps(merged.airports);
    renderSocialHeatmaps(social);
    renderAlertPreview(ukDemoAlertsPayload());
    $("socialHeatStatus").textContent = "Demo complaint activity loaded.";
    $("socialHeatStatus").dataset.tone = "ok";
    setStatus("Demo scenario active — Heathrow/Gatwick/Manchester under stress.", "ok");
    updateViewModeLabels({ historical: false });
  }

  function exitDemoScenario() {
    demoMode = false;
    document.body.classList.remove("delay-demo-active");
    hideDemoBanner();
    const demoBtn = $("delayDemo");
    if (demoBtn) demoBtn.textContent = "Run demo scenario";
    refreshAllLive();
  }

  async function refreshAllLive() {
    await loadDashboard();
    await loadAlertPreview();
  }

  async function loadDashboard() {
    if (demoMode) return;
    const status = $("socialHeatStatus");
    if (status) {
      status.textContent = "Loading complaint activity…";
      status.dataset.tone = "info";
    }
    setStatus("Loading free-web chatter…");
    try {
      const base = flightApiBase();
      const query = boardQueryString();
      const boardResponse = await fetch(`${base}/api/uk-board${query}`);
      const boardPayload = await boardResponse.json();
      if (!boardResponse.ok) throw new Error(boardPayload.error || "Could not load chatter board.");

      if (!(boardPayload.airports || []).length) {
        throw new Error("No airport data returned for that date.");
      }

      hideDemoBanner();
      renderBoard(boardPayload);
      renderDelayHeatmaps(boardPayload.airports);
      renderSocialHeatmaps({
        airports: boardPayload.airports.map((airport) => ({
          iata: airport.iata,
          name: airport.name,
          activityScore: airport.score,
          lat: ukAirportByIata(airport.iata)?.lat,
          lon: ukAirportByIata(airport.iata)?.lon
        })),
        note: boardPayload.note
      });
      if (status) {
        status.textContent = boardPayload.note || "Free web chatter refreshed.";
        status.dataset.tone = "ok";
      }
      setStatus(
        boardPayload.historical
          ? `Historical chatter for ${boardPayload.viewDate || $("delayDate")?.value}.`
          : "Chatter board refreshed from free public sources.",
        "ok"
      );
    } catch (error) {
      renderSampleDashboard(true);
      if (status) {
        status.textContent = "Using sample data until the Worker API is redeployed.";
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
    if (demoMode) {
      renderAlertPreview(ukDemoAlertsPayload());
      return;
    }
    if (viewingHistorical) {
      if (viewingHistorical) {
        const status = $("alertStatus");
        const list = $("alertPreviewList");
        if (status) {
          status.textContent = "Early-warning alerts are live-only. Set the date to today to preview notifications.";
          status.dataset.tone = "info";
        }
        if (list) list.innerHTML = "";
      }
      return;
    }
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
      const payload = ukDemoDetail(iata, "social");
      target.innerHTML = renderChatterDetail(airport, {
        ...payload,
        news: [],
        instagramLinks: airport.iata === "LHR"
          ? [{ url: "https://www.instagram.com/explore/tags/lhrdelay/", label: "Demo #lhrdelay" }]
          : [],
        note: "Demo sample posts — redeploy Worker for live news, Mastodon, Reddit, and IG links from public text."
      });
      return;
    }
    target.innerHTML = `<p class="delay-detail-copy">Loading…</p>`;
    try {
      const params = new URLSearchParams({ iata });
      const date = $("delayDate")?.value;
      const hour = $("delayHour")?.value || "14";
      if (date) {
        params.set("date", date);
        params.set("hour", hour);
      }
      const response = await fetch(`${flightApiBase()}/api/uk-board/detail?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      target.innerHTML = renderChatterDetail(airport, payload);
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

    $("delayApplyDate")?.addEventListener("click", () => {
      if (demoMode) exitDemoScenario();
      refreshAllLive();
    });

    $("delayDate")?.addEventListener("change", () => {
      const dateInput = $("delayDate");
      if (dateInput?.value === ukTodayInputValue()) refreshAllLive();
    });
  }

  function startRefreshTimer() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!demoMode && !viewingHistorical && $("delayDate")?.value === ukTodayInputValue()) {
        refreshAllLive();
      }
    }, REFRESH_MS);
  }

  bindBoard();
  initDateControls();
  refreshAllLive();
  startRefreshTimer();

  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    applyDemoScenario();
  }
})();
