import Link from "next/link";

export function BackToHomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors mb-md"
    >
      <span aria-hidden className="text-sm leading-none">
        ←
      </span>
      Quay lại trang chủ
    </Link>
  );
}
