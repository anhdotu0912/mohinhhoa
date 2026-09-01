"use client";

import { useState } from "react";

export function PatientRecordId({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard fallback */
    }
  };

  const shortId = id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        title={copied ? "Đã sao chép mã hồ sơ" : `Mã hồ sơ: ${id} (Nhấp để sao chép)`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-low hover:bg-surface-container hover:text-primary text-on-surface-variant font-mono text-[11px] font-medium border border-outline-variant/50 transition-all cursor-pointer select-none group"
      >
        <span className="text-on-surface-variant/70 font-sans text-[10px] font-bold">Mã HS:</span>
        <span className="font-semibold text-on-surface group-hover:text-primary">{shortId}</span>
        <span
          className={`material-symbols-outlined text-[13px] transition-transform ${
            copied ? "text-emerald-600 scale-110 font-bold" : "text-on-surface-variant/60 group-hover:text-primary"
          }`}
        >
          {copied ? "check" : "content_copy"}
        </span>
        {copied && (
          <span className="text-[10px] text-emerald-700 font-sans font-bold ml-0.5">
            Đã chép
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <span
        className="font-mono text-xs text-on-surface break-all leading-snug bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/50"
        title={id}
      >
        {id}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer border border-outline-variant/40"
        aria-label={copied ? "Đã sao chép mã hồ sơ" : "Sao chép mã hồ sơ"}
        title={copied ? "Đã sao chép" : "Sao chép mã hồ sơ"}
      >
        <span className={`material-symbols-outlined text-[15px] ${copied ? "text-emerald-600 font-bold" : ""}`}>
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
}
