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
      className="flex items-center gap-1.5 py-1"
      aria-label="Trợ lý đang suy nghĩ"
    >
      <span
        className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
        style={{ animationDelay: "-0.3s" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
        style={{ animationDelay: "-0.15s" }}
      />
      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" />
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
    <div className="flex flex-col gap-1.5 py-1">
      {intentLabel && (
        <p className="text-[11px] text-on-surface-variant font-medium mb-0.5">
          {intentLabel}
        </p>
      )}
      {steps.map((step) => (
        <div key={`${step.node}-${step.message}`} className="flex items-center gap-2">
          {step.status === "done" ? (
            <span className="material-symbols-outlined text-[14px] text-primary shrink-0">
              check_circle
            </span>
          ) : step.status === "active" ? (
            <span className="material-symbols-outlined text-[14px] text-primary animate-spin shrink-0">
              sync
            </span>
          ) : (
            <span className="w-[14px] h-[14px] rounded-full border border-outline-variant shrink-0" />
          )}
          <span
            className={`text-xs leading-snug ${
              step.status === "active"
                ? "text-on-surface font-medium"
                : step.status === "done"
                  ? "text-on-surface-variant"
                  : "text-on-surface-variant/50"
            }`}
          >
            {step.message}
          </span>
        </div>
      ))}
    </div>
  );
}
