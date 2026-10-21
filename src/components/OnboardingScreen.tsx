"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { createGroup, getGroupDoc, joinGroup, privateDocRef, publishProfileToGroups, UserDoc } from "../lib/db";
import AuthShell from "./AuthShell";
import { clearPendingInvite, parseInviteId, readPendingInvite } from "../lib/invite";
import { btn, inputCls } from "./ui";

interface OnboardingScreenProps {
  user: UserDoc;
  logout: () => Promise<void>;
}

export default function OnboardingScreen({ user, logout }: OnboardingScreenProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupName, setGroupName] = useState("");
  
  const [inviteGroupName, setInviteGroupName] = useState<string>("");
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Without an invite the member chooses: join with a link (default) or start their own group
  const [mode, setMode] = useState<"join" | "create" | "later">("join");
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInviteId, setPendingInviteId] = useState("");

  // Invited = linked to a group in any way: through the link now, or an earlier join request.
  // Invited members are never asked to create a group.
  const isInvited = !!pendingInviteId
    || (!!user.groupId && user.groupId !== "default")
    || (user.groupIds?.length ?? 0) > 0;

  useEffect(() => {
    const inviteId = readPendingInvite();
    if (inviteId) setPendingInviteId(inviteId);
    if (inviteId && user.groupId !== inviteId) {
      setLoadingInvite(true);
      const updateInviteGroup = async () => {
        try {
          await joinGroup(user, inviteId);
        } catch (err) {
          console.error("Error linking invite group on onboarding screen:", err);
        } finally {
          setLoadingInvite(false);
        }
      };
      updateInviteGroup();
      return;
    }

    if (isInvited && user.groupId) {
      setLoadingInvite(true);
      getGroupDoc(user.groupId)
        .then((g) => {
          if (g) {
            setInviteGroupName(g.name);
          }
        })
        .finally(() => {
          setLoadingInvite(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInvited, user.groupId, user.uid, user.groupIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !nickname.trim()) {
      setError("Zəhmət olmasa bütün sahələri doldurun.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const userRef = doc(db, "users", user.uid);

      // Check if nickname is already taken by another user
      const nickQuery = query(collection(db, "users"), where("nickname", "==", nickname.trim()));
      const nickSnap = await getDocs(nickQuery);
      let isNickTaken = false;
      nickSnap.forEach((docSnap) => {
        if (docSnap.id !== user.uid) {
          isNickTaken = true;
        }
      });

      if (isNickTaken) {
        setError("Bu nickname artıq başqası tərəfindən istifadə edilir. Zəhmət olmasa başqa bir nickname seçin.");
        setSubmitting(false);
        return;
      }

      let newActiveGroupId = "";
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Names are private; only the nickname is on the public user doc
      await setDoc(privateDocRef(user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName
      }, { merge: true });

      // No invite yet, but the member pasted one: join that group first, then finish as invited
      let joinedNow = "";
      if (!isInvited && mode === "later") {
        await updateDoc(userRef, { nickname: nickname.trim(), isOnboarded: true, groupId: "" });
        clearPendingInvite();
        window.location.href = "/groups";
        return;
      }

      if (!isInvited && mode === "join") {
        if (!inviteLink.trim()) {
          setError("Qrup sahibinin göndərdiyi dəvət linkini bura yapışdır. Linkin hələ yoxdursa, aşağıdakı “Linkim hələ yoxdur” seçiminə toxun.");
          setSubmitting(false);
          return;
        }
        const id = parseInviteId(inviteLink);
        const group = id ? await getGroupDoc(id) : null;
        if (!group) {
          setError("Bu link tanınmadı. Qrup sahibindən aldığın linki tam şəkildə yapışdır.");
          setSubmitting(false);
          return;
        }
        await joinGroup(user, group.id);
        joinedNow = group.id;
      }

      if (!isInvited && !joinedNow) {
        if (!groupName.trim()) {
          setError("Zəhmət olmasa yaradılacaq yeni xətm qrupunun adını daxil edin.");
          setSubmitting(false);
          return;
        }

        // 1. Save the public nickname
        await updateDoc(userRef, { nickname: nickname.trim() });

        // 2. Create the group (automatically links to user as creator and approves them)
        const newGroupId = await createGroup(groupName.trim(), user.uid);
        newActiveGroupId = newGroupId;

        // 3. Complete onboarding
        await updateDoc(userRef, {
          groupId: newGroupId,
          isOnboarded: true
        });
        await publishProfileToGroups(user.uid, fullName, [newGroupId]);
      } else {
        // Invited flow: user remains "user", and joins the group as pending approval
        await updateDoc(userRef, {
          nickname: nickname.trim(),
          isOnboarded: true
        });
        // The group owner sees the full name of members who joined
        const groups = Array.from(new Set([...(user.groupIds || []), ...(joinedNow ? [joinedNow] : [])]));
        await publishProfileToGroups(user.uid, fullName, groups);
        newActiveGroupId = joinedNow || pendingInviteId || user.groupId || groups[0] || "";
      }

      // Set active group in local storage; the invite has been handled
      localStorage.setItem(`activeGroupId_${user.uid}`, newActiveGroupId);
      clearPendingInvite();
      
      // Perform window redirect to clear any invite parameters in URL and reload the app layout
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Onboarding submission error:", err);
      setError("Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="bg-white border border-line rounded-hero shadow-card p-6 md:p-8 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-bold text-[26px] md:text-[28px] leading-tight text-ink">Xoş gəlmisən</h2>
          <p className="m-0 text-[15px] leading-relaxed text-muted">Profilini tamamla{isInvited || mode === "join" ? " və qrupa qoşul" : mode === "create" ? " və ilk xətm qrupunu yarat" : ""}.</p>
        </div>

        {isInvited && (
          <div className="p-3.5 rounded-btn bg-mint text-sm text-forest">
            {loadingInvite ? (
              "Dəvət məlumatları yüklənir..."
            ) : (
              <>
                <strong>“{inviteGroupName || "Xətm qrupu"}”</strong> qrupuna dəvət aldın. Qrup sahibi təsdiq edəndən sonra qrupa daxil olacaqsan.
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Ad
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Məs. Əli"
                disabled={submitting}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Soyad
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Məs. Məmmədov"
                disabled={submitting}
                className={inputCls}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Nickname
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-semibold">@</span>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="ali_99"
                disabled={submitting}
                className={`${inputCls} pl-8`}
              />
            </div>
            <span className="text-xs font-normal text-muted">Digər iştirakçılar səni bu adla görəcək. Yalnız kiçik ingilis hərfləri, rəqəmlər və alt xətt.</span>
          </label>

          {!isInvited && (
            <div className="flex flex-col gap-3 pt-4 border-t border-sand">
              <div role="tablist" aria-label="Qrup" className="grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-sand">
                {([["join", "Dəvət linkim var"], ["create", "Yeni qrup yaradıram"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key || (key === "join" && mode === "later")}
                    onClick={() => { setMode(key); setError(null); }}
                    disabled={submitting}
                    className={`press min-h-[44px] rounded-[11px] text-[13px] ${mode === key || (key === "join" && mode === "later") ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === "later" ? (
                <div className="flex flex-col gap-2 rounded-btn bg-cream border border-line px-4 py-3.5 text-sm leading-relaxed text-ink">
                  <p className="m-0">Profilini indi tamamla. Qrup sahibindən linki alanda <strong>Qruplarım</strong> bölməsində yapışdırıb qoşula biləcəksən.</p>
                  <button type="button" onClick={() => setMode("join")} disabled={submitting} className="self-start text-sm font-bold text-forest">
                    Linkim var, indi yapışdırım
                  </button>
                </div>
              ) : mode === "join" ? (
                <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                  Dəvət linki
                  <input
                    type="text"
                    inputMode="url"
                    value={inviteLink}
                    onChange={(e) => setInviteLink(e.target.value)}
                    placeholder="https://xetm-app.onrender.com/?invite=..."
                    disabled={submitting}
                    className={inputCls}
                  />
                  <span className="text-xs font-normal text-muted">Qrup sahibinin göndərdiyi linki bura yapışdır. O təsdiq edəndən sonra qrupa daxil olacaqsan.</span>
                  <button type="button" onClick={() => { setMode("later"); setError(null); }} disabled={submitting} className="self-start mt-1 text-sm font-bold text-forest">
                    Linkim hələ yoxdur
                  </button>
                </label>
              ) : (
                <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                  Xətm qrupunun adı
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Məs. Ailə xətmi"
                    disabled={submitting}
                    className={inputCls}
                  />
                  <span className="text-xs font-normal text-muted">Bu qrupun sahibi olacaqsan və başqalarını dəvət edə biləcəksən.</span>
                </label>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-btn bg-[#FBEAE5] border border-dangerline text-sm text-danger leading-relaxed text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
              {submitting ? "Yadda saxlanılır..." : "Təsdiqlə və daxil ol"}
            </button>
            <button type="button" onClick={logout} disabled={submitting} className={`${btn.outline} w-full`}>
              Çıxış
            </button>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
