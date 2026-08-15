const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/flight") {
      return Response.json({ error: "Not found." }, { status: 404, headers: corsHeaders });
    }

    const number = String(url.searchParams.get("number") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const date = url.searchParams.get("date") || "";

    if (!number) {
      return Response.json({ error: "Enter a flight number." }, { status: 400, headers: corsHeaders });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Use date format YYYY-MM-DD." }, { status: 400, headers: corsHeaders });
    }
    if (!env.RAPIDAPI_KEY) {
      return Response.json({ error: "Flight lookup is not configured." }, { status: 500, headers: corsHeaders });
    }

    let api = `https://aerodatabox.p.rapidapi.com/flights/number/${number}`;
    if (date) api += `/${date}`;

    const upstream = await fetch(api, {
      headers: {
        "x-rapidapi-host": env.RAPIDAPI_HOST || "aerodatabox.p.rapidapi.com",
        "x-rapidapi-key": env.RAPIDAPI_KEY
      }
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
};
