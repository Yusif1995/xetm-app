"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { deleteGroup, type GroupDoc } from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { Card, IconLink, IconTrash, LoadingScreen, PageHeader, btn } from "@/components/ui";

// Group settings for the owner: invite link, privacy tools (super admin) and deleting the group
export default function AdminSettingsPage() {
  const { user, loading, activeGroupId, setActiveGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const [inviteState, setInviteState] = useState<"idle" | "copied" | "failed">("idle");
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Groups this user owns, to switch to another one after deleting the current group
  useEffect(() => {
    if (!user) return;
    const ownedQuery = query(collection(db, "groups"), where("createdBy", "==", user.uid));
    return onSnapshot(ownedQuery, (snapshot) => {
      setCreatedGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc)));
    }, (err) => console.error("Error in groups listener:", err));
  }, [user]);

  if (loading || !activeGroupLoaded) {
    return <LoadingScreen text="Ayarlar yüklənir..." />;
  }
  if (!user) return null;

  const canManage = isSuperAdmin || activeGroup?.createdBy === user.uid;
  const groupName = activeGroup?.name || "Qrup";
  const hasGroup = !!activeGroupId && activeGroupId !== "default";
  const inviteLink = typeof window !== "undefined" && hasGroup ? `${window.location.origin}/?invite=${activeGroupId}` : "";

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
    <AppLayout activeTab="admin">
      <div className="max-w-[720px] flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Ayarlar"
          subtitle={groupName}
          actions={<Link href="/admin" className={btn.outline}>İnzibatçı panelinə qayıt</Link>}
        />

        {!canManage ? (
          <Card danger className="items-center text-center py-12">
            <h2 className="m-0 font-bold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
            <p className="m-0 text-sm text-muted max-w-md">Ayarları yalnız qrupun sahibi dəyişə bilər.</p>
            <Link href="/groups" className={btn.outline}>Qruplarım</Link>
          </Card>
        ) : (
          <>
            {hasGroup && (
              <Card>
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">Dəvət linki</h2>
                <p className="m-0 text-sm leading-relaxed text-muted">
                  Linki paylaş. Qoşulan şəxs sənin təsdiqindən sonra qrupa daxil olur.
                </p>
                <div className="rounded-[14px] bg-cream border border-line px-3.5 py-3 text-sm text-ink break-all select-all">{inviteLink}</div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button type="button" onClick={handleShareInvite} className={`${btn.primary} sm:flex-1`}>
                    <IconLink size={18} />
                    Dəvət linkini paylaş
                  </button>
                  <button type="button" onClick={handleCopyInvite} className={`${btn.outline} sm:flex-1`}>
                    {inviteState === "copied" ? "Link kopyalandı" : inviteState === "failed" ? "Kopyalamaq alınmadı" : "Linki kopyala"}
                  </button>
                </div>
              </Card>
            )}

            {isSuperAdmin && (
              <Card>
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">Məxfilik</h2>
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
                <h2 className="m-0 text-base md:text-lg font-bold text-danger">Təhlükəli zona</h2>
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
          </>
        )}
      </div>
    </AppLayout>
  );
}
