
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
        status: "unknown",
        error: "Invalid Minecraft Java username"
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    let response;

    try {
      response = await fetch(
        "https://api.mojang.com/users/profiles/minecraft/" +
          encodeURIComponent(username),
        {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 200) {
      return respond(200, {
        available: false,
        status: "taken"
      });
    }

    // Brak profilu nie jest wystarczającym
    // potwierdzeniem dostępności nazwy.
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

