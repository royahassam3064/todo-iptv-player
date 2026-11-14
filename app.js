
"use strict";

const $ = id => document.getElementById(id);

let playlistMode = "xtream";

const tabs = document.querySelectorAll(".tab");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    playlistMode = tab.dataset.mode;

    tabs.forEach(item => {
      item.classList.toggle("active", item === tab);
    });

    $("xtreamFields").hidden = playlistMode !== "xtream";
    $("m3uFields").hidden = playlistMode !== "m3u";
    $("message").textContent = "";
  });
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("message");
  message.textContent = "";
  message.style.color = "";

  if (playlistMode === "xtream") {
    const server = $("server").value.trim().replace(/\/+$/, "");
    const username = $("username").value.trim();
    const password = $("password").value;

    if (!server || !username || !password) {
      message.textContent = "أكمل جميع بيانات الدخول.";
      return;
    }

    let parsedServer;

    try {
      parsedServer = new URL(server);
    } catch {
      message.textContent = "رابط السيرفر غير صالح.";
      return;
    }

    if (
      !["http:", "https:"].includes(parsedServer.protocol) ||
      parsedServer.username ||
      parsedServer.password
    ) {
      message.textContent = "تحقق من رابط السيرفر.";
      return;
    }

    message.textContent = "جاري الاتصال بالسيرفر...";

    try {
      const response = await fetch(
        "/.netlify/functions/xtream",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            server,
            username,
            password,
            action: "get_live_streams"
          })
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("استجابة غير صالحة من الخادم.");
      }

      if (!response.ok) {
        throw new Error(
          data.error || "فشل الاتصال بالسيرفر."
        );
      }

      if (!Array.isArray(data)) {
        throw new Error("بيانات القنوات غير صحيحة.");
      }

      localStorage.setItem(
        "todo_playlist",
        JSON.stringify({
          mode: "xtream",
          server,
          username,
          password
        })
      );

      message.style.color = "#8df5b0";
      message.textContent = "تم الاتصال بنجاح!";

      setTimeout(() => {
        window.location.href = "home.html";
      }, 700);

    } catch (error) {
      message.style.color = "#ffaaaa";
      message.textContent =
        "فشل الاتصال: " + error.message;
    }

  } else {
    const file = $("m3uFile").files[0];
    const url = $("m3uUrl").value.trim();

    if (!file && !url) {
      message.textContent = "أدخل رابط M3U أو اختر ملفاً.";
      return;
    }

    try {
      let content = "";

      if (file) {
        content = await file.text();
      } else {
        const safe = new URL(url);

        if (!["http:", "https:"].includes(safe.protocol)) {
          throw new Error("رابط M3U غير صالح.");
        }

        const response = await fetch(safe.href);

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        content = await response.text();
      }

      if (!content.trimStart().startsWith("#EXTM3U")) {
        throw new Error("ملف M3U غير صالح.");
      }

      localStorage.setItem(
        "todo_playlist",
        JSON.stringify({
          mode: "m3u",
          url: file ? "" : url,
          content
        })
      );

      message.style.color = "#8df5b0";
      message.textContent = "تم تحميل القائمة بنجاح!";

      setTimeout(() => {
        window.location.href = "home.html";
      }, 700);

    } catch (error) {
      message.style.color = "#ffaaaa";
      message.textContent =
        "فشل تحميل القائمة: " + error.message;
    }
  }
});
