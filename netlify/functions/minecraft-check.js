
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

  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const username = String(body.username || "").trim();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      return respond(400, {
        available: null,
        error: "Invalid Minecraft Java username"
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    let response;

    try {
      const url =
        "https://mcprofiles.me/api/player/" +
        encodeURIComponent(username) +
        "?type=java";

      response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return respond(200, { available: null });
    }

    const result = await response.json();

    if (
      result.kind === "profile" &&
      result.data?.username?.toLowerCase() === username.toLowerCase()
    ) {
      return respond(200, {
        available: false,
        status: "taken"
      });
    }

    if (result.kind === "notFound") {
      return respond(200, {
        available: true,
        status: "free",
        confidence: "heuristic"
      });
    }

    return respond(200, {
      available: null,
      status: "unknown"
    });

  } catch (error) {
    return respond(200, {
      available: null,
      status: "unknown"
    });
  }
};

