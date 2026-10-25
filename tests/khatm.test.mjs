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
  activeDistributions,
  activeKhatms,
  readerStateInDistribution,
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

  test("juz go out in order: 1..13, then 14..26, then 27..30 and 1..9 of the next khatm", () => {
    const rng = seeded(1);
    const first = distribute([], members13, rng, 1);
    assert.deepEqual(first.map((a) => a.juz).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 1));
    let all = finishAll(first);
    const second = distribute(all, members13, rng, 2);
    assert.deepEqual(second.map((a) => a.juz).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 14));
    all = finishAll([...all, ...second]);
    const third = distribute(all, members13, rng, 3);
    assert.deepEqual(third.filter((a) => a.khatm === 1).map((a) => a.juz).sort((a, b) => a - b), [27, 28, 29, 30]);
    assert.deepEqual(third.filter((a) => a.khatm === 2).map((a) => a.juz).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("a juz handed back (cancelled) is filled first, then the order continues", () => {
    const rng = seeded(4);
    const all = finishAll(distribute([], members13, rng, 1)).filter((a) => a.juz !== 5);
    const next = distribute(all, ["x", "y"], rng, 2);
    assert.deepEqual(next.map((a) => a.juz).sort((a, b) => a - b), [5, 14]);
  });

  test("in the next khatm nobody gets a juz they already read", () => {
    // 30 members finish khatm 1 together, then all of khatm 2 is handed out
    const members30 = Array.from({ length: 30 }, (_, i) => `m${i + 1}`);
    const rng = seeded(8);
    let all = finishAll(distribute([], members30, rng, 1));
    all = [...all, ...distribute(all, members30, rng, 2)];
    for (const uid of members30) {
      const juz = all.filter((a) => a.uid === uid).map((a) => a.juz);
      assert.equal(new Set(juz).size, 2, `${uid} read the same juz twice: ${juz}`);
    }
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

describe("Qrup screen: distributions and khatms in view", () => {
  const members = ["a", "b", "c", "d"];
  const rng = seeded(7);
  // 1st distribution: a and b finish, c reads a page, d nothing
  let all = distribute([], members, rng, 1);
  all = all.map((x) => (x.uid === "a" || x.uid === "b" ? finishAll([x])[0] : x.uid === "c" ? { ...x, completedPages: [x.pages[0]] } : x));
  // 2nd distribution: everyone gets another juz of khatm 1
  const second = distribute(all, members, rng, 2);
  const both = [...all, ...second];

  test("each distribution is judged on its own juz", () => {
    assert.equal(readerStateInDistribution(both, "a", 1), "finished");
    assert.equal(readerStateInDistribution(both, "a", 2), "notStarted");
    assert.equal(readerStateInDistribution(both, "c", 1), "reading");
    assert.equal(readerStateInDistribution(both, "d", 1), "notStarted");
    assert.equal(readerStateInDistribution(both, "a", 3), null);
  });

  test("open distributions are shown newest first; a finished one drops out", () => {
    assert.deepEqual(activeDistributions(both), [2, 1]);
    const firstDone = both.map((x) => (x.distribution === 1 ? finishAll([x])[0] : x));
    assert.deepEqual(activeDistributions(firstDone), [2]);
    assert.deepEqual(activeDistributions(finishAll(both)), []);
  });

  test("at most three distributions are shown", () => {
    // five distributions that each still have an unfinished juz
    const many = [1, 2, 3, 4, 5].map((d) => ({
      id: `m${d}`,
      ...newAssignmentData({ uid: `u${d}`, khatm: 1, juz: d }, d, "2026-10-01", "2026-10-07", "2026-10-01T10:00:00Z"),
    }));
    assert.deepEqual(activeDistributions(many), [5, 4, 3]);
  });

  test("a khatm with all 30 juz finished leaves the 30-juz card", () => {
    const people = Array.from({ length: 30 }, (_, i) => `m${i}`);
    const k1 = finishAll(distribute([], people, rng, 1));
    assert.deepEqual(activeKhatms(k1), [2], "khatm 1 is done, khatm 2 is the one being handed out");
    const partly = distribute(k1, people.slice(0, 5), rng, 2);
    assert.deepEqual(activeKhatms([...k1, ...partly]), [2]);
    assert.deepEqual(activeKhatms([]), []);
  });
});