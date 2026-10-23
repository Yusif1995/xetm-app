import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyPages, dayDiff, monthlyPages, perfAllTime, perfCurrent, personAllTime } from "../src/lib/analytics.ts";

const juz = (over) => ({
  id: Math.random().toString(36).slice(2), uid: "a", khatm: 1, juz: 1, distribution: 1,
  pages: Array.from({ length: 20 }, (_, i) => i + 1), completedPages: [], completedAt: {},
  done: false, doneAt: null, startDate: "2026-10-20", endDate: "2026-10-23", createdAt: "2026-10-20T06:00:00Z", ...over,
});
const readAll = (iso) => ({
  completedPages: Array.from({ length: 20 }, (_, i) => i + 1),
  completedAt: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, iso])),
  done: true, doneAt: iso,
});

test("dayDiff counts calendar days", () => {
  assert.equal(dayDiff("2026-10-20", "2026-10-23"), 3);
  assert.equal(dayDiff("2026-02-28", "2026-03-01"), 1);
});

test("current khatm: finished on time is strong, overdue is weak", () => {
  const list = [
    juz({ uid: "a", ...readAll("2026-10-22T10:00:00Z") }),
    juz({ uid: "b", juz: 2, endDate: "2026-10-22", completedPages: [1, 2] }),
    juz({ uid: "c", juz: 3, completedPages: Array.from({ length: 15 }, (_, i) => i + 1) }),
  ];
  assert.equal(perfCurrent(list, "a", 1, "2026-10-23").cat, "strong");
  assert.equal(perfCurrent(list, "b", 1, "2026-10-23").cat, "weak");
  assert.equal(perfCurrent(list, "c", 1, "2026-10-23").cat, "mid"); // 75% read on the last day
  assert.equal(perfCurrent(list, "x", 1, "2026-10-23").cat, "none");
});

test("all time: late finishes and overdue juz lower the on-time share", () => {
  const list = [
    juz({ uid: "a", ...readAll("2026-10-21T10:00:00Z") }),                 // on time, 2 days
    juz({ uid: "a", juz: 2, khatm: 2, ...readAll("2026-10-26T10:00:00Z") }), // late, 7 days
    juz({ uid: "a", juz: 3, khatm: 2, endDate: "2026-10-22" }),             // overdue
  ];
  const p = personAllTime(list, "a", "2026-10-27");
  assert.equal(p.juz, 2);
  assert.equal(p.overdue, 1);
  assert.equal(Math.round(p.onTime * 100), 33);
  assert.equal(p.avgDays, 4.5);
  assert.equal(perfAllTime(p, 4.5).cat, "mid");  // 0.6 * 1/3 + 0.4 * 1 = 0.6
  assert.equal(perfAllTime(p, 2).cat, "weak");   // slower than the group: 0.2 + 0.4 * 2/4.5 ≈ 0.38
});

test("daily and monthly pages use Baku days", () => {
  const list = [juz({ completedPages: [1, 2], completedAt: { 1: "2026-10-21T21:30:00Z", 2: "2026-10-21T10:00:00Z" } })];
  // 21:30 UTC is already 22 October in Baku
  assert.deepEqual(dailyPages(list, "2026-10-21", "2026-10-22").map((d) => d.pages), [1, 1]);
  assert.deepEqual(monthlyPages(list, "2026-10-23"), [{ month: "2026-10", pages: 2 }]);
});
