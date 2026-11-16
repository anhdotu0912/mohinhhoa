"use client";

import { useEffect, useState } from "react";
import { vietnamTodayIso } from "./meal-plan-calendar";

/** Refresh date-dependent views after midnight and after a suspended tab resumes. */
export function useVietnamToday() {
  const [today, setToday] = useState(() => vietnamTodayIso());
  useEffect(() => {
    const refresh = () => setToday(vietnamTodayIso());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
