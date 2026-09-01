"use client";

import { useEffect, type ReactNode } from "react";
import type { GuidelineSourceOut } from "@/lib/types";

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-on-surface">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function GuidelineBody({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="space-y-1.5 pl-0 my-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-on-surface leading-relaxed">
            <span className="text-primary mt-0.5 shrink-0" aria-hidden>
              •
            </span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h5 key={`h5-${key++}`} className="text-sm font-bold text-on-surface mt-4 mb-1">
          {trimmed.slice(4)}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h4 key={`h4-${key++}`} className="text-base font-bold text-on-surface mt-5 mb-1.5">
          {trimmed.slice(3)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      continue;
    }
    blocks.push(
      <p key={`p-${key++}`} className="text-sm text-on-surface leading-relaxed my-2">
        {renderInline(trimmed)}
      </p>
    );
  }
  flushList();

  return <div className="max-w-[72ch]">{blocks}</div>;
}

export function GuidelineReader({
  sourceId,
  loading,
  error,
  data,
  onClose,
}: {
  sourceId: string;
  loading: boolean;
  error: string | null;
  data: GuidelineSourceOut | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guideline-reader-title"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-t-xl sm:rounded-xl w-full max-w-2xl max-h-[88vh] shadow-lg flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-outline-variant/60">
          <div className="min-w-0">
            <h4
              id="guideline-reader-title"
              className="font-h2 text-h2 font-bold text-on-surface text-base leading-snug"
            >
              {data?.title || sourceId}
            </h4>
            <p className="text-[11px] text-on-surface-variant mt-1 break-all">{sourceId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface cursor-pointer"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Đang tải nội dung…</p>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : data ? (
            data.kind === "catalog" ? (
              <p className="text-sm text-on-surface leading-relaxed">{data.body}</p>
            ) : (
              <GuidelineBody body={data.body} />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
