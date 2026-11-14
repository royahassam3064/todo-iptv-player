
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { server, username, password, action } =
      JSON.parse(event.body || "{}");

    const allowedActions = [
      "get_live_streams",
      "get_vod_streams",
      "get_series",
      "get_live_categories",
      "get_vod_categories",
      "get_series_categories"
    ];

    if (!server || !username || !password ||
        !allowedActions.includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "بيانات غير مكتملة" })
      };
    }

    const base = new URL(server);

    if (!["http:", "https:"].includes(base.protocol) ||
        base.username || base.password ||
        base.hostname === "localhost" ||
        base.hostname === "127.0.0.1" ||
        base.hostname === "::1" ||
        base.hostname.endsWith(".local")) {
      throw new Error("Invalid server");
    }

    const api = new URL("/player_api.php", base.origin);

    api.search = new URLSearchParams({
      username,
      password,
      action
    });

    const response = await fetch(api, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "تعذر الاتصال بسيرفر Xtream"
      })
    };
  }
};
