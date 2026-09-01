"use client";

type NotificationBadgeProps = {
  count?: number;
  /** Small red dot (e.g. on avatar) — Facebook-style indicator */
  dot?: boolean;
  className?: string;
};

/** Facebook-style notification indicator — red pill with count or dot. */
export function NotificationBadge({ count = 0, dot = false, className = "" }: NotificationBadgeProps) {
  if (dot) {
    return (
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#e41e3f] ring-2 ring-white ${className}`}
        aria-hidden
      />
    );
  }

  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e41e3f] text-white text-[10px] font-bold leading-[18px] text-center tabular-nums shadow-sm ${className}`}
      aria-label={`${count} thông báo mới`}
    >
      {label}
    </span>
  );
}
