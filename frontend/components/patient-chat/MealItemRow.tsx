"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FoodItem } from "@/lib/types";
import { swapFoodItem } from "@/lib/meal-plan-display";
import { formatPortionLabel } from "@/lib/meal-plan-mappers";
import { NutrientChips } from "@/components/shared/NutrientChips";
import { toNutrientValues } from "@/lib/nutrient-display";

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const desiredWidth = Math.min(360, Math.max(280, viewportWidth - 32));
      let left = rect.left;
      if (left + desiredWidth > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - desiredWidth - 16);
      }
      const top = rect.bottom + 6;
      setCoords({ top, left, width: desiredWidth });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [anchor]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-label="Lựa chọn thay thế món ăn"
        className="fixed z-50 rounded-2xl border border-teal-200/90 bg-white p-3 shadow-xl ring-1 ring-black/5"
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          maxHeight: "340px",
        }}
      >
        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span className="material-symbols-outlined text-[16px] text-teal-700">
              swap_horiz
            </span>
            <span>Món thay thế gợi ý ({alternatives.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <ul className="space-y-1.5 overflow-y-auto max-h-[260px] pr-1">
          {alternatives.map((alt, idx) => (
            <li key={`${alt.name}-${idx}`}>
              <button
                type="button"
                onClick={() => onSelect(alt)}
                className="group flex w-full flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-left transition-all hover:border-teal-300 hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-800">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]" aria-hidden>
                        restaurant
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold leading-snug text-slate-900 truncate">
                      {cleanPortion(alt.portion) ? `${alt.name} (${cleanPortion(alt.portion)})` : alt.name}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <NutrientChips
                    values={toNutrientValues({
                      kcal: alt.kcal,
                      carbG: alt.macros?.carb_g,
                      proteinG: alt.macros?.protein_g,
                      fatG: alt.macros?.fat_g,
                      sodiumMg: alt.macros?.sodium_mg,
                      sugarG: alt.macros?.sugar_g,
                    })}
                    layer="detail"
                    compact
                  />
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

function cleanPortion(rawPortion?: string): string | null {
  if (!rawPortion) return null;
  const formatted = formatPortionLabel(rawPortion);
  if (!formatted) return null;
  let p = formatted.trim();
  p = p.replace(/^\((.*)\)$/, "$1").trim();
  p = p.replace(/\s*\([~≈]?\s*(\d+\s*[a-zA-Zà-ỹÀ-Ỹ/]+)\)/g, " · $1");
  p = p.replace(/[~≈]/g, "").trim();
  p = p.replace(/^\d+x\s*/i, "");
  return p || null;
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

  const [showNutrients, setShowNutrients] = useState(false);
  const portionText = cleanPortion(current.portion);

  return (
    <div
      ref={wrapRef}
      className="flex flex-col gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap flex-1">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#006857]" />
          <span className="font-bold text-slate-800 truncate" title={current.name}>
            {current.name}
          </span>
          {portionText && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-slate-600 text-[11px] font-medium border border-slate-200/80 shrink-0 shadow-2xs">
              {portionText}
            </span>
          )}
          {current.kcal > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-[#006857] text-[10.5px] font-bold border border-emerald-200/70 shrink-0">
              {current.kcal} kcal
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => setShowNutrients((v) => !v)}
            aria-label={showNutrients ? "Ẩn thành phần dinh dưỡng" : "Xem thành phần dinh dưỡng"}
            title={showNutrients ? "Ẩn thành phần dinh dưỡng" : "Xem thành phần dinh dưỡng"}
            className={`flex h-6 w-6 sm:h-6.5 sm:w-6.5 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              showNutrients
                ? "border-emerald-300 bg-emerald-50 text-[#006857] shadow-2xs"
                : "border-slate-200 bg-white text-slate-500 hover:text-[#006857] hover:border-emerald-200 hover:bg-emerald-50/50"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[17px] sm:text-[18px] transition-transform duration-200 ${
                showNutrients ? "rotate-180 text-[#006857]" : ""
              }`}
            >
              expand_more
            </span>
          </button>

          {alternatives.length > 0 && (
            <button
              ref={btnRef}
              type="button"
              title={`${alternatives.length} lựa chọn thay thế`}
              aria-label={`${alternatives.length} lựa chọn thay thế`}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => setOpen((value) => !value)}
              className={`relative flex h-6 w-6 sm:h-6.5 sm:w-6.5 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                open
                  ? "border-teal-300 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-[#006857] hover:border-teal-300 hover:bg-teal-50"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden>
                swap_horiz
              </span>
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#006857] px-0.5 text-[8.5px] font-extrabold leading-none text-white">
                {alternatives.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {showNutrients && (
        <div className="pt-1 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-1 duration-150">
          <NutrientChips
            values={toNutrientValues({
              kcal: current.kcal,
              carbG: current.macros?.carb_g,
              proteinG: current.macros?.protein_g,
              fatG: current.macros?.fat_g,
              sodiumMg: current.macros?.sodium_mg,
              sugarG: current.macros?.sugar_g,
            })}
            layer="detail"
            compact
            className="w-full"
          />
        </div>
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
