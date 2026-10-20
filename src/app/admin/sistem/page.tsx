"use client";
// App owner only: who the app admins are, with the groups each one created.
// The owner can take admin rights away and delete groups. Every action is checked on the server.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { deleteGroupAsOwner, listAdmins, revokeAdmin, type OwnerAdmin } from "@/lib/ownerApi";
import { Avatar, Card, Chip, IconTrash, LoadingScreen, PageHeader, btn, button } from "@/components/ui";

type State = "loading" | "ready" | "forbidden" | "error";

export default function SystemPage() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [admins, setAdmins] = useState<OwnerAdmin[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listAdmins();
      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok || !res.data.admins) {
        setState("error");
        return;
      }
      setAdmins(res.data.admins);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return <LoadingScreen text="Sistem idarəsi yüklənir..." />;

  const label = (a: OwnerAdmin) => a.name || (a.nickname ? `@${a.nickname}` : "Adsız istifadəçi");

  const handleRevoke = async (a: OwnerAdmin) => {
    if (!window.confirm(`${label(a)} adlı şəxsin adminliyi götürülsün? Qrupları qalacaq, amma Admin hüquqları olmayacaq.`)) return;
    setBusy(a.uid);
    setNotice(null);
    const res = await revokeAdmin(a.uid).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setNotice({ tone: "ok", text: `${label(a)} artıq admin deyil.` });
      load();
    } else {
      setNotice({ tone: "error", text: res?.data.error || "Adminliyi götürmək alınmadı. Yenidən cəhd et." });
    }
  };

  const handleDeleteGroup = async (a: OwnerAdmin, groupId: string, groupName: string) => {
    if (!window.confirm(`“${groupName}” qrupu silinsin? Qrupun bütün oxuma məlumatları, cüz təyinatları və üzvlükləri silinəcək. Bu geri qaytarılmır.`)) return;
    setBusy(groupId);
    setNotice(null);
    const res = await deleteGroupAsOwner(groupId).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setNotice({ tone: "ok", text: `“${groupName}” qrupu silindi.` });
      load();
    } else {
      setNotice({ tone: "error", text: res?.data.error || "Qrupu silmək alınmadı. Yenidən cəhd et." });
    }
  };

  return (
    <AppLayout activeTab="admin">
      <div className="max-w-[880px] flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Sistem idarəsi"
          subtitle="Tətbiqin adminləri və onların qrupları"
          actions={<Link href="/admin" className={button("outline")}>İnzibatçı panelinə qayıt</Link>}
        />

        {state === "loading" && (
          <Card className="items-center py-10">
            <p className="m-0 text-sm text-muted">Adminlər yüklənir...</p>
          </Card>
        )}

        {state === "forbidden" && (
          <Card danger className="items-center text-center py-12">
            <h2 className="m-0 font-bold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
            <p className="m-0 text-sm text-muted max-w-md">Bu səhifə yalnız tətbiqin sahibi üçündür.</p>
          </Card>
        )}

        {state === "error" && (
          <Card danger className="items-center text-center py-10">
            <p className="m-0 text-sm text-danger font-semibold">Məlumatı yükləmək alınmadı.</p>
            <button type="button" onClick={load} className={btn.outline}>Yenidən cəhd et</button>
          </Card>
        )}

        {notice && (
          <div role={notice.tone === "error" ? "alert" : "status"} className={`rounded-card px-5 py-3.5 text-[15px] font-semibold ${notice.tone === "error" ? "bg-[#FBEFEB] text-danger" : "bg-donebg text-donetext"}`}>
            {notice.text}
          </div>
        )}

        {state === "ready" && (
          <>
            <p className="m-0 text-[15px] leading-relaxed text-muted">
              Sistemdə <strong className="text-ink tabular-nums">{admins.length}</strong> admin var. Yeni admin Firebase Console-da <code className="text-[13px] bg-sand rounded px-1">admins</code> kolleksiyasına əlavə olunur.
            </p>
            {admins.map((a) => (
              <Card key={a.uid}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-[1_1_240px]">
                    <Avatar name={label(a)} gold={!a.isSelf} size={44} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-bold text-ink truncate">{label(a)}</span>
                        <Chip tone="owner">{a.isSelf ? "Owner" : "Admin"}</Chip>
                      </div>
                      <div className="text-[13px] text-muted truncate">
                        {[a.nickname && `@${a.nickname}`, a.email].filter(Boolean).join(" · ") || a.uid}
                      </div>
                    </div>
                  </div>
                  {!a.isSelf && (
                    <button type="button" onClick={() => handleRevoke(a)} disabled={busy !== null} className={button("danger", "sm")}>
                      {busy === a.uid ? "Götürülür..." : "Adminlikdən çıxar"}
                    </button>
                  )}
                </div>

                {a.groups.length === 0 ? (
                  <p className="m-0 text-sm text-muted">Yaratdığı qrup yoxdur.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-line border-t border-line">
                    {a.groups.map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold text-ink truncate">{g.name}</div>
                          <div className="text-[13px] text-muted">
                            {g.members} üzv{g.pending > 0 ? ` · ${g.pending} gözləyən` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(a, g.id, g.name)}
                          disabled={busy !== null}
                          className={button("danger", "sm")}
                        >
                          <IconTrash size={16} />
                          {busy === g.id ? "Silinir..." : "Qrupu sil"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}
