"use client";
// App owner only (/admin/sistem): read any group's manager <-> member conversations. Read-only;
// the data comes from /api/owner, so other app admins never see these threads.
import { useEffect, useState } from "react";
import { getThread, listAllGroups, listThreads, type OwnerGroup, type OwnerThread, type OwnerThreadMessage } from "@/lib/ownerApi";
import { relativeTimeAz } from "@/lib/dates";
import ThreadView from "./ThreadView";
import { Card, button, inputCls } from "./ui";

export default function OwnerConversations() {
  const [groups, setGroups] = useState<OwnerGroup[] | null>(null);
  const [groupId, setGroupId] = useState("");
  const [threads, setThreads] = useState<OwnerThread[] | null>(null);
  const [open, setOpen] = useState<OwnerThread | null>(null);
  const [messages, setMessages] = useState<OwnerThreadMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAllGroups()
      .then((res) => (res.ok && res.data.groups ? setGroups(res.data.groups) : setError("Qruplar yüklənmədi.")))
      .catch(() => setError("Qruplar yüklənmədi."));
  }, []);

  useEffect(() => {
    setThreads(null);
    setOpen(null);
    if (!groupId) return;
    listThreads(groupId)
      .then((res) => (res.ok && res.data.threads ? setThreads(res.data.threads) : setError("Yazışmalar yüklənmədi.")))
      .catch(() => setError("Yazışmalar yüklənmədi."));
  }, [groupId]);

  useEffect(() => {
    setMessages(null);
    if (!open) return;
    getThread(groupId, open.memberUid)
      .then((res) => (res.ok && res.data.messages ? setMessages(res.data.messages) : setError("Yazışma yüklənmədi.")))
      .catch(() => setError("Yazışma yüklənmədi."));
  }, [groupId, open]);

  return (
    <Card>
      <h2 className="m-0 text-base md:text-lg font-bold text-ink">Qrup yazışmaları</h2>
      <p className="m-0 -mt-1.5 text-sm text-muted leading-relaxed">
        Qrup rəhbərləri ilə iştirakçılar arasındakı yazışmalar. Yalnız sən və həmin qrupun rəhbəri görür, digər adminlər görmür. Burada yalnız baxmaq olar.
      </p>
      <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
        Qrup
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls} disabled={!groups}>
          <option value="">{groups ? "Qrup seç..." : "Yüklənir..."}</option>
          {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="m-0 text-sm text-danger font-semibold">{error}</p>}

      {groupId && !open && (
        threads === null ? (
          <p className="m-0 text-sm text-muted">Yüklənir...</p>
        ) : threads.length === 0 ? (
          <p className="m-0 text-sm text-muted">Bu qrupda hələ yazışma yoxdur.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border-t border-line">
            {threads.map((t) => (
              <button
                key={t.memberUid}
                type="button"
                onClick={() => setOpen(t)}
                className="press text-left py-3 flex flex-col gap-0.5 hover:bg-cream -mx-2 px-2 rounded-xl"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold text-ink">{t.name}</span>
                  <span className="text-xs text-muted">{t.lastAt ? relativeTimeAz(new Date(t.lastAt).getTime()) : ""}</span>
                </span>
                <span className="text-[13px] text-muted truncate">
                  {t.lastFrom === "member" ? "İştirakçı: " : "Rəhbər: "}{t.lastText}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {open && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-bold text-ink">{open.name}</span>
            <button type="button" onClick={() => setOpen(null)} className={button("outline", "sm")}>Siyahıya qayıt</button>
          </div>
          {messages === null ? (
            <p className="m-0 text-sm text-muted">Yüklənir...</p>
          ) : (
            <ThreadView messages={messages} mySide="manager" memberLabel={open.name} emptyText="Yazışma boşdur." />
          )}
        </div>
      )}
    </Card>
  );
}
