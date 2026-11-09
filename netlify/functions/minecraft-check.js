

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  const respond = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    let username;

    if (event.httpMethod === "GET") {
      username = event.queryStringParameters?.username;
    } else {
      const body = JSON.parse(event.body || "{}");
      username = body.username;
    }

    username = String(username || "").trim();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      return respond(400, { error: "Invalid username" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    let response;

    try {
      response = await fetch(
        "https://api.mojang.com/users/profiles/minecraft/" +
          encodeURIComponent(username),
        {
          headers: { Accept: "application/json" },
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timer);
    }

    const result = {
      username,
      upstreamStatus: response.status,
      status: "unknown",
      available: null
    };

    if (response.status === 200) {
      result.status = "taken";
      result.available = false;
    }

    return respond(200, result);

  } catch (error) {
    return respond(200, {
      status: "unknown",
      available: null,
      diagnostic: error.name === "AbortError"
        ? "timeout"
        : "request_failed"
    });
  }
};
