// Server-side private data helpers, run against the Firestore emulator with the Admin SDK
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
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
    assert.equal(pub.name, "A");
    const priv = (await db.doc("users/u1/private/profile").get()).data();
    assert.equal(priv.email, "a@x.az");
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
