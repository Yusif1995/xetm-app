// Archive snapshots built from assignment records (pure functions, no emulator needed)
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildArchive } from "../src/lib/archive.ts";
import { juzPages } from "../src/lib/quran.ts";

const names = { a: "Aynur", b: "Bəhram", c: "Cəmilə" };
const nameOf = (uid) => names[uid] || "Keçmiş üzv";

function juz(khatm, j, uid, distribution, { done = true, doneAt = "2026-10-05T12:00:00.000Z", endDate = "2026-10-10", previousHolders } = {}) {
  const pages = juzPages(j);
  return {
    id: `${khatm}-${j}`,
    uid,
    khatm,
    juz: j,
    distribution,
    pages,
    completedPages: done ? pages : pages.slice(0, 3),
    completedAt: {},
    done,
    doneAt: done ? doneAt : null,
    startDate: "2026-10-01",
    endDate,
    createdAt: `2026-10-01T0${distribution}:00:00.000Z`,
    ...(previousHolders ? { previousHolders } : {}),
  };
}

// A whole khatm handed out over two distributions, members a/b/c in turn
function fullKhatm(khatm = 1) {
  return Array.from({ length: 30 }, (_, i) => juz(khatm, i + 1, ["a", "b", "c"][i % 3], i < 15 ? 1 : 2));
}

describe("buildArchive", () => {
  test("a finished khatm becomes one record with all 30 juz, readers and dates", () => {
    const records = buildArchive(fullKhatm(), nameOf);
    const khatm = records.find((r) => r.kind === "khatm");
    assert.ok(khatm);
    assert.equal(khatm.khatm, 1);
    assert.equal(khatm.juz.length, 30);
    assert.deepEqual(khatm.juz.map((j) => j.juz), Array.from({ length: 30 }, (_, i) => i + 1));
    assert.equal(khatm.juz[0].holder, "Aynur");
    assert.equal(khatm.pagesRead, 604);
    assert.equal(khatm.readers.length, 3);
    assert.equal(khatm.readers.reduce((s, r) => s + r.juz, 0), 30);
    assert.equal(khatm.startedAt, "2026-10-01T01:00:00.000Z");
    assert.match(khatm.id, /^khatm-1-/);
  });

  test("finished distributions are archived, ones with an open juz are not", () => {
    const list = fullKhatm();
    list[29] = juz(1, 30, "c", 2, { done: false });
    const records = buildArchive(list, nameOf);
    assert.equal(records.filter((r) => r.kind === "khatm").length, 0, "khatm with an open juz is not finished");
    const dists = records.filter((r) => r.kind === "distribution");
    assert.deepEqual(dists.map((d) => d.distribution), [1]);
    assert.equal(dists[0].juz.length, 15);
    assert.equal(dists[0].endDate, "2026-10-10");
  });

  test("late finishes and handed-over juz are recorded with names", () => {
    const list = fullKhatm();
    list[0] = juz(1, 1, "a", 1, { doneAt: "2026-10-12T08:00:00.000Z", previousHolders: [{ uid: "b", pagesRead: 5 }] });
    const dist = buildArchive(list, nameOf).find((r) => r.kind === "distribution" && r.distribution === 1);
    const first = dist.juz.find((j) => j.juz === 1);
    assert.equal(first.late, true);
    assert.deepEqual(first.handedOverBy, ["Bəhram"]);
    assert.equal(dist.juz.filter((j) => j.late).length, 1);
    // finished last, so it closes the distribution
    assert.equal(dist.completedAt, "2026-10-12T08:00:00.000Z");
    assert.equal(dist.juz[dist.juz.length - 1].juz, 1);
    // Bəhram read 5 pages of juz 1 before handing it over
    const bahram = dist.readers.find((r) => r.uid === "b");
    const bahramOwn = list.filter((a) => a.distribution === 1 && a.uid === "b").reduce((s, a) => s + a.pages.length, 0);
    assert.equal(bahram.pages, bahramOwn + 5);
  });

  test("ids differ after a reset, when numbering starts again from 1", () => {
    const before = buildArchive(fullKhatm(), nameOf);
    const after = buildArchive(fullKhatm().map((a) => ({ ...a, createdAt: a.createdAt.replace("2026-10", "2026-12") })), nameOf);
    const ids = new Set(before.map((r) => r.id));
    assert.ok(after.every((r) => !ids.has(r.id)));
  });

  test("members who left are named as former members", () => {
    const list = fullKhatm().map((a) => (a.uid === "c" ? { ...a, uid: "gone" } : a));
    const khatm = buildArchive(list, nameOf).find((r) => r.kind === "khatm");
    assert.ok(khatm.juz.some((j) => j.holder === "Keçmiş üzv"));
  });

  test("nothing finished, nothing archived", () => {
    assert.deepEqual(buildArchive([juz(1, 1, "a", 1, { done: false })], nameOf), []);
    assert.deepEqual(buildArchive([], nameOf), []);
  });
});
