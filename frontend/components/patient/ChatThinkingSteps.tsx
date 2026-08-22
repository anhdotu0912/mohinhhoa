"use client";

import React, { useState } from "react";

export interface ThinkingStep {
  node: string;
  message: string;
  status: "pending" | "active" | "done";
}

/** Three bouncing dots — shown while waiting for first streamed token. */
export function ChatTypingDots() {
  return (
    <div
      className="inline-flex items-center gap-2 py-1 text-[#006857]"
      aria-label="Trợ lý đang suy nghĩ"
    >
      <div className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#006857] animate-bounce"
          style={{ animationDelay: "-0.32s" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#006857] animate-bounce"
          style={{ animationDelay: "-0.16s" }}
        />
        <span className="w-1.5 h-1.5 rounded-full bg-[#006857] animate-bounce" />
      </div>
      <span className="text-xs text-slate-400 font-medium italic">
        Đang suy nghĩ &amp; tra cứu y văn...
      </span>
    </div>
  );
}

interface ChatThinkingStepsProps {
  steps: ThinkingStep[];
  intentLabel?: string;
  defaultExpanded?: boolean;
}

export function ChatThinkingSteps({
  steps,
  intentLabel,
  defaultExpanded = false,
}: ChatThinkingStepsProps) {
  const isAllDone = steps.every((s) => s.status === "done");
  const [isOpen, setIsOpen] = useState(defaultExpanded || !isAllDone);

  if (steps.length === 0) return null;

  const activeStep = steps.find((s) => s.status === "active");

  return (
    <div className="w-full my-0.5 text-slate-700">
      {/* Minimalist Gemini-style Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 py-1 transition-colors cursor-pointer group select-none"
      >
        <span className="material-symbols-outlined text-[16px] text-emerald-600 group-hover:scale-110 transition-transform">
          {isAllDone ? "psychology" : "progress_activity"}
        </span>
        <span className="font-medium">
          {activeStep
            ? activeStep.message
            : intentLabel ||
              `Quá trình suy nghĩ (${steps.filter((s) => s.status === "done").length}/${steps.length} bước)`}
        </span>
        <span
          className={`material-symbols-outlined text-[16px] text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Indented subtle bullet list (Gemini style) */}
      {isOpen && (
        <div className="border-l-2 border-slate-200 pl-3.5 my-1.5 space-y-1.5 animate-in fade-in duration-200">
          {steps.map((step, idx) => (
            <div
              key={`${step.node}-${step.message}-${idx}`}
              className="flex items-center gap-2 text-xs"
            >
              {step.status === "done" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              ) : step.status === "active" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006857] animate-ping shrink-0" />
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


