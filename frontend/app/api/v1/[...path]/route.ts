import { proxyBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((part) => part === "." || part === ".." || part.includes("/"))) {
    return Response.json({ code: "INVALID_PATH", detail: "Đường dẫn không hợp lệ." }, { status: 400 });
  }
  return proxyBackend(request, `/api/v1/${path.map(encodeURIComponent).join("/")}`);
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as HEAD, forward as OPTIONS };
