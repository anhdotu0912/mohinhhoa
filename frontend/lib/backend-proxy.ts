import "server-only";

/** Forward only application routes; service credentials never reach the browser. */
export async function proxyBackend(request: Request, pathname: string): Promise<Response> {
  const base = process.env.BACKEND_API_URL ||
    (process.env.VERCEL ? "" : "http://localhost:8000");
  if (!base) {
    return Response.json(
      { code: "BACKEND_NOT_CONFIGURED", detail: "Hệ thống chưa kết nối máy chủ. Vui lòng thử lại sau." },
      { status: 503 },
    );
  }
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error("Invalid backend configuration");
    }
    url.pathname = pathname;
    url.search = new URL(request.url).search;
    const headers = new Headers();
    for (const name of ["authorization", "content-type", "accept", "if-none-match", "if-modified-since"]) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const serviceKey = process.env.BACKEND_PROTECTION_BYPASS_SECRET;
    if (serviceKey) headers.set("x-vercel-protection-bypass", serviceKey);
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "etag", "last-modified", "content-disposition", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    return new Response(
      request.method === "HEAD" || [204, 304].includes(upstream.status) ? null : upstream.body,
      { status: upstream.status, headers: responseHeaders },
    );
  } catch {
    return Response.json(
      { code: "BACKEND_UNAVAILABLE", detail: "Chưa kết nối được máy chủ. Vui lòng thử lại sau." },
      { status: 502 },
    );
  }
}
