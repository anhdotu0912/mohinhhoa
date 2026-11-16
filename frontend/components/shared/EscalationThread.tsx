"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EscalationMessageOut, EscalationOut } from "@/lib/types";
import { ESCALATION_REASON_LABEL } from "@/lib/escalation";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";

function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return time;
    return `${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${time}`;
  } catch {
    return iso;
  }
}

function CounterpartAvatar({
  name,
  avatar,
  size = 28,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  const src = resolveUserAvatar(avatar);
  const initials = userInitials(name);
  return (
    <div
      className="relative rounded-full overflow-hidden bg-emerald-50 border border-emerald-200/80 shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        translate="no"
        className="absolute inset-0 flex items-center justify-center font-bold text-[#006857]"
        style={{ fontSize: size < 32 ? 9 : 11 }}
      >
        {initials}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={src}
          className="relative z-10 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

function ContextBrief({ thread }: { thread: EscalationOut }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(thread.question_text || thread.answer_text);

  return (
    <div className="rounded-lg bg-white px-3.5 py-2.5 shadow-[0_8px_20px_rgba(25,28,28,0.05)]">
      <button
        type="button"
        onClick={() => hasBody && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 text-left ${hasBody ? "cursor-pointer" : "cursor-default"}`}
        disabled={!hasBody}
      >
        <span className="material-symbols-outlined text-[16px] text-[#006857] shrink-0">stethoscope</span>
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-slate-800 truncate">
          {ESCALATION_REASON_LABEL[thread.reason]}
        </span>
        {hasBody ? (
          <span
            className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        ) : null}
      </button>
      {open && hasBody ? (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2.5">
          {thread.question_text ? (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Câu hỏi của bạn</p>
              <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                {thread.question_text}
              </p>
            </div>
          ) : null}
          {thread.answer_text ? (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Trả lời của trợ lý AI</p>
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                {thread.answer_text}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isSameRun(a: EscalationMessageOut, b: EscalationMessageOut): boolean {
  return a.sender === b.sender && a.kind === b.kind && a.kind !== "context";
}

export function EscalationThread({
  thread,
  viewer = "patient",
  counterpartName,
  counterpartAvatar,
  composerDisabled,
  sending,
  error,
  onSend,
  compact = false,
}: {
  thread: EscalationOut;
  viewer?: "patient" | "doctor";
  counterpartName?: string | null;
  counterpartAvatar?: string | null;
  composerDisabled?: boolean;
  sending?: boolean;
  error?: string | null;
  onSend: (body: string) => void | Promise<void>;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const composerId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSender = thread.messages.at(-1)?.sender;

  useEffect(() => {
    if (compact) {
      const viewport = viewportRef.current;
      if (viewport && (nearBottomRef.current || lastSender === viewer)) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    } else {
      endRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [thread.messages.length, thread.status, compact, viewer, lastSender]);

  const resolved = thread.status === "resolved";
  const busy = Boolean(sending || submitting);
  const canSend = !resolved && !composerDisabled && !busy;
  const otherLabel =
    counterpartName?.trim() || (viewer === "patient" ? "Bác sĩ phụ trách" : "Bệnh nhân");
  const composerPlaceholder =
    viewer === "patient" ? "Nhắn với bác sĩ…" : "Phản hồi bệnh nhân…";
  const waitingOnDoctor = thread.status === "waiting_doctor";

  const submit = async () => {
    const text = draft.trim();
    if (!text || !canSend || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    const submittedDraft = draft;
    try {
      await onSend(text);
      setDraft((current) => current === submittedDraft ? "" : current);
      if (inputRef.current) inputRef.current.style.height = "auto";
    } catch {
      // The caller displays the request error; retain the draft for retry.
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-[#f8fafc] selection:bg-emerald-100">
      {!compact ? (
        <div className="px-4 pt-3 shrink-0">
          <ContextBrief thread={thread} />
        </div>
      ) : null}

      <div
        ref={viewportRef}
        role="log"
        aria-label="Tin nhắn trao đổi"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-4 py-4"
      >
        {compact && thread.question_text ? (
          <div className="flex justify-end mb-3">
            <div className="max-w-[88%] rounded-xl rounded-tr-sm bg-[#006857] px-3.5 py-2.5 text-[13px] text-white whitespace-pre-wrap break-words">
              <p className="mb-1 text-[10px] font-semibold text-emerald-100">Câu hỏi đã chuyển cho bác sĩ</p>
              {thread.question_text}
            </div>
          </div>
        ) : null}
        {compact && !thread.messages.some((m) => m.sender === "doctor") && !resolved ? (
          <p className="mb-3 text-center text-[11px] leading-relaxed text-slate-500">
            Câu hỏi đã được gửi. Bạn có thể nhắn thêm trong lúc chờ bác sĩ phản hồi.
          </p>
        ) : null}
        {thread.messages.map((msg, i) => {
          const prev = i > 0 ? thread.messages[i - 1] : null;
          const next = i < thread.messages.length - 1 ? thread.messages[i + 1] : null;
          const grouped = Boolean(prev && isSameRun(prev, msg));
          const lastInRun = !next || !isSameRun(msg, next);
          const fromSelf =
            viewer === "doctor" ? msg.sender === "doctor" : msg.sender === "patient";

          if (msg.kind === "context") {
            return (
              <div key={msg.id} className={`${i === 0 ? "" : "mt-4"} flex justify-center`}>
                <p className="text-[11px] font-medium text-slate-500 bg-white rounded-md px-3 py-1 max-w-[92%] text-center leading-relaxed">
                  Đã chuyển thêm câu hỏi từ chat
                </p>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${fromSelf ? "justify-end" : "justify-start"} ${
                grouped ? "mt-1" : i === 0 ? "mt-1" : "mt-4"
              }`}
            >
              <div className={`flex items-end gap-2 max-w-[82%] ${fromSelf ? "flex-row-reverse" : ""}`}>
                {!fromSelf ? (
                  <div className={`shrink-0 ${lastInRun ? "visible" : "invisible"}`}>
                    <CounterpartAvatar name={otherLabel} avatar={counterpartAvatar} />
                  </div>
                ) : null}

                <div className={`flex flex-col ${fromSelf ? "items-end" : "items-start"} min-w-0`}>
                  <div
                    className={`px-3.5 py-2.5 text-[14px] leading-[1.5] whitespace-pre-wrap break-words ${
                      fromSelf
                        ? `bg-[#006857] text-white ${grouped ? "rounded-lg" : "rounded-lg rounded-tr-sm"}`
                        : `bg-white text-slate-800 border border-slate-200/80 ${grouped ? "rounded-lg" : "rounded-lg rounded-tl-sm"}`
                    }`}
                  >
                    <p>{msg.body}</p>
                  </div>
                  {lastInRun ? (
                    <p
                      className={`text-[11px] mt-1 tabular-nums ${
                        fromSelf ? "text-slate-400 pr-0.5" : "text-slate-400 pl-0.5"
                      }`}
                    >
                      {formatClock(msg.created_at)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {resolved ? (
        <div className="shrink-0 px-4 py-3">
          <p className="text-center text-[12px] font-medium text-slate-500 bg-white rounded-md py-2">
            Trao đổi đã kết thúc
          </p>
        </div>
      ) : (
        <form
          className="shrink-0 px-3 pb-3 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error ? (
            <p role="alert" className="text-[12px] text-rose-700 font-medium px-2 pb-2">{error}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 bg-white rounded-lg flex items-end pl-3.5 pr-1.5 py-1.5 shadow-[0_10px_28px_rgba(0,104,87,0.10)] focus-within:ring-4 focus-within:ring-emerald-500/15 transition-shadow">
              <label className="sr-only" htmlFor={composerId}>
                {composerPlaceholder}
              </label>
              <textarea
                id={composerId}
                ref={inputRef}
                value={draft}
                rows={1}
                maxLength={2000}
                disabled={!canSend}
                placeholder={composerPlaceholder}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 96)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className="flex-1 max-h-24 bg-transparent border-none resize-none text-[14px] text-slate-900 placeholder:text-slate-400 py-2 outline-none disabled:opacity-50 leading-relaxed"
              />
              <button
                type="submit"
                disabled={!canSend || !draft.trim()}
                title="Gửi"
                aria-label={viewer === "patient" ? "Gửi tin nhắn cho bác sĩ" : "Gửi phản hồi cho bệnh nhân"}
                className="w-9 h-9 mb-0.5 rounded-md bg-[#006857] hover:bg-[#005445] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              >
                <span className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>
                  {busy ? "progress_activity" : "send"}
                </span>
              </button>
            </div>
          </div>
          {viewer === "patient" ? (
            <p className="text-center text-[10px] text-slate-400 mt-1.5 leading-tight">
              {waitingOnDoctor
                ? "Bác sĩ sẽ trả lời trong cuộc trao đổi này."
                : "Bạn có thể nhắn lại nếu còn thắc mắc."}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
