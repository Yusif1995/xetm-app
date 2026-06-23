"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { createGroup, getGroupDoc, UserDoc } from "../lib/db";

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
  }, [isInvited, user.groupId]);

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

      let newActiveGroupId = "default";

      if (!isInvited) {
        if (!groupName.trim()) {
          setError("Zəhmət olmasa yaradılacaq yeni xətm qrupunun adını daxil edin.");
          setSubmitting(false);
          return;
        }

        // 1. Temporarily upgrade role to "admin" to pass Firestore creation rules
        await updateDoc(userRef, {
          role: "admin",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nickname: nickname.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`
        });

        // 2. Create the group (automatically links to user as creator and approves them)
        const newGroupId = await createGroup(groupName.trim(), user.uid);
        newActiveGroupId = newGroupId;

        // 3. Complete onboarding
        await updateDoc(userRef, {
          groupId: newGroupId,
          isOnboarded: true
        });
      } else {
        // Invited flow: user remains "user", and joins the group as pending approval
        await updateDoc(userRef, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nickname: nickname.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          isOnboarded: true
        });
        newActiveGroupId = user.groupId || "default";
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
    <main className="relative flex-1 flex flex-col justify-center items-center p-4 md:p-8 min-h-screen islamic-bg overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#c9a84c_1.5px,transparent_1.5px)] [background-size:32px_32px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[8px] border-[#c9a84c]/20 rounded-full rotate-45 animate-[spin_120s_linear_infinite]"></div>
      </div>

      <div className="islamic-card w-full max-w-lg p-6 md:p-10 flex flex-col items-center">
        <div className="islamic-card-inner" />
        <div className="islamic-pattern" />

        {/* Central Rub el Hizb ornament */}
        <div className="w-12 h-12 flex items-center justify-center mb-4 relative z-10">
          <div className="absolute w-10 h-10 bg-gradient-to-br from-[#c9a84c] to-[#b0913e] rotate-0 rounded-sm shadow"></div>
          <div className="absolute w-10 h-10 bg-gradient-to-br from-[#c9a84c] to-[#b0913e] rotate-45 rounded-sm shadow"></div>
          <div className="absolute w-4 h-4 bg-[#0b301a] rotate-0 rounded-full z-10 border border-[#c9a84c]/40 flex items-center justify-center">
            ✨
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-amiri font-bold text-center text-transparent bg-clip-text bg-gradient-to-b from-[#fdf6e3] via-[#c9a84c] to-[#b0913e] mb-2 tracking-wide relative z-10">
          Xoş Gəlmisiniz
        </h1>
        <p className="text-xs text-[#fdf6e3]/70 text-center uppercase tracking-widest mb-6 font-semibold border-b border-[#c9a84c]/25 pb-3 w-full relative z-10">
          Profil Quraşdırılması
        </p>

        {isInvited && (
          <div className="w-full mb-5 p-3.5 bg-white/5 border border-[#c9a84c]/30 rounded-xl relative z-10 text-center">
            {loadingInvite ? (
              <span className="text-xs text-[#fdf6e3]/50">Dəvət məlumatları yüklənir...</span>
            ) : (
              <span className="text-xs md:text-sm text-[#fdf6e3]/90">
                Siz <strong>“{inviteGroupName || "Xətm Qrupu"}”</strong> qrupuna dəvət aldınız.
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4.5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#fdf6e3]/80">Ad</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Məs. Əli"
                disabled={submitting}
                className="px-3.5 py-2.5 bg-[#082213]/80 border border-[#c9a84c]/25 focus:border-[#c9a84c] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#fdf6e3]/80">Soyad</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Məs. Məmmədov"
                disabled={submitting}
                className="px-3.5 py-2.5 bg-[#082213]/80 border border-[#c9a84c]/25 focus:border-[#c9a84c] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#fdf6e3]/80">Nickname (İstifadəçi adı)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c9a84c]/60 text-sm font-semibold">@</span>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="ali_99"
                disabled={submitting}
                className="w-full pl-8 pr-3.5 py-2.5 bg-[#082213]/80 border border-[#c9a84c]/25 focus:border-[#c9a84c] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[10px] text-[#fdf6e3]/55">Yalnız kiçik ingilis hərfləri, rəqəmlər və alt xətt olar.</p>
          </div>

          {!isInvited && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#c9a84c]/10">
              <label className="text-xs font-bold text-[#fdf6e3]/80">Yaradılacaq Xətm Qrupunun Adı</label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Məs. Vəfa Xətm Qrupu"
                disabled={submitting}
                className="px-3.5 py-2.5 bg-[#082213]/80 border border-[#c9a84c]/25 focus:border-[#c9a84c] rounded-xl text-white placeholder-white/30 text-sm focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-[#fdf6e3]/55">Bu qrupun yaradıcısı (Admini) olacaqsınız və digər istifadəçiləri dəvət edə biləcəksiniz.</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 leading-relaxed text-center">
              {error}
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#c9a84c] hover:bg-[#b0913e] text-[#05160c] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-[#05160c]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Məlumatlar yadda saxlanılır...</span>
                </>
              ) : (
                <span>Təsdiqlə və Daxil Ol</span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              disabled={submitting}
              className="w-full py-2.5 bg-transparent hover:bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl transition-colors text-xs font-semibold"
            >
              Girişdən İmtina Et
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
