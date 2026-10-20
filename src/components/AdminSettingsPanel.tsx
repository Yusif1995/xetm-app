"use client";
// Group settings for the owner, opened from the gear button on the admin screen:
// invite link, privacy tools (super admin) and deleting the group.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { deleteGroup, type GroupDoc } from "@/lib/db";
import { isAppOwner } from "@/lib/ownerApi";
import Link from "next/link";
import { Card, IconClose, IconLink, IconShield, IconTrash, btn } from "./ui";

export default function AdminSettingsPanel({ onClose }: { onClose: () => void }) {
  const { user, activeGroupId, setActiveGroupId, activeGroup, isSuperAdmin } = useAuth();
  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const [inviteState, setInviteState] = useState<"idle" | "copied" | "failed">("idle");
  const [guideState, setGuideState] = useState<"idle" | "copied">("idle");
  // The app owner (server-checked) also gets the admins overview
  const [appOwner, setAppOwner] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    isAppOwner().then((owner) => { if (!cancelled) setAppOwner(owner); });
    return () => { cancelled = true; };
  }, []);

  // Groups this user owns, to switch to another one after deleting the current group
  useEffect(() => {
    if (!user) return;
    const ownedQuery = query(collection(db, "groups"), where("createdBy", "==", user.uid));
    return onSnapshot(ownedQuery, (snapshot) => {
      setCreatedGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc)));
    }, (err) => console.error("Error in groups listener:", err));
  }, [user]);

  // Dialog behaviour: focus the close button, keep Tab inside, Esc closes, page does not scroll behind
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])"))
        .filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [onClose]);

  if (!user) return null;

  const groupName = activeGroup?.name || "Qrup";
  const hasGroup = !!activeGroupId && activeGroupId !== "default";
  const inviteLink = hasGroup ? `${window.location.origin}/?invite=${activeGroupId}` : "";

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteState("copied");
    } catch {
      setInviteState("failed");
    }
    setTimeout(() => setInviteState("idle"), 3000);
  };

  // Native share sheet on phones (WhatsApp, Telegram...), copy elsewhere
  const handleShareInvite = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Xətm", text: `“${groupName}” xətm qrupuna qoşul`, url: inviteLink });
      } catch {
        // The member closed the share sheet; nothing to do
      }
      return;
    }
    handleCopyInvite();
  };

  // The add-to-home-screen guide, shared like the invite link
  const handleShareGuide = async () => {
    const guideLink = `${window.location.origin}/qurasdir`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Xətm", text: "Xətm-i telefonun ana ekranına belə əlavə et", url: guideLink });
      } catch {
        // Closed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(guideLink);
      setGuideState("copied");
      setTimeout(() => setGuideState("idle"), 3000);
    } catch {
      // Clipboard blocked; the "Təlimata bax" link is still there
    }
  };

  const handleMigratePrivate = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/migrate-private", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken || ""}` },
      });
      const data = await res.json();
      setMigrationResult(res.ok
        ? `Hazırdır: ${data.total} istifadəçidən ${data.migrated} nəfərin məlumatı köçürüldü.`
        : `Xəta: ${data.error || res.status}`);
    } catch (err) {
      console.error("Migration error:", err);
      setMigrationResult("Xəta baş verdi.");
    } finally {
      setMigrating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!hasGroup) return;
    if (!window.confirm(`“${groupName}” qrupunu silmək istədiyinizdən əminsiniz? Qrupa aid bütün oxunma məlumatları və üzvlük qeydləri silinəcək.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGroup(activeGroupId);
      const remaining = createdGroups.filter((g) => g.id !== activeGroupId);
      if (remaining.length > 0) {
        setActiveGroupId(remaining[0].id);
        window.location.href = "/admin";
      } else {
        await updateDoc(doc(db, "users", user.uid), { isOnboarded: false, groupId: "" });
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Error deleting group:", err);
      setDeleteError("Qrupu silmək alınmadı. Yenidən cəhd et.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-black/40" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="rise-in w-full md:w-[440px] max-h-[92dvh] md:max-h-none md:h-full bg-cream rounded-t-[28px] md:rounded-none md:rounded-l-[28px] shadow-bar flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 md:px-6 md:pt-6 bg-cream">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 id="settings-title" className="m-0 text-2xl font-extrabold text-ink">Ayarlar</h2>
            <div className="text-[13px] text-muted truncate">{groupName}</div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Ayarları bağla"
            className="press w-11 h-11 shrink-0 rounded-full bg-white border border-line shadow-card text-ink flex items-center justify-center hover:bg-sand"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-6 flex flex-col gap-4">
          {appOwner && (
            <Card>
              <h3 className="m-0 text-base font-bold text-ink">Sistem idarəsi</h3>
              <p className="m-0 text-sm leading-relaxed text-muted">
                Tətbiqin bütün adminlərini və onların qruplarını gör. Adminliyi götürə və qrupları silə bilərsən.
              </p>
              <Link href="/admin/sistem" onClick={onClose} className={btn.primary}>
                <IconShield size={18} />
                Adminləri idarə et
              </Link>
            </Card>
          )}

          {hasGroup && (
            <Card>
              <h3 className="m-0 text-base font-bold text-ink">Dəvət linki</h3>
              <p className="m-0 text-sm leading-relaxed text-muted">
                Linki paylaş. Qoşulan şəxs sənin təsdiqindən sonra qrupa daxil olur.
              </p>
              <div className="rounded-[14px] bg-cream border border-line px-3.5 py-3 text-sm text-ink break-all select-all">{inviteLink}</div>
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={handleShareInvite} className={btn.primary}>
                  <IconLink size={18} />
                  Dəvət linkini paylaş
                </button>
                <button type="button" onClick={handleCopyInvite} className={btn.outline}>
                  {inviteState === "copied" ? "Link kopyalandı" : inviteState === "failed" ? "Kopyalamaq alınmadı" : "Linki kopyala"}
                </button>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="m-0 text-base font-bold text-ink">Ana ekrana əlavə etmə təlimatı</h3>
            <p className="m-0 text-sm leading-relaxed text-muted">
              iPhone və Android üçün şəkilli addımlar. Linki üzvlərə göndər ki, Xətm-i telefonlarına tətbiq kimi əlavə etsinlər.
            </p>
            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={handleShareGuide} className={btn.outline}>
                <IconLink size={18} />
                {guideState === "copied" ? "Link kopyalandı" : "Təlimatı paylaş"}
              </button>
              <a href="/qurasdir" className="text-sm font-bold text-forest self-start">Təlimata bax</a>
            </div>
          </Card>

          {isSuperAdmin && (
            <Card>
              <h3 className="m-0 text-base font-bold text-ink">Məxfilik</h3>
              <p className="m-0 text-sm leading-relaxed text-muted">
                Bütün istifadəçilərin e-poçt və bildiriş abunələrini gizli bölməyə köçürür. Bir dəfə işə salmaq kifayətdir. Bu bölmə yalnız super adminlərə görünür.
              </p>
              <button type="button" onClick={handleMigratePrivate} disabled={migrating} className={`${btn.outline} self-start`}>
                {migrating ? "Köçürülür..." : "Məlumatları köçür"}
              </button>
              {migrationResult && <div role="status" className="text-sm font-semibold text-ink">{migrationResult}</div>}
            </Card>
          )}

          {hasGroup && (
            <Card danger>
              <h3 className="m-0 text-base font-bold text-danger">Təhlükəli zona</h3>
              <p className="m-0 text-sm leading-relaxed text-muted">
                Qrupu sildikdə bütün iştirakçıların gedişatı silinir. Bu əməliyyat geri qaytarılmır.
              </p>
              {deleteError && <p role="alert" className="m-0 text-sm font-semibold text-danger">{deleteError}</p>}
              <button type="button" onClick={handleDeleteGroup} disabled={deleting} className={`${btn.danger} self-start`}>
                <IconTrash size={18} />
                {deleting ? "Silinir..." : "Qrupu sil"}
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
