import { assetUrl } from "./api";

/** Dicebear / Stitch stock URLs fail offline and are not the user's photo. */
export function isPlaceholderAvatar(raw?: string | null): boolean {
  if (!raw) return true;
  return (
    raw.startsWith("https://api.dicebear.com") ||
    raw.includes("googleusercontent.com")
  );
}

/** Resolve a stored avatar for <img src>. Empty string = use initials fallback. */
export function resolveUserAvatar(raw?: string | null): string {
  if (!raw || isPlaceholderAvatar(raw)) return "";
  return assetUrl(raw) || raw;
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
