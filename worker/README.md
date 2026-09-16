# Cat Decoded — YouTube API proxy (Cloudflare Worker)

Keeps the real YouTube Data API key out of the public site. The browser calls
this Worker; the Worker attaches the key server-side and forwards to YouTube.

## Deploy (one-time)

```bash
cd worker
npx wrangler login          # opens browser, log in / sign up to Cloudflare (free)
npx wrangler secret put YOUTUBE_API_KEY   # paste your real API key when prompted
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL, e.g.:

```
https://cat-decoded-yt-proxy.<your-subdomain>.workers.dev
```

Copy that URL into `../assets/js/config.js`:

```js
proxyBase: "https://cat-decoded-yt-proxy.<your-subdomain>.workers.dev/api"
```

(note the trailing `/api`)

## Notes

- `wrangler.toml`'s `ALLOWED_ORIGIN` restricts which site can call this proxy
  (CORS). Update it if you switch to a custom domain.
- The API key itself is never written to any file in this repo — it's stored
  encrypted by Cloudflare via `wrangler secret put`.
- Free tier is 100,000 requests/day, far more than this site needs.
