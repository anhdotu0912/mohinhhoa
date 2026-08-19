"use client";

export interface ThinkingStep {
  node: string;
  message: string;
  status: "pending" | "active" | "done";
}

/** Three bouncing dots — shown while waiting for first streamed token. */
export function ChatTypingDots() {
  return (
    <div
      className="flex items-center gap-1.5 py-1 px-1 text-primary/80"
      aria-label="Trợ lý đang suy nghĩ"
    >
      <span
        className="w-2 h-2 rounded-full bg-primary/70 animate-bounce"
        style={{ animationDelay: "-0.32s" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-primary/70 animate-bounce"
        style={{ animationDelay: "-0.16s" }}
      />
      <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" />
      <span className="text-xs text-on-surface-variant/70 italic ml-1 font-medium animate-pulse">
        Đang khởi tạo phản hồi...
      </span>
    </div>
  );
}

interface ChatThinkingStepsProps {
  steps: ThinkingStep[];
  intentLabel?: string;
}

export function ChatThinkingSteps({ steps, intentLabel }: ChatThinkingStepsProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 py-1 animate-fadeIn">
      {intentLabel && (
        <p className="text-[11px] text-on-surface-variant font-medium mb-0.5">
          {intentLabel}
        </p>
      )}
      {steps.map((step) => (
        <div
          key={`${step.node}-${step.message}`}
          className="flex items-center gap-2 transition-all duration-300"
        >
          {step.status === "done" ? (
            <span className="material-symbols-outlined text-[14px] text-primary shrink-0 transition-transform duration-200 scale-100">
              check_circle
            </span>
          ) : step.status === "active" ? (
            <span className="relative flex h-3.5 w-3.5 items-center justify-center shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30"></span>
              <span className="material-symbols-outlined text-[14px] text-primary animate-spin shrink-0">
                sync
              </span>
            </span>
          ) : (
            <span className="w-[14px] h-[14px] rounded-full border border-outline-variant shrink-0 opacity-40" />
          )}
          <span
            className={`text-xs leading-snug transition-colors duration-200 ${
              step.status === "active"
                ? "text-primary font-semibold animate-pulse"
                : step.status === "done"
                  ? "text-on-surface-variant"
                  : "text-on-surface-variant/40"
            }`}
          >
            {step.message}
          </span>
        </div>
      ))}
    </div>
  );
}

