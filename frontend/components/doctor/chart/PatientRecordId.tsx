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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be blocked; the full id remains visible */
    }
  };

  return (
    <span className="inline-flex items-start gap-1 min-w-0 max-w-full">
      <span
        className={`font-mono text-on-surface break-all leading-snug ${
          compact ? "text-[11px]" : "text-xs"
        }`}
        title={id}
      >
        {id}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 -mt-0.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer"
        aria-label={copied ? "Đã sao chép mã hồ sơ" : "Sao chép mã hồ sơ"}
        title={copied ? "Đã sao chép" : "Sao chép mã hồ sơ"}
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </span>
  );
}
