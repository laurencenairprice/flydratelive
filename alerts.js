const COOLDOWN_MS = 60 * 60 * 1000;

const DEFAULT_THRESHOLDS = {
  highDelayScore: 2.8,
  worseningDelta: 1.0,
  cancellationBurst: 4,
  systemicAirportCount: 4,
  systemicMinScore: 2.0,
  chatterLeadDelta: 18,
  chatterLeadMaxDelay: 2.4
};

function airportMap(airports) {
  return Object.fromEntries((airports || []).map((airport) => [airport.iata, airport]));
}

function socialMap(airports) {
  return Object.fromEntries((airports || []).map((airport) => [airport.iata, airport]));
}

export function evaluateEarlyWarnings(previous, current, socialPayload, thresholds = DEFAULT_THRESHOLDS) {
  const alerts = [];
  const nowIso = current.updatedAt || new Date().toISOString();
  const prevAirports = airportMap(previous?.airports);
  const currAirports = airportMap(current.airports);
  const socialAirports = socialMap(socialPayload?.airports);
  const prevSocial = socialMap(previous?.social?.airports);

  const stressed = current.airports.filter((airport) => airport.score >= thresholds.systemicMinScore);
  if (stressed.length >= thresholds.systemicAirportCount) {
    alerts.push({
      id: "systemic_stress",
      type: "systemic_stress",
      severity: "critical",
      title: "Multiple UK airports under stress",
      summary: `${stressed.length} airports show elevated delay index (≥ ${thresholds.systemicMinScore}). This may be a network-wide issue developing.`,
      airports: stressed.slice(0, 8).map((airport) => ({
        iata: airport.iata,
        name: airport.name,
        score: airport.score,
        cancelledTotal: airport.cancelledTotal
      })),
      detectedAt: nowIso
    });
  }

  for (const airport of current.airports) {
    const prev = prevAirports[airport.iata];
    const social = socialAirports[airport.iata];
    const prevSocialRow = prevSocial[airport.iata];
    const scoreDelta = prev ? airport.score - prev.score : 0;
    const cancelDelta = prev ? airport.cancelledTotal - prev.cancelledTotal : 0;
    const activity = social?.activityScore || 0;
    const activityDelta = prevSocialRow ? activity - (prevSocialRow.activityScore || 0) : 0;

    if (airport.score >= thresholds.highDelayScore) {
      alerts.push({
        id: `high_delay_${airport.iata}`,
        type: "high_delay",
        severity: airport.score >= 3.5 ? "critical" : "high",
        iata: airport.iata,
        title: `${airport.name} (${airport.iata}) — high disruption`,
        summary: `Delay index ${airport.score.toFixed(1)} with ${airport.cancelledTotal} cancellations in the current window.`,
        metrics: { score: airport.score, cancelledTotal: airport.cancelledTotal, activity },
        detectedAt: nowIso
      });
    }

    if (prev && scoreDelta >= thresholds.worseningDelta) {
      alerts.push({
        id: `worsening_${airport.iata}`,
        type: "rapid_worsening",
        severity: scoreDelta >= 1.5 ? "critical" : "high",
        iata: airport.iata,
        title: `${airport.name} (${airport.iata}) — delays worsening fast`,
        summary: `Delay index jumped ${scoreDelta.toFixed(1)} since the last check (${prev.score.toFixed(1)} → ${airport.score.toFixed(1)}).`,
        metrics: { score: airport.score, previousScore: prev.score, scoreDelta, cancelledTotal: airport.cancelledTotal },
        detectedAt: nowIso
      });
    }

    if (prev && cancelDelta >= thresholds.cancellationBurst) {
      alerts.push({
        id: `cancellations_${airport.iata}`,
        type: "cancellation_burst",
        severity: "high",
        iata: airport.iata,
        title: `${airport.name} (${airport.iata}) — cancellation spike`,
        summary: `${cancelDelta} additional cancellations since the last check.`,
        metrics: { cancelledTotal: airport.cancelledTotal, cancelDelta },
        detectedAt: nowIso
      });
    }

    if (
      activityDelta >= thresholds.chatterLeadDelta
      && airport.score <= thresholds.chatterLeadMaxDelay
    ) {
      alerts.push({
        id: `early_chatter_${airport.iata}`,
        type: "early_chatter",
        severity: "medium",
        iata: airport.iata,
        title: `${airport.name} (${airport.iata}) — traveller chatter rising early`,
        summary: `Public complaint activity up ${activityDelta} points while delay index is still ${airport.score.toFixed(1)}. Worth watching before media picks it up.`,
        metrics: { activity, activityDelta, score: airport.score },
        detectedAt: nowIso
      });
    }
  }

  return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(severity) {
  if (severity === "critical") return 3;
  if (severity === "high") return 2;
  if (severity === "medium") return 1;
  return 0;
}

export function filterCooldown(alerts, previousSentAt = {}) {
  const now = Date.now();
  const fresh = [];
  const nextSentAt = { ...previousSentAt };

  for (const alert of alerts) {
    const key = alert.id;
    const last = previousSentAt[key] ? Date.parse(previousSentAt[key]) : 0;
    if (!last || now - last >= COOLDOWN_MS) {
      fresh.push(alert);
      nextSentAt[key] = new Date(now).toISOString();
    }
  }

  return { alerts: fresh, nextSentAt };
}

export function formatAlertEmail(alerts, boardUrl) {
  const lines = [
    "Flydrate UK early warning",
    "",
    `${alerts.length} signal(s) detected:`,
    ""
  ];

  for (const alert of alerts) {
    lines.push(`[${alert.severity.toUpperCase()}] ${alert.title}`);
    lines.push(alert.summary);
    lines.push("");
  }

  lines.push(`Open delay board: ${boardUrl}`);
  lines.push("");
  lines.push("Automated check — verify on the ground before outreach.");
  return lines.join("\n");
}

export function formatAlertSlackBlocks(alerts, boardUrl) {
  const text = alerts.map((alert) => `*${alert.title}*\n${alert.summary}`).join("\n\n");
  return {
    text: `Flydrate UK early warning (${alerts.length})`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*Flydrate UK early warning*\n${text}` } },
      { type: "section", text: { type: "mrkdwn", text: `<${boardUrl}|Open delay board>` } }
    ]
  };
}

export async function loadAlertState(kv) {
  if (!kv) return null;
  try {
    const raw = await kv.get("state", "json");
    return raw || null;
  } catch {
    return null;
  }
}

export async function saveAlertState(kv, state) {
  if (!kv) return;
  await kv.put("state", JSON.stringify(state));
}

export async function deliverAlerts(env, alerts, boardUrl, dryRun = false) {
  if (!alerts.length) {
    return { delivered: false, channels: [], dryRun };
  }

  const channels = [];
  const subject = `[Flydrate] UK airport early warning (${alerts.length})`;
  const body = formatAlertEmail(alerts, boardUrl);

  if (dryRun) {
    return { delivered: false, dryRun: true, channels: ["dry-run"], subject, body, alerts };
  }

  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    const recipients = String(env.ALERT_EMAIL_TO).split(",").map((email) => email.trim()).filter(Boolean);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.ALERT_EMAIL_FROM || "Flydrate Alerts <alerts@flydrate.com>",
        to: recipients,
        subject,
        text: body
      })
    });
    if (response.ok) channels.push("email");
  }

  if (env.SLACK_WEBHOOK_URL) {
    const response = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatAlertSlackBlocks(alerts, boardUrl))
    });
    if (response.ok) channels.push("slack");
  }

  if (env.ALERT_WEBHOOK_URL) {
    const response = await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "flydrate-uk-delay-alerts",
        subject,
        boardUrl,
        alerts
      })
    });
    if (response.ok) channels.push("webhook");
  }

  return { delivered: channels.length > 0, channels, subject, body, alerts };
}
