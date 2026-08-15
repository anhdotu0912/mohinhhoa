"use client";

import { useMemo } from "react";

/** Cắt mảng theo trang — dùng chung cho các bảng có phân trang. */
export function getPageItems<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

function buildPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * Thanh phân trang: "Hiển thị x–y trên z" + nút prev/next và số trang.
 * Không render gì khi danh sách không vượt quá một trang (totalItems <= pageSize).
 */
export default function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const pages = useMemo(() => buildPages(page, totalPages), [page, totalPages]);

  if (totalItems <= pageSize) return null;

  const btnClass =
    "h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:text-primary flex items-center justify-center";
  const activeClass =
    "h-8 min-w-8 px-2 rounded-lg text-xs font-semibold bg-primary text-on-primary cursor-default flex items-center justify-center";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-sm px-md py-sm border-t border-outline-variant/60">
      <p className="text-xs text-on-surface-variant">
        Hiển thị {from}–{to} trên {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={btnClass}
          aria-label="Trang trước"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-on-surface-variant">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={p === page ? activeClass : btnClass}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={btnClass}
          aria-label="Trang sau"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
