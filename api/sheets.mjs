const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request) {
    try {
      const webAppUrl = process.env.XPEN_SHEETS_WEB_APP_URL;
      const token = process.env.XPEN_SYNC_TOKEN;

      if (!webAppUrl || !token) {
        return json(
          {
            ok: false,
            error:
              "Missing XPEN_SHEETS_WEB_APP_URL or XPEN_SYNC_TOKEN on Vercel.",
          },
          500,
        );
      }

      if (request.method === "GET") {
        return proxyGet(webAppUrl, token);
      }

      if (request.method === "POST") {
        return proxyPost(request, webAppUrl, token);
      }

      return json({ ok: false, error: "Method not allowed" }, 405, {
        allow: "GET, POST",
      });
    } catch (error) {
      return json({ ok: false, error: error.message || "Sync failed" }, 500);
    }
  },
};

async function proxyGet(webAppUrl, token) {
  const url = new URL(webAppUrl);
  url.searchParams.set("token", token);

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  return proxyResponse(response);
}

async function proxyPost(request, webAppUrl, token) {
  const body = await request.json().catch(() => ({}));

  const response = await fetch(webAppUrl, {
    method: "POST",
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: JSON.stringify({ ...body, token }),
  });

  return proxyResponse(response);
}

async function proxyResponse(response) {
  const text = await response.text();

  return new Response(text || JSON.stringify({ ok: response.ok }), {
    status: response.status,
    headers: JSON_HEADERS,
  });
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}
