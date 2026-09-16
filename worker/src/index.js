// Cat Decoded — YouTube Data API proxy.
// Keeps the real YouTube API key server-side (Cloudflare Worker secret) so it
// never ships in the public site's JS. The browser calls this Worker instead
// of youtube.googleapis.com directly, and this Worker attaches the key itself.

const ALLOWED_RESOURCES = new Set(["channels", "playlistItems", "videos"]);
const CACHE_SECONDS = 300;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const resource = url.pathname.replace(/^\/api\//, "").replace(/^\/+/, "");

    if (!ALLOWED_RESOURCES.has(resource)) {
      return json({ error: "Unknown resource" }, 404, env);
    }

    const upstream = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [key, value] of url.searchParams) {
      if (key.toLowerCase() !== "key") upstream.searchParams.set(key, value);
    }
    upstream.searchParams.set("key", env.YOUTUBE_API_KEY);

    const upstreamResp = await fetch(upstream.toString());
    const body = await upstreamResp.text();

    return new Response(body, {
      status: upstreamResp.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        ...corsHeaders(env)
      }
    });
  }
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) }
  });
}
