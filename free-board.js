const COMPLAINT_PATTERN = /\b(delay(?:ed|s)?|cancel(?:led|lation|ing)?|queue|stuck|stranded|missed\s+connection|divert(?:ed)?)\b/i;

function ukDateFromIso(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeInstagramUrl(url) {
  let clean = String(url || "").replace(/[.,)]+$/, "").split("?")[0];
  clean = clean.replace(/\/+$/, "");
  if (!/instagram\.com/i.test(clean)) return null;
  return clean;
}

function extractInstagramUrls(text) {
  const matches = String(text || "").match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map(normalizeInstagramUrl).filter(Boolean))];
}

function extractInstagramHandles(text) {
  const body = String(text || "");
  if (!/\binstagram\b|instagram\.com/i.test(body)) return [];
  const handles = body.match(/(?:instagram\.com\/|@)([a-z0-9._]{2,30})/gi) || [];
  const urls = [];
  for (const token of handles) {
    const handle = token.replace(/^@/i, "").replace(/^instagram\.com\//i, "").toLowerCase();
    if (["com", "explore", "p", "reel", "reels", "stories"].includes(handle)) continue;
    urls.push(`https://www.instagram.com/${handle}/`);
  }
  return [...new Set(urls)];
}

function mentionsAirport(text, airport) {
  const body = String(text || "").toLowerCase();
  if (!body) return false;
  if (body.includes(airport.iata.toLowerCase())) return true;
  if (body.includes(airport.name.toLowerCase())) return true;
  return false;
}

function scoreChatter(postCount, newsCount, complaintCount, instagramCount) {
  const raw = postCount * 8 + newsCount * 5 + complaintCount * 10 + instagramCount * 12;
  return Math.min(100, Math.round(raw));
}

async function fetchRss(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FlydrateBoard/1.0 (+https://flydrate.com)" }
  });
  if (!response.ok) return "";
  return response.text();
}

function parseRssItems(xml, filterDate) {
  const chunks = xml.split("<item>").slice(1);
  return chunks.map((chunk) => {
    const title = stripHtml((chunk.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || "");
    const link = stripHtml((chunk.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pub = (chunk.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1] || "";
    const description = stripHtml((chunk.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || "");
    const publishedAt = pub ? new Date(pub.trim()).toISOString() : null;
    if (filterDate && publishedAt && ukDateFromIso(publishedAt) !== filterDate) return null;
    return { title, link, description, publishedAt };
  }).filter(Boolean);
}

async function fetchNewsItems(query, filterDate) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
  const xml = await fetchRss(url);
  if (!xml) return [];
  return parseRssItems(xml, filterDate);
}

async function searchMastodon(query, limit = 40) {
  try {
    const response = await fetch(
      `https://mastodon.social/api/v2/search?q=${encodeURIComponent(query)}&limit=${limit}&type=statuses`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.statuses || []).map((status) => ({
      network: "mastodon",
      author: status.account?.display_name || status.account?.username || "Unknown",
      handle: status.account?.acct ? `@${status.account.acct}` : "",
      profileUrl: status.account?.url || null,
      postUrl: status.url || null,
      text: stripHtml(status.content).slice(0, 320),
      createdAt: status.created_at || null
    })).filter((post) => post.text.length > 12);
  } catch {
    return [];
  }
}

async function searchReddit(query, limit = 15) {
  try {
    const response = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "FlydrateBoard/1.0 (contact: roger@flydrate.co.uk)"
        }
      }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.data?.children || []).map((child) => {
      const post = child.data || {};
      return {
        network: "reddit",
        author: post.author || "reddit",
        handle: `r/${post.subreddit || "unknown"}`,
        profileUrl: post.permalink ? `https://www.reddit.com${post.permalink}` : null,
        postUrl: post.url || (post.permalink ? `https://www.reddit.com${post.permalink}` : null),
        text: stripHtml(post.title || "").slice(0, 320),
        createdAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null
      };
    }).filter((post) => post.text.length > 8);
  } catch {
    return [];
  }
}

function instagramFromItems(items) {
  const links = [];
  for (const item of items) {
    const blob = `${item.title || ""} ${item.description || ""} ${item.text || ""} ${item.link || ""} ${item.postUrl || ""}`;
    const urlCandidates = [
      ...extractInstagramUrls(blob),
      ...extractInstagramHandles(blob),
      normalizeInstagramUrl(item.link)
    ].filter(Boolean);
    for (const url of urlCandidates) {
      links.push({
        url,
        label: item.title || item.text?.slice(0, 80) || "Instagram link",
        source: item.network || "news"
      });
    }
  }
  const seen = new Set();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

async function fetchInstagramNewsMentions(airport, filterDate) {
  const queries = [
    `site:instagram.com ${airport.name} airport`,
    `"${airport.name}" delay instagram`
  ];
  const batches = await Promise.all(queries.map((query) => fetchNewsItems(query, filterDate)));
  return batches.flat();
}

export async function buildFreeUkBoard(airports, boardDate) {
  const filterDate = boardDate?.historical ? boardDate.date : null;
  const [newsUk, igNewsUk, mastodonPosts, redditPosts] = await Promise.all([
    fetchNewsItems("UK airport delay OR cancelled flight", filterDate),
    fetchNewsItems("site:instagram.com UK airport delay OR cancelled", filterDate),
    searchMastodon("UK airport delay OR cancelled", 40),
    searchReddit("UK airport delay OR cancelled flight", 20)
  ]);

  const perAirportNews = await Promise.all(
    airports.slice(0, 8).map((airport) =>
      fetchNewsItems(`${airport.name} airport delay OR cancelled`, filterDate)
    )
  );

  const rows = airports.map((airport, index) => {
    const taggedNews = [
      ...newsUk.filter((item) => mentionsAirport(`${item.title} ${item.description}`, airport)),
      ...igNewsUk.filter((item) => mentionsAirport(`${item.title} ${item.description} ${item.link}`, airport) || /instagram\.com/i.test(item.link || "")),
      ...(index < 8 ? perAirportNews[index] : [])
    ];
    const taggedPosts = [...mastodonPosts, ...redditPosts].filter((post) => {
      if (!mentionsAirport(post.text, airport)) return false;
      if (filterDate && post.createdAt && ukDateFromIso(post.createdAt) !== filterDate) return false;
      return true;
    });
    const complaintPosts = taggedPosts.filter((post) => COMPLAINT_PATTERN.test(post.text)).length;
    const instagramLinks = instagramFromItems([...taggedNews, ...taggedPosts]);
    const postCount = taggedPosts.length;
    const newsCount = taggedNews.length;
    const score = scoreChatter(postCount, newsCount, complaintPosts, instagramLinks.length);

    return {
      iata: airport.iata,
      name: airport.name,
      score,
      cancelledTotal: 0,
      departures: { medianDelay: null, cancelled: 0 },
      arrivals: { medianDelay: null, cancelled: 0 },
      delayPosts: postCount,
      complaintPosts,
      newsMentions: newsCount,
      instagramLinks,
      activityScore: score,
      posts: taggedPosts.slice(0, 6),
      news: taggedNews.slice(0, 4)
    };
  }).sort((a, b) => b.score - a.score || b.delayPosts - a.delayPosts);

  return {
    airports: rows,
    viewDate: boardDate?.date || ukDateFromIso(new Date().toISOString()),
    historical: Boolean(boardDate?.historical),
    source: "free-web",
    note: "Free web board: Google News, Mastodon, Reddit, plus Instagram links/handles found in those sources (no Meta API). Flight-level delays: use the main calculator.",
    updatedAt: new Date().toISOString()
  };
}

export async function buildFreeAirportDetail(airport, boardDate) {
  const filterDate = boardDate?.historical ? boardDate.date : null;
  const [news, igNews, mastodonPosts, redditPosts] = await Promise.all([
    fetchNewsItems(`${airport.name} airport delay OR cancelled`, filterDate),
    fetchInstagramNewsMentions(airport, filterDate),
    searchMastodon(`${airport.name} airport delay`, 20),
    searchReddit(`${airport.name} airport delay`, 15)
  ]);
  const allNews = [...news, ...igNews];

  const posts = [...mastodonPosts, ...redditPosts].filter((post) => {
    if (!mentionsAirport(post.text, airport)) return false;
    if (filterDate && post.createdAt && ukDateFromIso(post.createdAt) !== filterDate) return false;
    return true;
  });
  const instagramLinks = instagramFromItems([...allNews, ...posts]);
  const newsCount = allNews.length;
  const metrics = {
    activityScore: scoreChatter(posts.length, newsCount, posts.filter((p) => COMPLAINT_PATTERN.test(p.text)).length, instagramLinks.length),
    postCount: posts.length,
    newsCount
  };

  return {
    airport,
    posts,
    news: allNews,
    instagramLinks,
    links: null,
    newsCount,
    activityScore: metrics.activityScore,
    note: "Instagram posts appear when public news or social posts link to instagram.com. Use the IG search chips for the live hashtag feed in the Instagram app.",
    updatedAt: new Date().toISOString()
  };
}
