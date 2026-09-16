// Cat Decoded — fetches real videos from the YouTube channel (see config.js)
// and renders them into #featuredVideo, #videoGrid and #videoPagination.
(function () {
  const CONFIG = window.YT_CONFIG || {};
  const CHANNEL_ID = CONFIG.channelId;
  const PER_PAGE = 12;
  const SHORTS_MAX_SECONDS = 180; // YouTube Shorts can run up to 3 minutes
  const FEATURED_SHORTS_COUNT = 3;
  // Requests go through a Cloudflare Worker proxy that holds the real YouTube
  // API key server-side — the key never ships in this file. See worker/README.md.
  const API_BASE = CONFIG.proxyBase;

  const gridEl = document.getElementById("videoGrid");
  const paginationEl = document.getElementById("videoPagination");
  const featuredEl = document.getElementById("featuredShorts");

  let longVideos = [];
  let currentPage = 1;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if (!API_BASE || !CHANNEL_ID) {
      showError("Missing proxy URL or channel ID. Set them in assets/js/config.js.");
      return;
    }

    try {
      const uploadsPlaylistId = await getUploadsPlaylistId();
      const items = await getPlaylistVideos(uploadsPlaylistId);
      const stats = await getVideoStats(items.map((item) => item.videoId));

      const allVideos = items.map((item) => Object.assign({}, item, stats[item.videoId]));

      const shorts = allVideos.filter((v) => v.durationSeconds <= SHORTS_MAX_SECONDS);
      longVideos = allVideos.filter((v) => v.durationSeconds > SHORTS_MAX_SECONDS);

      renderFeaturedShorts(shorts.slice(0, FEATURED_SHORTS_COUNT));
      renderPage(1);
    } catch (err) {
      console.error(err);
      showError("Could not load videos from YouTube right now. Please try again later.");
    }
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error("YouTube API error " + res.status + ": " + (body.error?.message || res.statusText));
    }
    return res.json();
  }

  async function getUploadsPlaylistId() {
    const url = `${API_BASE}/channels?part=contentDetails&id=${CHANNEL_ID}`;
    const data = await fetchJSON(url);
    const channel = data.items && data.items[0];
    if (!channel) throw new Error("Channel not found for id " + CHANNEL_ID);
    return channel.contentDetails.relatedPlaylists.uploads;
  }

  async function getPlaylistVideos(playlistId) {
    let items = [];
    let pageToken = "";

    do {
      const url = `${API_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&pageToken=${pageToken}`;
      const data = await fetchJSON(url);
      items = items.concat(
        data.items
          .filter((it) => it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId)
          .map((it) => ({
            videoId: it.snippet.resourceId.videoId,
            title: it.snippet.title,
            thumbnail:
              (it.snippet.thumbnails.maxres && it.snippet.thumbnails.maxres.url) ||
              (it.snippet.thumbnails.high && it.snippet.thumbnails.high.url) ||
              (it.snippet.thumbnails.medium && it.snippet.thumbnails.medium.url) ||
              it.snippet.thumbnails.default.url,
            publishedAt: it.snippet.publishedAt
          }))
      );
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    return items;
  }

  async function getVideoStats(videoIds) {
    const stats = {};
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const url = `${API_BASE}/videos?part=statistics,contentDetails&id=${chunk.join(",")}`;
      const data = await fetchJSON(url);
      data.items.forEach((v) => {
        const durationSeconds = parseDurationSeconds(v.contentDetails.duration);
        stats[v.id] = {
          viewCount: Number(v.statistics.viewCount || 0),
          durationSeconds,
          duration: formatDuration(durationSeconds)
        };
      });
    }
    return stats;
  }

  function parseDurationSeconds(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
    const h = parseInt(m[1] || "0", 10);
    const min = parseInt(m[2] || "0", 10);
    const s = parseInt(m[3] || "0", 10);
    return h * 3600 + min * 60 + s;
  }

  function formatDuration(totalSeconds) {
    const totalMin = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${totalMin}:${String(s).padStart(2, "0")}`;
  }

  function formatViews(n) {
    if (n >= 1000000) {
      const v = n / 1000000;
      return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "M views";
    }
    if (n >= 1000) {
      const v = n / 1000;
      return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "K views";
    }
    return n + " views";
  }

  function formatAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return "today";
    if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
    if (days < 31) {
      const weeks = Math.floor(days / 7);
      return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return months === 1 ? "1 month ago" : `${months} months ago`;
    }
    const years = Math.floor(days / 365);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }

  function videoUrl(id) {
    return "https://www.youtube.com/watch?v=" + id;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function renderFeaturedShorts(shorts) {
    if (!featuredEl) return;

    if (shorts.length === 0) {
      featuredEl.innerHTML = `<div class="text-center text-muted small py-4">No Shorts found.</div>`;
      return;
    }

    featuredEl.innerHTML = shorts
      .map(
        (v) => `
      <a href="${videoUrl(v.videoId)}" target="_blank" rel="noopener" class="shorts-card">
        <div class="shorts-thumb">
          <img src="${v.thumbnail}" alt="${escapeHtml(v.title)}">
          <span class="play-button"><i class="bi bi-play-fill"></i></span>
          <span class="duration">${v.duration}</span>
        </div>
        <div class="shorts-body">
          <p>${escapeHtml(v.title)}</p>
        </div>
      </a>
    `
      )
      .join("");
  }

  function renderPage(page) {
    if (!gridEl) return;
    currentPage = page;

    const totalPages = Math.max(1, Math.ceil(longVideos.length / PER_PAGE));
    const start = (page - 1) * PER_PAGE;
    const pageItems = longVideos.slice(start, start + PER_PAGE);

    if (pageItems.length === 0) {
      gridEl.innerHTML = `<div class="col-12 text-center py-5 text-muted">No videos found.</div>`;
    } else {
      gridEl.innerHTML = pageItems
        .map(
          (v) => `
        <div class="col-md-6 col-xl-4">
          <article class="video-card">
            <a href="${videoUrl(v.videoId)}" target="_blank" rel="noopener" class="video-thumb">
              <img src="${v.thumbnail}" alt="${escapeHtml(v.title)}">
              <span class="duration">${v.duration}</span>
            </a>
            <div class="video-body">
              <h3><a href="${videoUrl(v.videoId)}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></h3>
              <p>${formatViews(v.viewCount)} <span>•</span> ${formatAgo(v.publishedAt)}</p>
            </div>
          </article>
        </div>
      `
        )
        .join("");
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;

    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
      return;
    }

    const pageLink = (label, page, disabled, active) => `
      <li class="page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}">
        <a class="page-link" href="#" data-page="${page}">${label}</a>
      </li>
    `;

    const links = [pageLink('<i class="bi bi-chevron-left"></i>', currentPage - 1, currentPage === 1, false)];
    for (let p = 1; p <= totalPages; p++) {
      links.push(pageLink(p, p, false, p === currentPage));
    }
    links.push(pageLink('<i class="bi bi-chevron-right"></i>', currentPage + 1, currentPage === totalPages, false));

    paginationEl.innerHTML = `<ul class="pagination justify-content-center gap-1 flex-wrap">${links.join("")}</ul>`;

    paginationEl.querySelectorAll("[data-page]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const page = Number(el.getAttribute("data-page"));
        if (page >= 1 && page <= totalPages && page !== currentPage) {
          renderPage(page);
          gridEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function showError(msg) {
    if (gridEl) {
      gridEl.innerHTML = `<div class="col-12"><div class="alert alert-warning">${escapeHtml(msg)}</div></div>`;
    }
    if (paginationEl) paginationEl.innerHTML = "";
    if (featuredEl) {
      featuredEl.innerHTML = `<div class="alert alert-warning mb-0 small" style="grid-column: 1 / -1;">${escapeHtml(msg)}</div>`;
    }
  }
})();
