"use client";

import React, { useState } from "react";

export interface ThinkingStep {
  node: string;
  message: string;
  status: "pending" | "active" | "done";
}

/** Three pulsing dots — shown while waiting for first streamed token. */
export function ChatTypingDots() {
  return (
    <div
      className="inline-flex items-center gap-2 py-1 text-[#006857] animate-in fade-in duration-200"
      aria-label="Trợ lý đang suy nghĩ"
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-[#006857] animate-pulse"
          style={{ animationDuration: "1s", animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-[#006857] animate-pulse"
          style={{ animationDuration: "1s", animationDelay: "200ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-[#006857] animate-pulse"
          style={{ animationDuration: "1s", animationDelay: "400ms" }}
        />
      </div>
      <span className="text-xs text-slate-500 font-medium italic">
        Đang phân tích dữ liệu lâm sàng &amp; tra cứu y văn...
      </span>
    </div>
  );
}

interface ChatThinkingStepsProps {
  steps: ThinkingStep[];
  intentLabel?: string;
  defaultExpanded?: boolean;
  isStreaming?: boolean;
}

export function ChatThinkingSteps({
  steps,
  intentLabel,
  defaultExpanded = false,
  isStreaming = false,
}: ChatThinkingStepsProps) {
  const isAllDone = steps.every((s) => s.status === "done");
  const [prevStreaming, setPrevStreaming] = useState(isStreaming);
  const [userToggledOpen, setUserToggledOpen] = useState<boolean | null>(null);

  // When streaming state transitions, reset manual toggle override
  if (prevStreaming !== isStreaming) {
    setPrevStreaming(isStreaming);
    setUserToggledOpen(null);
  }

  const isOpen =
    userToggledOpen !== null ? userToggledOpen : Boolean(isStreaming || defaultExpanded);

  if (steps.length === 0) return null;

  const activeStep = steps.find((s) => s.status === "active");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const isGenerating = isStreaming || !isAllDone;

  return (
    <div className="w-full my-0.5 text-slate-700 animate-in fade-in duration-200">
      {/* Header Trigger */}
      <button
        type="button"
        onClick={() => setUserToggledOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium py-1 px-1.5 rounded-md transition-all duration-200 cursor-pointer group select-none ${
          isGenerating
            ? "text-emerald-800 hover:text-emerald-950 bg-emerald-50/60 hover:bg-emerald-100/60"
            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[15px] ${
            isGenerating
              ? "text-[#006857] animate-spin"
              : "text-emerald-700 group-hover:scale-110 transition-transform"
          }`}
        >
          {isGenerating ? "progress_activity" : "psychology"}
        </span>

        <span className="truncate max-w-[280px] sm:max-w-md">
          {isGenerating
            ? activeStep?.message || "Đang phân tích dữ liệu lâm sàng..."
            : intentLabel || `Quá trình suy nghĩ (${doneCount}/${steps.length} bước)`}
        </span>

        <span
          className={`material-symbols-outlined text-[15px] transition-transform duration-200 ${
            isGenerating ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
          } ${isOpen ? "rotate-180" : "rotate-0"}`}
        >
          expand_more
        </span>
      </button>

      {/* Expanded Step List */}
      {isOpen && (
        <div className="pl-2 my-1.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {steps.map((step, idx) => (
            <div
              key={`${step.node}-${step.message}-${idx}`}
              className="flex items-center gap-2 text-xs transition-colors duration-150"
            >
              {step.status === "done" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              ) : step.status === "active" ? (
                <span className="material-symbols-outlined text-[12px] text-[#006857] animate-spin shrink-0">
                  progress_activity
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              )}
              <span
                className={`leading-relaxed ${
                  step.status === "active"
                    ? "text-[#006857] font-semibold"
                    : step.status === "done"
                      ? "text-slate-600 font-normal"
                      : "text-slate-400"
                }`}
              >
                {step.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


