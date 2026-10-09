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

function groupEntry(extra = {}) {
  return { approved: false, assignedPages: [], completedPages: [], completedAt: {}, totalCompletedPages: 0, ...extra };
}

function userDoc(groupIds, extra = {}) {
  const groupData = {};
  for (const g of groupIds) groupData[g] = groupEntry();
  return { nickname: "x", role: "user", groupId: groupIds[0] || "", groupIds, groupData, isOnboarded: true, ...extra };
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
    await setDoc(doc(db, "users", MEMBER), userDoc([G, OTHER_G], {
      groupData: {
        [G]: groupEntry({ assignedPages: [1, 2, 3, 4, 5], completedPages: [1] }),
        [OTHER_G]: groupEntry(),
      },
    }));
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

  test("new user doc cannot start as admin or with group data", async () => {
    await assertFails(setDoc(doc(dbAs("newbie"), "users", "newbie"), userDoc([], { role: "admin" })));
    await assertFails(setDoc(doc(dbAs("newbie"), "users", "newbie"), userDoc([G])));
    await assertSucceeds(setDoc(doc(dbAs("newbie"), "users", "newbie"), { nickname: "n", role: "user", groupIds: [], approved: false }));
  });

  test("nobody can create an admins doc from the app", async () => {
    await assertFails(setDoc(doc(dbAs(MEMBER), "admins", MEMBER), {}));
  });

  test("an old role:'admin' field grants nothing", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users", STRANGER), { role: "admin" })
    );
    await assertFails(updateDoc(doc(dbAs(STRANGER), "users", OWNER), { nickname: "hacked" }));
    await assertFails(updateDoc(doc(dbAs(STRANGER), "settings", "config"), { currentAyah: "x" }));
  });
});

describe("own reading progress", () => {
  test("member can mark assigned pages read", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.completedPages`]: arrayUnion(2, 3),
      [`groupData.${G}.completedAt.2`]: "2026-01-01",
      [`groupData.${G}.totalCompletedPages`]: 3,
      selfEditedGroup: G,
    }));
  });

  test("group data edits must name the group", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.completedPages`]: arrayUnion(2),
    }));
  });

  test("member cannot mark pages outside the assignment", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.completedPages`]: arrayUnion(300),
      selfEditedGroup: G,
    }));
  });

  test("member cannot change their own assignment", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.assignedPages`]: [1, 2, 3, 4, 5, 6, 7, 8],
      selfEditedGroup: G,
    }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.assignmentEndDate`]: "2099-01-01",
      selfEditedGroup: G,
    }));
  });

  test("one group per write", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.completedPages`]: arrayUnion(2),
      [`groupData.${OTHER_G}.totalCompletedPages`]: 5,
      selfEditedGroup: G,
    }));
  });

  test("joining starts with an empty assignment", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(STRANGER), "users", STRANGER), {
      groupIds: arrayUnion(G),
      [`groupData.${G}`]: groupEntry(),
      selfEditedGroup: G,
    }));
    await env.clearFirestore();
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", STRANGER), userDoc([OTHER_G])));
    await assertFails(updateDoc(doc(dbAs(STRANGER), "users", STRANGER), {
      [`groupData.${G}`]: groupEntry({ assignedPages: [1, 2], completedPages: [1, 2] }),
      selfEditedGroup: G,
    }));
  });

  test("member can leave (remove their group data)", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      groupIds: arrayRemove(G),
      [`groupData.${G}`]: deleteField(),
      selfEditedGroup: G,
    }));
  });

  test("other own fields need no marker", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { nickname: "new", groupId: OTHER_G, isOnboarded: true }));
  });
});

describe("users", () => {
  test("user cannot edit someone else", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", OWNER), { nickname: "x2" }));
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
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), { nickname: "hacked", lastEditedGroup: G }));
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), { role: "admin", lastEditedGroup: G }));
  });

  test("group owner cannot write to users outside their group", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", STRANGER), {
      [`groupData.${G}.assignedPages`]: [1],
      lastEditedGroup: G,
    }));
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

  test("super admin can edit any user", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(SUPER), "users", MEMBER), { nickname: "fixed" }));
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

  test("members cannot touch the khatm counter (the server maintains it)", async () => {
    await assertFails(updateDoc(doc(dbAs(MEMBER), "groups", G), { completedKhatms: 1, isCurrentKhatmCompleted: true }));
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

describe("group listing", () => {
  test("a group can be opened by ID (invite link)", async () => {
    await assertSucceeds(getDoc(doc(dbAs(STRANGER), "groups", G)));
  });

  test("users can list the groups they belong to", async () => {
    const q = query(collection(dbAs(MEMBER), "groups"), where(`members.${MEMBER}`, "in", ["owner", "member", "pending"]));
    const snap = await assertSucceeds(getDocs(q));
    if (snap.size !== 1 || snap.docs[0].id !== G) throw new Error("expected only group1, got " + snap.size);
  });

  test("owners can list the groups they created", async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(OWNER), "groups"), where("createdBy", "==", OWNER))));
  });

  test("all groups cannot be enumerated", async () => {
    await assertFails(getDocs(collection(dbAs(MEMBER), "groups")));
    await assertFails(getDocs(query(collection(dbAs(MEMBER), "groups"), where("createdBy", "==", STRANGER))));
  });
});

describe("member messages", () => {
  const message = { text: "Salam", sentAt: "2026-10-09T10:00:00.000Z", read: false };
  const msgRef = (uid, groupId = G, memberId = MEMBER) => doc(dbAs(uid), "groups", groupId, "messages", memberId);

  test("group owner can message a member; the member can mark it read", async () => {
    await assertSucceeds(setDoc(msgRef(OWNER), message));
    await assertSucceeds(getDoc(msgRef(MEMBER)));
    await assertSucceeds(updateDoc(msgRef(MEMBER), { read: true }));
    await assertFails(updateDoc(msgRef(MEMBER), { text: "changed" }));
  });

  test("other users cannot read or write messages", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "groups", G, "messages", MEMBER), message));
    await assertFails(getDoc(msgRef(STRANGER)));
    await assertFails(setDoc(msgRef(STRANGER), message));
    await assertFails(setDoc(msgRef(MEMBER, G, OWNER), message));
  });

  test("owner can list read status of all members' messages", async () => {
    await assertSucceeds(getDocs(collection(dbAs(OWNER), "groups", G, "messages")));
    await assertFails(getDocs(collection(dbAs(MEMBER), "groups", G, "messages")));
  });

  test("messages can no longer be stored on the user doc", async () => {
    await assertFails(updateDoc(doc(dbAs(OWNER), "users", MEMBER), {
      adminNotification: "hi",
      lastEditedGroup: G,
    }));
  });

  test("member can remove a legacy message from their user doc", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users", MEMBER), { [`groupData.${G}.adminMessage`]: message })
    );
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      [`groupData.${G}.adminMessage`]: deleteField(),
      selfEditedGroup: G,
    }));
  });
});

describe("names and private data", () => {
  test("only the user can read and write their private doc", async () => {
    await assertSucceeds(setDoc(doc(dbAs(MEMBER), "users", MEMBER, "private", "profile"), { email: "m@x.az", name: "Mə Mə" }));
    await assertSucceeds(getDoc(doc(dbAs(MEMBER), "users", MEMBER, "private", "profile")));
    await assertFails(getDoc(doc(dbAs(OWNER), "users", MEMBER, "private", "profile")));
    await assertFails(getDoc(doc(dbAs(SUPER), "users", MEMBER, "private", "profile")));
    await assertFails(setDoc(doc(dbAs(OWNER), "users", MEMBER, "private", "profile"), { pushSubscriptions: ["evil"] }));
  });

  test("names, email and push subscriptions cannot be put on the public user doc", async () => {
    await assertFails(setDoc(doc(dbAs("newbie"), "users", "newbie"), { role: "user", name: "N", groupIds: [] }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { firstName: "Ə" }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { pushSubscriptions: ["s"] }));
    await assertFails(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), { email: "m@x.az" }));
  });

  test("user can remove legacy private fields from the public doc", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users", MEMBER), { email: "m@x.az", pushSubscriptions: ["s"], name: "M", firstName: "M" })
    );
    await assertSucceeds(updateDoc(doc(dbAs(MEMBER), "users", MEMBER), {
      email: deleteField(), pushSubscriptions: deleteField(), name: deleteField(), firstName: deleteField(),
    }));
  });

  test("full names in a group are visible to the owner and the member only", async () => {
    await assertSucceeds(setDoc(doc(dbAs(MEMBER), "groups", G, "profiles", MEMBER), { name: "Mə Mə" }));
    await assertSucceeds(getDocs(collection(dbAs(OWNER), "groups", G, "profiles")));
    await assertSucceeds(getDoc(doc(dbAs(MEMBER), "groups", G, "profiles", MEMBER)));
    await assertFails(getDoc(doc(dbAs(STRANGER), "groups", G, "profiles", MEMBER)));
    await assertFails(getDocs(collection(dbAs(MEMBER), "groups", G, "profiles")));
    await assertFails(setDoc(doc(dbAs(OWNER), "groups", G, "profiles", MEMBER), { name: "fake" }));
  });
});

describe("hadiths", () => {
  test("anyone can read hadiths, only super admin writes", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "hadiths", "h1")));
    await assertFails(setDoc(doc(dbAs(OWNER), "hadiths", "h1"), { text: "x" }));
    await assertSucceeds(setDoc(doc(dbAs(SUPER), "hadiths", "h1"), { text: "x" }));
  });
});

describe("settings", () => {
  test("anyone can read config, only super admin writes", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "settings", "config")));
    await assertFails(setDoc(doc(dbAs(OWNER), "settings", "config"), { currentAyah: "x" }));
    await assertSucceeds(setDoc(doc(dbAs(SUPER), "settings", "config"), { currentAyah: "x" }));
  });
});
