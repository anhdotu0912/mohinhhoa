import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricsOverlayChart } from "../components/patient/MetricsOverlayChart";
import { buildMetricDays, firstRecordedMetric, mergeSavedMetric } from "./metrics-daily";
import { vietnamTodayIso } from "./meal-plan-calendar";
import type { MetricsHistoryPoint } from "./types";

const point = (overrides: Partial<MetricsHistoryPoint> = {}): MetricsHistoryPoint => ({ id: "fixture", user_id: "fixture-patient", recorded_by: "patient", recorded_at: "2026-11-17T01:00:00Z", ...overrides });
const empty = buildMetricDays([], "2026-11-17");
assert.equal(empty.length, 7);
assert.equal(empty[0].key, "2026-11-11");
assert.ok(empty.every((day) => Object.values(day.values).every((value) => value === null)));
const single = buildMetricDays([point({ weight: 72 })], "2026-11-17");
assert.equal(single[6].values.weight, 72);
assert.equal(single.filter((day) => day.values.weight != null).length, 1);
assert.equal(firstRecordedMetric(single), "weight");

// A later partial record must not wipe the other measured values that day.
const partial = buildMetricDays([
  point({ id: "later", recorded_at: "2026-11-17T08:00:00Z", glucose_fasting: 6.3 }),
  point({ id: "early", recorded_at: "2026-11-17T01:00:00Z", weight: 72, systolic: 120 }),
  point({ id: "middle", recorded_at: "2026-11-17T04:00:00Z", weight: 71.8 }),
], "2026-11-17");
assert.equal(partial[6].values.weight, 71.8);
assert.equal(partial[6].values.systolic, 120);
assert.equal(partial[6].values.glucose_fasting, 6.3);
assert.equal(firstRecordedMetric(partial), "glucose_fasting");

const vnDay = buildMetricDays([
  point({ id: "vn-midnight", recorded_at: "2026-11-16T17:05:00", weight: 70 }),
  point({ id: "too-old", recorded_at: "2026-11-10T01:00:00Z", weight: 99 }),
  point({ id: "future", recorded_at: "2026-11-17T17:05:00Z", weight: 98 }),
  point({ id: "bad", recorded_at: "invalid", weight: 97 }),
], "2026-11-17");
assert.equal(vnDay[6].values.weight, 70);
assert.equal(vnDay.filter((day) => day.values.weight != null).length, 1);
const updated = mergeSavedMetric([point({ weight: 72 })], point({ weight: 71.5 }));
assert.equal(updated.length, 1);
assert.equal(updated[0].weight, 71.5);

// The actual chart renders its calendar while empty, one point immediately,
// and a line with two days. The trend minimum must not gate the observations.
const today = vietnamTodayIso();
const yesterday = new Date(today + "T00:00:00Z");
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const emptyHtml = renderToStaticMarkup(createElement(MetricsOverlayChart, { history: [] }));
assert.match(emptyHtml, /aria-label="Biểu đồ chỉ số 7 ngày"/);
assert.doesNotMatch(emptyHtml, /<circle/);
const todayPoint = point({ weight: 72, recorded_at: today + "T01:00:00Z" });
const singleHtml = renderToStaticMarkup(createElement(MetricsOverlayChart, { history: [todayPoint] }));
assert.match(singleHtml, new RegExp(`aria-label="Cân nặng ${today}: 72 kg"`));
assert.equal((singleHtml.match(/<circle/g) ?? []).length, 1);
const twoHtml = renderToStaticMarkup(createElement(MetricsOverlayChart, { history: [todayPoint, point({ id: "yesterday", weight: 72.2, recorded_at: yesterday.toISOString() })] }));
assert.equal((twoHtml.match(/<circle/g) ?? []).length, 2);
assert.match(twoHtml, /d="M [^"]*L /);
console.log("PASS: daily calendar, immediate first point, two-day line, partial measurements, Vietnam dates and saved-record replacement.");
