"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { createGroup, getGroupDoc, joinGroup, privateDocRef, publishProfileToGroups, UserDoc } from "../lib/db";
import AuthShell from "./AuthShell";
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

  const isInvited = user.groupId && user.groupId !== "default";

  useEffect(() => {
    const getInviteId = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlInvite = params.get("invite");
        if (urlInvite) {
          sessionStorage.setItem("pendingInviteGroupId", urlInvite);
          return urlInvite;
        }
        return sessionStorage.getItem("pendingInviteGroupId");
      }
      return null;
    };

    const inviteId = getInviteId();
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

      if (!isInvited) {
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
        await publishProfileToGroups(user.uid, fullName, user.groupIds || []);
        newActiveGroupId = user.groupId || "";
      }

      // Set active group in local storage
      localStorage.setItem(`activeGroupId_${user.uid}`, newActiveGroupId);
      
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
      <div className="bg-white border border-line rounded-hero p-6 md:p-8 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display font-semibold text-[26px] md:text-[28px] leading-tight text-forest">Xoş gəlmisən</h2>
          <p className="m-0 text-[15px] leading-relaxed text-muted">Profilini tamamla{isInvited ? " və qrupa qoşul" : " və ilk xətm qrupunu yarat"}.</p>
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
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink pt-4 border-t border-sand">
              Xətm qrupunun adı
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Məs. Ailə xətmi"
                disabled={submitting}
                className={inputCls}
              />
              <span className="text-xs font-normal text-muted">Bu qrupun sahibi olacaqsan və başqalarını dəvət edə biləcəksən.</span>
            </label>
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
