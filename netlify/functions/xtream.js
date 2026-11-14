exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const params = event.queryStringParameters || {};
  const { server, username, password, action } = params;

  const allowedActions = [
    "get_live_categories",
    "get_live_streams",
    "get_vod_categories",
    "get_vod_streams",
    "get_series_categories",
    "get_series"
  ];

  if (!server || !username || !password || !allowedActions.includes(action)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "بيانات غير مكتملة أو إجراء غير مسموح" })
    };
  }

  try {
    const url = new URL(server);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }

    const api = new URL("/player_api.php", url.origin);
    api.search = new URLSearchParams({
      username,
      password,
      action
    });

    const response = await fetch(api, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: data
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "تعذر الاتصال بسيرفر Xtream" })
    };
  }
};
