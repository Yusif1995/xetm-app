// Distribution and statistics logic (pure functions, no emulator needed)
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleMembers,
  khatmSummaries,
  memberStats,
  newAssignmentData,
  openKhatmForAssignment,
  pagesReadBy,
  planDistribution,
} from "../src/lib/khatm.ts";

// Deterministic random numbers for repeatable tests
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 0;
function distribute(assignments, members, rng, distribution) {
  const { eligible } = eligibleMembers(members, assignments);
  const plan = planDistribution(eligible, assignments, rng);
  return plan.map((p) => ({ id: `a${nextId++}`, ...newAssignmentData(p, distribution, "2026-10-01", "2026-10-07", `2026-10-0${distribution}T10:00:00Z`) }));
}

function finishAll(assignments, at = "2026-10-05T10:00:00Z") {
  return assignments.map((a) => ({
    ...a,
    completedPages: [...a.pages],
    completedAt: Object.fromEntries(a.pages.map((p) => [String(p), at])),
    done: true,
    doneAt: at,
  }));
}

const members13 = Array.from({ length: 13 }, (_, i) => `u${i + 1}`);

describe("distribution across khatms (13 members example)", () => {
  test("13 + 13 + (4 of khatm 1, 9 of khatm 2), leaving 21 of khatm 2", () => {
    const rng = seeded(42);
    let all = [];

    all = finishAll([...all, ...distribute(all, members13, rng, 1)]);
    assert.equal(all.length, 13);
    assert.deepEqual(openKhatmForAssignment(all), { khatm: 1, free: openKhatmForAssignment(all).free });
    assert.equal(openKhatmForAssignment(all).free.length, 17);

    all = finishAll([...all, ...distribute(all, members13, rng, 2)]);
    assert.equal(openKhatmForAssignment(all).free.length, 4);

    const third = distribute(all, members13, rng, 3);
    assert.equal(third.filter((a) => a.khatm === 1).length, 4);
    assert.equal(third.filter((a) => a.khatm === 2).length, 9);
    all = [...all, ...third];

    const open = openKhatmForAssignment(all);
    assert.equal(open.khatm, 2);
    assert.equal(open.free.length, 21);

    // Every juz of khatm 1 was handed out exactly once
    const k1 = all.filter((a) => a.khatm === 1).map((a) => a.juz).sort((a, b) => a - b);
    assert.deepEqual(k1, Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test("each member gets one juz per distribution and never the same juz twice in a khatm", () => {
    const rng = seeded(7);
    let all = [];
    for (let d = 1; d <= 3; d++) all = finishAll([...all, ...distribute(all, members13, rng, d)]);
    for (const k of [1, 2]) {
      const juz = all.filter((a) => a.khatm === k).map((a) => a.juz);
      assert.equal(new Set(juz).size, juz.length, `duplicate juz in khatm ${k}`);
    }
  });

  test("members prefer juz they have not had before", () => {
    const rng = seeded(3);
    let all = [];
    for (let d = 1; d <= 4; d++) all = finishAll([...all, ...distribute(all, members13, rng, d)]);
    for (const uid of members13) {
      const juz = all.filter((a) => a.uid === uid).map((a) => a.juz);
      assert.equal(new Set(juz).size, juz.length, `${uid} got a repeated juz: ${juz}`);
    }
  });

  test("the order is random (not the same as the member list)", () => {
    const planA = planDistribution(members13, [], seeded(1));
    const planB = planDistribution(members13, [], seeded(2));
    assert.notDeepEqual(planA.map((p) => p.juz), planB.map((p) => p.juz));
  });
});

describe("members who fall behind", () => {
  test("a member with 2 unfinished juz is skipped; others continue the sequence", () => {
    const rng = seeded(11);
    const members = ["a", "b", "c"];
    let all = distribute([], members, rng, 1);
    // a and b finish, c does not
    all = all.map((x) => (x.uid === "c" ? x : finishAll([x])[0]));
    all = [...all, ...distribute(all, members, rng, 2)];
    all = all.map((x) => (x.uid === "c" ? x : finishAll([x])[0]));
    assert.deepEqual(eligibleMembers(members, all), { eligible: ["a", "b"], skipped: ["c"] });

    const third = distribute(all, members, rng, 3);
    assert.deepEqual(third.map((x) => x.uid).sort(), ["a", "b"]);
    // the skipped member's juz are still open and keep their khatm unfinished
    assert.equal(all.filter((x) => x.uid === "c" && !x.done).length, 2);
  });

  test("one unfinished juz does not block the next distribution", () => {
    const all = distribute([], ["a"], seeded(5), 1);
    assert.deepEqual(eligibleMembers(["a"], all).eligible, ["a"]);
  });
});

describe("statistics", () => {
  test("a khatm completes only when all 30 juz are read", () => {
    const rng = seeded(9);
    const members = Array.from({ length: 30 }, (_, i) => `m${i}`);
    let all = distribute([], members, rng, 1);
    assert.equal(khatmSummaries(all)[0].completedAt, null);
    all = finishAll(all.slice(0, 29)).concat(all.slice(29));
    assert.equal(khatmSummaries(all)[0].done, 29);
    assert.equal(khatmSummaries(all)[0].completedAt, null);
    all = finishAll(all);
    assert.ok(khatmSummaries(all)[0].completedAt);
  });

  test("personal khatm: one member finishing every juz 1..30 once", () => {
    const all = finishAll(Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      ...newAssignmentData({ uid: "solo", khatm: 1 + Math.floor(i / 10), juz: i + 1 }, i + 1, "", "", "2026-10-01T00:00:00Z"),
    })));
    const s = memberStats(all, "solo");
    assert.equal(s.personalKhatms, 1);
    assert.equal(s.juzDone.length, 30);
    assert.equal(s.pagesRead, 604);
    assert.equal(s.missingForNextPersonalKhatm.length, 30);
  });

  test("per-khatm share and pages for a member", () => {
    const rng = seeded(21);
    let all = [];
    for (let d = 1; d <= 3; d++) all = finishAll([...all, ...distribute(all, members13, rng, d)]);
    const s = memberStats(all, "u1");
    assert.equal(s.perKhatm.reduce((n, k) => n + k.juz.length, 0), 3);
    assert.equal(s.pagesRead, s.perKhatm.reduce((n, k) => n + k.pagesRead, 0));
  });

  test("transferred juz credits pages to each reader", () => {
    const [a] = distribute([], ["first"], seeded(1), 1);
    const transferred = {
      ...a,
      uid: "second",
      previousHolders: [{ uid: "first", pagesRead: 5 }],
      completedPages: a.pages.slice(0, 12),
    };
    assert.equal(pagesReadBy(transferred, "first"), 5);
    assert.equal(pagesReadBy(transferred, "second"), 7);
  });
});
