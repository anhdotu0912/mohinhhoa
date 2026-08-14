/** Normalize Next.js useParams() values (string | string[] | undefined). */
export function asRouteId(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  if (!id || id === "undefined" || id === "null") return "";
  return id;
}
