// Server-side private data helpers, run against the Firestore emulator with the Admin SDK
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { recomputeKhatm } from "../src/lib/groupProgress.ts";
import {
  canUseAssistant,
  getGroupInfo,
  getGroupPushTargets,
  getPushSubscriptions,
  isApprovedMember,
  migrateUserPrivateData,
  removePushSubscriptions,
} from "../src/lib/privateData.ts";

const app = initializeApp({ projectId: "demo-xetm" }, "private-data-test");
const db = getFirestore(app);
const G = "g1";

async function clear() {
  const res = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-xetm/databases/(default)/documents`,
    { method: "DELETE" }
  );
  assert.ok(res.ok);
}

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "run via npm run test:rules (needs the emulator)");
});
beforeEach(clear);
after(clear);

describe("migrateUserPrivateData", () => {
  test("moves email and subscriptions into private/profile", async () => {
    await db.doc("users/u1").set({ name: "A", email: "a@x.az", pushSubscriptions: ["s1", "s2"], groupIds: [] });

    assert.equal(await migrateUserPrivateData(db, "u1"), true);

    const pub = (await db.doc("users/u1").get()).data();
    assert.equal(pub.email, undefined);
    assert.equal(pub.pushSubscriptions, undefined);
    assert.equal(pub.name, undefined); // names are private now
    const priv = (await db.doc("users/u1/private/profile").get()).data();
    assert.equal(priv.email, "a@x.az");
    assert.equal(priv.name, "A");
    assert.deepEqual(priv.pushSubscriptions.sort(), ["s1", "s2"]);

    // Second run has nothing to do
    assert.equal(await migrateUserPrivateData(db, "u1"), false);
  });

  test("merges with subscriptions already in the private doc", async () => {
    await db.doc("users/u1").set({ name: "A", pushSubscriptions: ["old"] });
    await db.doc("users/u1/private/profile").set({ pushSubscriptions: ["new"] });
    await migrateUserPrivateData(db, "u1");
    const priv = (await db.doc("users/u1/private/profile").get()).data();
    assert.deepEqual(priv.pushSubscriptions.sort(), ["new", "old"]);
  });
});

describe("full privacy migration", () => {
  test("moves names, messages and profiles; drops adminNotification", async () => {
    await db.doc(`groups/${G}`).set({ name: "Dost", createdBy: "owner", members: { owner: "owner", u1: "member" } });
    await db.doc("users/u1").set({
      nickname: "ali",
      name: "Əli Məmmədov",
      firstName: "Əli",
      lastName: "Məmmədov",
      adminNotification: "köhnə",
      groupIds: [G],
      groupData: { [G]: { assignedPages: [1], completedPages: [], adminMessage: { text: "Salam", sentAt: "2026-10-09T10:00:00Z", read: false } } },
    });

    assert.equal(await migrateUserPrivateData(db, "u1"), true);

    const pub = (await db.doc("users/u1").get()).data();
    for (const k of ["name", "firstName", "lastName", "adminNotification"]) assert.equal(pub[k], undefined, k);
    assert.equal(pub.nickname, "ali");
    assert.equal(pub.groupData[G].adminMessage, undefined);
    assert.deepEqual(pub.groupData[G].assignedPages, [1]);

    const priv = (await db.doc("users/u1/private/profile").get()).data();
    assert.equal(priv.name, "Əli Məmmədov");
    assert.equal(priv.firstName, "Əli");
    assert.equal((await db.doc(`groups/${G}/profiles/u1`).get()).data().name, "Əli Məmmədov");
    assert.equal((await db.doc(`groups/${G}/messages/u1`).get()).data().text, "Salam");
  });

  test("publishes the private name to groups even when nothing is left to move", async () => {
    await db.doc("users/u1").set({ nickname: "ali", groupIds: [G] });
    await db.doc("users/u1/private/profile").set({ name: "Əli M" });
    assert.equal(await migrateUserPrivateData(db, "u1"), false);
    assert.equal((await db.doc(`groups/${G}/profiles/u1`).get()).data().name, "Əli M");
  });
});

describe("khatm counters", () => {
  const pages = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  beforeEach(async () => {
    await db.doc(`groups/${G}`).set({
      name: "Dost", createdBy: "owner", members: { owner: "owner", m1: "member", p1: "pending" },
      completedKhatms: 2, isCurrentKhatmCompleted: false,
    });
  });

  test("counts only approved members' assigned pages", async () => {
    await db.doc("users/owner").set({ groupIds: [G], groupData: { [G]: { assignedPages: pages(1, 10), completedPages: pages(1, 10) } } });
    // pending member's pages and pages outside the assignment do not count
    await db.doc("users/p1").set({ groupIds: [G], groupData: { [G]: { assignedPages: pages(11, 20), completedPages: pages(11, 20) } } });
    await db.doc("users/m1").set({ groupIds: [G], groupData: { [G]: { assignedPages: pages(21, 22), completedPages: [21, 500] } } });

    const r = await recomputeKhatm(db, G);
    assert.equal(r.completedPages, 11);
    assert.equal(r.isCurrentKhatmCompleted, false);
    assert.equal((await db.doc(`groups/${G}`).get()).data().completedKhatms, 2);
  });

  test("a full khatm is counted once, and resets when pages are unmarked", async () => {
    await db.doc("users/owner").set({ groupIds: [G], groupData: { [G]: { assignedPages: pages(1, 302), completedPages: pages(1, 302) } } });
    await db.doc("users/m1").set({ groupIds: [G], groupData: { [G]: { assignedPages: pages(303, 604), completedPages: pages(303, 604) } } });

    assert.equal((await recomputeKhatm(db, G)).completedKhatms, 3);
    assert.equal((await recomputeKhatm(db, G)).completedKhatms, 3); // not counted twice

    await db.doc("users/m1").update({ [`groupData.${G}.completedPages`]: pages(303, 603) });
    const r = await recomputeKhatm(db, G);
    assert.equal(r.isCurrentKhatmCompleted, false);
    assert.equal(r.completedKhatms, 3);
  });
});

describe("assistant access", () => {
  test("group owners and super admins only", async () => {
    await db.doc(`groups/${G}`).set({ name: "Dost", createdBy: "owner", members: { owner: "owner" } });
    await db.doc("admins/boss").set({});
    assert.equal(await canUseAssistant(db, "owner"), true);
    assert.equal(await canUseAssistant(db, "boss"), true);
    assert.equal(await canUseAssistant(db, "someone"), false);
  });
});

describe("push targets", () => {
  beforeEach(async () => {
    await db.doc(`groups/${G}`).set({
      name: "Dost",
      createdBy: "owner",
      members: { owner: "owner", m1: "member", p1: "pending" },
    });
    for (const uid of ["owner", "m1", "p1"]) {
      await db.doc(`users/${uid}`).set({ name: uid, groupIds: [G] });
      await db.doc(`users/${uid}/private/profile`).set({ pushSubscriptions: [`sub-${uid}`] });
    }
    // Not in the group
    await db.doc("users/x").set({ name: "x", groupIds: ["other"] });
    await db.doc("users/x/private/profile").set({ pushSubscriptions: ["sub-x"] });
  });

  test("approved members except the sender; pending and outsiders excluded", async () => {
    const group = await getGroupInfo(db, G);
    assert.equal(isApprovedMember(group, "owner"), true);
    assert.equal(isApprovedMember(group, "p1"), false);

    const targets = await getGroupPushTargets(db, G, group, "m1");
    assert.deepEqual(Object.fromEntries(targets), { owner: ["sub-owner"] });
  });

  test("expired subscriptions are removed", async () => {
    await removePushSubscriptions(db, "m1", ["sub-m1"]);
    assert.deepEqual(await getPushSubscriptions(db, "m1"), []);
  });

  test("missing group is reported as null", async () => {
    assert.equal(await getGroupInfo(db, "nope"), null);
  });
});
