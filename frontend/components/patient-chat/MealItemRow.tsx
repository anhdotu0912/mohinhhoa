"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FoodItem } from "@/lib/types";
import { swapFoodItem } from "@/lib/meal-plan-display";

function safeAlternatives(item: FoodItem): FoodItem[] {
  return (item.alternatives ?? []).filter((alt) => Boolean(alt?.name));
}

function AlternativesPanel({
  id,
  alternatives,
  anchor,
  panelRef,
  onSelect,
  onClose,
}: {
  id: string;
  alternatives: FoodItem[];
  anchor: HTMLElement;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (alt: FoodItem) => void;
  onClose?: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 420, isMobile: false });

  useLayoutEffect(() => {
    const place = () => {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setPos({ top: 0, left: 0, width: 0, isMobile: true });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(460, Math.max(340, window.innerWidth - 32));
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      const below = rect.bottom + 10;
      const estimated = Math.min(alternatives.length * 88 + 72, 420);
      const top =
        below + estimated > window.innerHeight - 16
          ? Math.max(16, rect.top - estimated - 10)
          : below;
      setPos({ top, left, width, isMobile: false });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, alternatives.length]);

  return createPortal(
    <>
      {pos.isMobile && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[75] animate-in fade-in duration-150"
        />
      )}
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label="Lựa chọn thay thế"
        style={
          pos.isMobile
            ? undefined
            : { top: pos.top, left: pos.left, width: pos.width }
        }
        className={
          pos.isMobile
            ? "fixed bottom-3 inset-x-3 max-h-[80vh] z-[80] rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200"
            : "fixed z-[80] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.16)]"
        }
      >
        <div className="flex items-center justify-between px-0.5 pb-2.5 sm:pb-3 border-b border-slate-100 mb-2">
          <p className="text-xs sm:text-sm font-extrabold text-slate-900">
            {alternatives.length} lựa chọn thay thế món
          </p>
          {pos.isMobile && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <ul className="max-h-[60vh] sm:max-h-[22rem] space-y-2 overflow-y-auto custom-scrollbar">
          {alternatives.map((alt, i) => (
            <li key={`${alt.food_id || alt.name}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(alt)}
                className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-3.5 sm:py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/70 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-800">
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]" aria-hidden>
                      restaurant
                    </span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold leading-snug text-slate-900 truncate">
                    {alt.portion ? `${alt.name} (${alt.portion})` : alt.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end text-[11px] sm:text-xs">
                  {alt.kcal > 0 && (
                    <span className="tabular-nums font-extrabold text-emerald-800">
                      {alt.kcal} kcal
                    </span>
                  )}
                  {alt.macros?.protein_g > 0 && (
                    <span className="rounded-md border border-emerald-200/70 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">
                      Đạm: {Math.round(alt.macros.protein_g)}g
                    </span>
                  )}
                  {alt.macros?.carb_g > 0 && (
                    <span className="rounded-md border border-blue-200/70 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-800">
                      Carb: {Math.round(alt.macros.carb_g)}g
                    </span>
                  )}
                  {alt.macros?.fat_g > 0 && (
                    <span className="rounded-md border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">
                      Béo: {Math.round(alt.macros.fat_g)}g
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body
  );
}

export function MealItemRow({
  item,
  onChange,
}: {
  item: FoodItem;
  onChange?: (next: FoodItem) => void;
}) {
  const [current, setCurrent] = useState(item);
  const alternatives = safeAlternatives(current);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrent(item);
  }, [item]);

  const applySwap = (alt: FoodItem) => {
    const next = swapFoodItem(current, alt);
    setCurrent(next);
    onChange?.(next);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const dishLabel = current.portion ? `${current.name} (${current.portion})` : current.name;

  return (
    <div
      ref={wrapRef}
      className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50/80 px-2.5 py-1.5 text-xs"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#006857]" />
        <span className="truncate font-bold text-slate-800" title={dishLabel}>
          {dishLabel}
        </span>
        {alternatives.length > 0 && (
          <button
            ref={btnRef}
            type="button"
            title={`${alternatives.length} lựa chọn thay thế`}
            aria-label={`${alternatives.length} lựa chọn thay thế`}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((value) => !value)}
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              open
                ? "border-teal-300 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-white text-[#006857] hover:border-teal-300 hover:bg-teal-50"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              swap_horiz
            </span>
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#006857] px-1 text-[9px] font-extrabold leading-none text-white">
              {alternatives.length}
            </span>
          </button>
        )}
      </div>

      {current.kcal > 0 && (
        <span className="ml-auto shrink-0 tabular-nums text-[11px] font-bold text-emerald-800">
          {current.kcal} kcal
        </span>
      )}

      {mounted && open && alternatives.length > 0 && btnRef.current && (
        <AlternativesPanel
          id={panelId}
          alternatives={alternatives}
          anchor={btnRef.current}
          panelRef={panelRef}
          onSelect={applySwap}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
