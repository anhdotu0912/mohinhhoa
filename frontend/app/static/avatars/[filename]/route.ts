import { proxyBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  return proxyBackend(request, `/static/avatars/${encodeURIComponent(filename)}`);
}

export const HEAD = GET;
