// Cat Decoded — YouTube API config
// No API key here on purpose: the real key lives server-side as a Cloudflare
// Worker secret (see worker/README.md). This file only needs the public
// channel ID and the deployed Worker's URL.
window.YT_CONFIG = {
  channelId: "UC74GscftCHNm-wkG90PJ_XQ", // @CatFormula — "Cat Decoded"
  proxyBase: "https://cat-decoded-yt-proxy.catdecoded.workers.dev/api"
};
