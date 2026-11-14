
"use strict";

const $ = id => document.getElementById(id);

const saved = localStorage.getItem("todo_playlist");

if (!saved) {
  location.replace("index.html");
}

let config = null;

try {
  config = saved ? JSON.parse(saved) : null;
} catch {
  localStorage.removeItem("todo_playlist");
  location.replace("index.html");
}

let allItems = [];
let currentCategory = "live";
let hls = null;

const grid = $("channelGrid");
const video = $("videoPlayer");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeURL(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let current = null;

  for (const line of lines) {
    const value = line.trim();

    if (value.startsWith("#EXTINF:")) {
      const name = value.split(",").slice(1).join(",").trim();
      const logo = value.match(/tvg-logo=["']([^"']*)["']/i);
      const group = value.match(/group-title=["']([^"']*)["']/i);

      current = {
        name: name || "بدون اسم",
        logo: logo ? logo[1] : "",
        group: group ? group[1] : "",
        url: "",
        type: "live"
      };

    } else if (value && !value.startsWith("#") && current) {
      current.url = safeURL(value);

      if (current.url) {
        items.push(current);
      }

      current = null;
    }
  }

  return items;
}

async function loadM3U() {
  let content = config.content || "";

  if (!content && config.url) {
    const url = safeURL(config.url);

    if (!url) {
      throw new Error("رابط قائمة M3U غير صالح");
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("تعذر تحميل قائمة M3U");
    }

    content = await response.text();
  }

  return parseM3U(content);
}

async function xtreamRequest(action = "") {
  const response = await fetch(
    "/.netlify/functions/xtream",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        server: config.server,
        username: config.username,
        password: config.password,
        action
      })
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("استجابة غير صالحة من الخادم");
  }

if (!response.ok) {
  throw new Error(
    `${data.error || "فشل الاتصال"} | HTTP: ${response.status} | التفاصيل: ${JSON.stringify(data)}`
  );
}

  if (!Array.isArray(data)) {
    throw new Error("بيانات القائمة غير صحيحة");
  }

  return data;
}

async function loadXtream() {
  const [live, movies, series] = await Promise.all([
    xtreamRequest("get_live_streams"),
    xtreamRequest("get_vod_streams"),
    xtreamRequest("get_series")
  ]);

  const server = config.server.replace(/\/+$/, "");
  const username = encodeURIComponent(config.username);
  const password = encodeURIComponent(config.password);

  return [
    ...live.map(item => ({
      id: item.stream_id,
      name: item.name || "قناة بدون اسم",
      logo: item.stream_icon || "",
      url: `${server}/live/${username}/${password}/${item.stream_id}.m3u8`,
      type: "live"
    })),

    ...movies.map(item => ({
      id: item.stream_id,
      name: item.name || "فيلم بدون اسم",
      logo: item.stream_icon || "",
      url: `${server}/movie/${username}/${password}/${item.stream_id}.${item.container_extension || "mp4"}`,
      type: "movies"
    })),

    ...series.map(item => ({
      id: item.series_id,
      name: item.name || "مسلسل بدون اسم",
      logo: item.cover || "",
      type: "series"
    }))
  ];
}

function renderItems() {
  const search = $("searchInput").value.trim().toLowerCase();

  const filtered = allItems.filter(item =>
    item.type === currentCategory &&
    String(item.name).toLowerCase().includes(search)
  );

  grid.innerHTML = "";

  if (!filtered.length) {
    grid.innerHTML =
      '<p class="loading">لا يوجد محتوى في هذا القسم.</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("button");

    card.className = "channel-card";
    card.type = "button";

    const logo = safeURL(item.logo);

    card.innerHTML = `
      <img src="${escapeHTML(logo)}" alt=""
        onerror="this.style.visibility='hidden'">
      <h3>${escapeHTML(item.name)}</h3>
    `;

    card.addEventListener("click", () => {
      if (item.type === "series") {
        $("playerSection").hidden = false;
        $("playerTitle").textContent = item.name;
        $("playerMessage").textContent =
          "تحميل المواسم والحلقات غير متوفر حالياً.";
        return;
      }

      playItem(item);
    });

    grid.appendChild(card);
  });
}

function playItem(item) {
  const url = safeURL(item.url);

  if (!url) {
    $("playerMessage").textContent =
      "رابط البث غير صالح.";
    return;
  }

  $("playerSection").hidden = false;
  $("playerTitle").textContent = item.name;
  $("playerMessage").textContent = "";

  if (hls) {
    hls.destroy();
    hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();

  if (
    url.includes(".m3u8") &&
    window.Hls &&
    Hls.isSupported()
  ) {
    hls = new Hls();

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        $("playerMessage").textContent =
          "تعذر تشغيل البث. تحقق من الرابط أو توافق السيرفر.";
      }
    });

  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;

  } else {
    video.src = url;
  }

  video.play().catch(() => {
    $("playerMessage").textContent =
      "اضغط زر التشغيل لبدء المشاهدة.";
  });
}

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    currentCategory = button.dataset.category;

    document.querySelectorAll(".category").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    renderItems();
  });
});

$("searchInput").addEventListener("input", renderItems);

$("closePlayer").addEventListener("click", () => {
  video.pause();
  video.removeAttribute("src");
  video.load();

  if (hls) {
    hls.destroy();
    hls = null;
  }

  $("playerSection").hidden = true;
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("todo_playlist");
  location.replace("index.html");
});

async function init() {
  try {
    $("playlistInfo").textContent =
      config.mode === "xtream"
        ? "Xtream Codes"
        : "M3U Playlist";

    allItems = config.mode === "xtream"
      ? await loadXtream()
      : await loadM3U();

    renderItems();

    $("playlistInfo").textContent =
      `تم تحميل ${allItems.length} عنصر`;

  } catch (error) {
    grid.innerHTML = "";

    $("playlistInfo").textContent =
      "حدث خطأ أثناء تحميل القائمة.";

    const errorMessage = document.createElement("p");

    errorMessage.className = "loading";
    errorMessage.textContent = error.message;

    grid.appendChild(errorMessage);
  }
}

if (config) {
  init();
}
