
"use strict";

const $ = id => document.getElementById(id);

let playlistMode = "xtream";

const tabs = document.querySelectorAll(".tab");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    playlistMode = tab.dataset.mode;

    tabs.forEach(item =>
      item.classList.toggle("active", item === tab)
    );

    $("xtreamFields").hidden = playlistMode !== "xtream";
    $("m3uFields").hidden = playlistMode !== "m3u";
    $("message").textContent = "";
  });
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("message");
  message.textContent = "";

  if (playlistMode === "xtream") {
    const server = $("server").value.trim().replace(/\/+$/, "");
    const username = $("username").value.trim();
    const password = $("password").value.trim();

    if (!server || !username || !password) {
      message.textContent = "أكمل جميع بيانات الدخول.";
      return;
    }

    if (!/^https?:\/\//i.test(server)) {
      message.textContent = "رابط السيرفر لازم يبدأ بـ http:// أو https://";
      return;
    }

    const url = new URL(server);

    const apiUrl = new URL(
      `${url.origin}/player_api.php`
    );

    apiUrl.searchParams.set("username", username);
    apiUrl.searchParams.set("password", password);

    message.textContent = "جاري الاتصال بالسيرفر...";

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();

      if (!data.user_info) {
        throw new Error("بيانات الدخول غير صحيحة.");
      }

      if (data.user_info.auth !== 1 &&
          data.user_info.auth !== "1") {
        throw new Error("السيرفر لم يقبل بيانات الدخول.");
      }

      localStorage.setItem("todo_playlist", JSON.stringify({
        mode: "xtream",
        server,
        username,
        password
      }));

      message.style.color = "#8df5b0";
      message.textContent = "تم الاتصال بنجاح!";

      setTimeout(() => {
        window.location.href = "home.html";
      }, 700);

    } catch (error) {
      message.style.color = "#ffaaaa";
      message.textContent =
        "فشل الاتصال: " + error.message +
        " (قد يكون السبب CORS أو مشكلة بالسيرفر)";
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
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        content = await response.text();
      }

      if (!content.trimStart().startsWith("#EXTM3U")) {
        throw new Error("ملف M3U غير صالح.");
      }

      localStorage.setItem("todo_playlist", JSON.stringify({
        mode: "m3u",
        url: file ? "" : url,
        content
      }));

      message.style.color = "#8df5b0";
      message.textContent = "تم تحميل القائمة بنجاح!";

      setTimeout(() => {
        window.location.href = "home.html";
      }, 700);

    } catch (error) {
      message.style.color = "#ffaaaa";
      message.textContent = "فشل تحميل القائمة: " + error.message;
    }
  }
});
