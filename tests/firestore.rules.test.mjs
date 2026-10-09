import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  getDocs,
  query,
  where,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

let env;

const OWNER = "owner";
const MEMBER = "member";
const STRANGER = "stranger";
const SUPER = "super";
const G = "group1";
const OTHER_G = "group2";

function userDoc(groupIds, extra = {}) {
  const groupData = {};
  for (const g of groupIds) {
    groupData[g] = { approved: false, assignedPages: [], completedPages: [], completedAt: {}, totalCompletedPages: 0 };
  }
  return { name: "x", role: "user", groupId: groupIds[0] || "", groupIds, groupData, isOnboarded: true, ...extra };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-xetm",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "admins", SUPER), {});
    await setDoc(doc(db, "groups", G), {
      name: "G", createdBy: OWNER, members: { [OWNER]: "owner", [MEMBER]: "member" }, completedKhatms: 0,
    });
    await setDoc(doc(db, "groups", OTHER_G), {
      name: "Other", createdBy: STRANGER, members: { [STRANGER]: "owner" }, completedKhatms: 0,
    });
    await setDoc(doc(db, "users", OWNER), userDoc([G]));
    await setDoc(doc(db, "users", MEMBER), userDoc([G, OTHER_G]));
    await setDoc(doc(db, "users", STRANGER), userDoc([OTHER_G]));
    await setDoc(doc(db, "settings", "config"), { currentAyah: "a" });
  });
});

const dbAs = (uid) => env.authenticatedContext(uid).firestore();

describe("privilege escalation", () => {
  test("user cannot make themselves admin", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { role: "admin" }));
  });

  test("user cannot set the legacy approved flag", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { approved: true }));
  });

  test("new user doc cannot start as admin", async () => {
    await assertFails(setDoc(doc(dbAs("newbie"), "users", "newbie"), userDoc([], { role: "admin" })));
    await assertSucceeds(setDoc(doc(dbAs("newbie"), "users", "newbie"), userDoc([], { approved: false })));
  });

  test("nobody can create an admins doc from the app", async () => {
    await assertFails(setDoc(doc(dbAs(MEMBER), "admins", MEMBER), {}));
  });

  test("an old role:'admin' field grants nothing", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users", STRANGER), { role: "admin" })
    );
    await assertFails(updateDoc(doc(dbAs(STRANGER), "users", OWNER), { name: "hacked" }));
    await assertFails(updateDoc(doc(dbAs(STRANGER), "settings", "config"), { currentAyah: "x" }));
  });
});

describe("users", () => {
  test("user can mark own pages", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.completedPages`]: arrayUnion(1, 2),
      [`groupData.${G}.completedAt.1`]: "2026-01-01",
    }));
  });

  test("user cannot edit someone else", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", OWNER), { name: "x" }));
    await assertFails(deleteDoc(doc(dbAs(MEMBER), "users", OWNER)));
  });

  test("group owner can assign pages inside their group", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      [`groupData.${G}.assignedPages`]: [1, 2, 3],
      lastEditedGroup: G,
    }));
  });

  test("group owner cannot touch another group's data", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      [`groupData.${OTHER_G}.assignedPages`]: [1],
      lastEditedGroup: G,
    }));
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      [`groupData.${OTHER_G}.assignedPages`]: [1],
      lastEditedGroup: OTHER_G,
    }));
  });

  test("group owner cannot change other fields", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), { name: "hacked", lastEditedGroup: G }));
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), { role: "admin", lastEditedGroup: G }));
  });

  test("group owner can remove a member from their group only", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      groupIds: arrayRemove(G),
      [`groupData.${G}`]: deleteField(),
      lastEditedGroup: G,
    }));
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      groupIds: arrayRemove(OTHER_G),
      lastEditedGroup: G,
    }));
  });

  test("group owner cannot write to users outside their group", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", STRANGER), {
      adminNotification: "hi",
      lastEditedGroup: G,
    }));
    await assertSucceeds(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      adminNotification: "hi",
      lastEditedGroup: G,
    }));
  });

  test("super admin can edit any user", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(SUPER), "users", MEMBER), { name: "fixed" }));
  });
});

describe("groups", () => {
  test("anyone can create a group they own", async () => {
    await assertSucceeds(setDoc(doc(dbAs(MEMBER), "groups", "new"), {
      name: "n", createdBy: MEMBER, members: { [MEMBER]: "owner" },
    }));
  });

  test("cannot create a group owned by someone else or with extra members", async () => {
    await assertFails(setDoc(doc(dbAs(MEMBER), "groups", "new"), {
      name: "n", createdBy: OWNER, members: { [OWNER]: "owner" },
    }));
    await assertFails(setDoc(doc(dbAs(MEMBER), "groups", "new"), {
      name: "n", createdBy: MEMBER, members: { [MEMBER]: "owner", [STRANGER]: "member" },
    }));
  });

  test("non-owner cannot rename or take over a group", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { name: "x" }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { createdBy: MEMBER }));
    await assertFails(deleteDoc(doc(dbAs(MEMBER), "groups", G)));
  });

  test("owner cannot hand the group to someone else", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "groups", G), { createdBy: MEMBER }));
  });

  test("user can request to join only as pending", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(STRANGER), "groups", G), { [`members.${STRANGER}`]: "pending" }));
    await assertFails(updateDoc(doc(dbAs(STRANGER), "groups", G), { [`members.${STRANGER}`]: "member" }));
  });

  test("user cannot approve or remove others", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "groups", G), { [`members.${STRANGER}`]: "pending" })
    );
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { [`members.${STRANGER}`]: "member" }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { [`members.${STRANGER}`]: deleteField() }));
  });

  test("member can leave", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "groups", G), { [`members.${MEMBER}`]: deleteField() }));
  });

  test("owner can approve members", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(OWNER), "groups", G), { [`members.${STRANGER}`]: "member" }));
  });

  test("approved member can bump the khatm counter by one", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "groups", G), { completedKhatms: 1, isCurrentKhatmCompleted: true }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { completedKhatms: 5 }));
  });

  test("pending user cannot touch the khatm counter", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "groups", G), { [`members.${STRANGER}`]: "pending" })
    );
    await assertFails(updateDoc(doc(dbAs(STRANGER), "groups", G), { completedKhatms: 1 }));
  });

  test("owner can delete group and clean up members in one batch", async () => {
    const db = dbAs(OWNER);
    const batch = writeBatch(db);
    batch.update(doc(db, "users", MEMBER), {
      groupIds: [OTHER_G],
      [`groupData.${G}`]: deleteField(),
      groupId: OTHER_G,
      lastEditedGroup: G,
    });
    batch.update(doc(db, "users", OWNER), {
      groupIds: [],
      [`groupData.${G}`]: deleteField(),
      groupId: "",
      isOnboarded: false,
      lastEditedGroup: G,
    });
    batch.delete(doc(db, "groups", G));
    await assertSucceeds(batch.commit());
  });
});

describe("memberships", () => {
  test("member can leave a group in one batch", async () => {
    const db = dbAs(MEMBER);
    const batch = writeBatch(db);
    batch.update(doc(db, "users", MEMBER), {
      groupIds: [OTHER_G],
      [`groupData.${G}`]: deleteField(),
      groupId: OTHER_G,
    });
    batch.update(doc(db, "groups", G), { [`members.${MEMBER}`]: deleteField() });
    await assertSucceeds(batch.commit());
  });

  test("user can re-link a group to their own (recreated) doc", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users", MEMBER), userDoc([], { isOnboarded: false }))
    );
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      groupIds: arrayUnion(G),
      [`groupData.${G}`]: { approved: false, assignedPages: [], completedPages: [] },
      groupId: G,
    }));
  });

  test("user can list the groups they belong to", async () => {
    const q = query(collection(dbAs(MEMBER), "groups"), where(`members.${MEMBER}`, "in", ["owner", "member", "pending"]));
    const snap = await assertSucceeds(getDocs(q));
    if (snap.size !== 1 || snap.docs[0].id !== G) throw new Error("expected only group1, got " + snap.size);
  });
});

describe("member messages", () => {
  const message = { text: "Salam", sentAt: "2026-10-09T10:00:00.000Z", read: false };

  test("group owner can message a member of their group", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      [`groupData.${G}.adminMessage`]: message,
      lastEditedGroup: G,
    }));
  });

  test("group owner cannot message into another group's slot", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      [`groupData.${OTHER_G}.adminMessage`]: message,
      lastEditedGroup: G,
    }));
  });

  test("member can mark the message read, others cannot write it", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users", MEMBER), { [`groupData.${G}.adminMessage`]: message })
    );
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { [`groupData.${G}.adminMessage.read`]: true }));
    await assertFails(updateDoc(doc(dbAs(STRANGER), "users", MEMBER), { [`groupData.${G}.adminMessage.read`]: false }));
  });
});

describe("settings", () => {
  test("anyone can read config, only super admin writes", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "settings", "config")));
    await assertFails(setDoc(doc(dbAs(OWNER), "settings", "config"), { currentAyah: "x" }));
    await assertSucceeds(setDoc(doc(dbAs(SUPER), "settings", "config"), { currentAyah: "x" }));
  });
});
