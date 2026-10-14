// The server's clock, for phones that never call the live callables (fans): while a match is live or
// waiting for its whistle, the app asks this once per session and every 30 min (src/lib/serverTime.ts)
// so every phone reads the same minute. Never cached anywhere: a stored copy would carry an old time.
const NO_STORE = "no-store";

export function GET() {
  return new Response(JSON.stringify({ now: Date.now() }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "cdn-cache-control": NO_STORE,
      "vercel-cdn-cache-control": NO_STORE,
    },
  });
}
