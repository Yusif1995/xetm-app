"use client";
// Archive for group managers, in two parts: finished khatms and finished distributions. Each
// record is a self-contained copy in groups/{gid}/archive (written by /api/archive when this page
// opens and before a reset), so it stays here even after the assignments are cleared.
// Every record, or a whole part, can be exported as a PDF.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { syncGroupArchive } from "@/lib/db";
import { useGroupArchive } from "@/lib/useGroupData";
import type { ArchiveEntry } from "@/lib/archive";
import { entryFinishedAt, entrySummary, entryTables, entryTitle, type ArchiveTable } from "@/lib/archiveFormat";
import AppLayout from "@/components/AppLayout";
import { Card, Chip, LoadingScreen, PageHeader, button } from "@/components/ui";

type Tab = "khatm" | "distribution";

const TAB_LABEL: Record<Tab, string> = { khatm: "Xətm", distribution: "Bölgü" };

export default function ArchivePage() {
  const { user, loading, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const canManage = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const { entries, loaded } = useGroupArchive(activeGroupId, canManage);
  const [tab, setTab] = useState<Tab>("khatm");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Copy anything finished since the last visit into the archive
  useEffect(() => {
    if (!canManage || !activeGroupId) return;
    setSyncError(null);
    syncGroupArchive(activeGroupId).catch((err) => {
      console.error("Error syncing archive:", err);
      setSyncError("Son bitənlər arxivə köçürülmədi. Səhifəni yenilə.");
    });
  }, [canManage, activeGroupId]);

  if (loading || !user || !activeGroupLoaded || (canManage && !loaded)) return <LoadingScreen text="Arxiv yüklənir..." />;

  if (!canManage) {
    return (
      <AppLayout activeTab="admin">
        <Card danger className="items-center text-center py-12">
          <h2 className="m-0 font-bold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
          <p className="m-0 text-sm text-muted">Arxivi yalnız qrupun rəhbəri və adminlər görə bilər.</p>
        </Card>
      </AppLayout>
    );
  }

  const byKind = (kind: Tab) => entries
    .filter((e) => e.kind === kind)
    .sort((a, b) => entryFinishedAt(b).localeCompare(entryFinishedAt(a)));
  const list = byKind(tab);
  const groupName = activeGroup?.name || "Qrup";

  const exportPdf = async (key: string, items: ArchiveEntry[], heading: string, ...nameParts: string[]) => {
    setExporting(key);
    setExportError(null);
    try {
      const { exportArchivePdf, pdfFileName } = await import("@/lib/archivePdf");
      await exportArchivePdf(items, heading, pdfFileName(groupName, ...nameParts, new Date().toISOString().slice(0, 10)));
    } catch (err) {
      console.error("Error exporting archive PDF:", err);
      setExportError("PDF hazırlanmadı. İnterneti yoxla və yenidən cəhd et.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout activeTab="admin">
      <div className="max-w-[960px] flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Arxiv"
          subtitle={groupName}
          actions={<Link href="/admin" className={button("outline", "sm")}>İnzibatçı paneli</Link>}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Arxiv bölməsi" className="inline-flex p-1 rounded-full bg-sand">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`press min-h-[44px] px-5 rounded-full text-[15px] font-bold ${tab === t ? "bg-white text-ink shadow-card" : "text-muted"}`}
              >
                {TAB_LABEL[t]} · {byKind(t).length}
              </button>
            ))}
          </div>
          {list.length > 0 && (
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => exportPdf(`all-${tab}`, list, tab === "khatm" ? "Tamamlanmış xətmlər" : "Tamamlanmış bölgülər", tab === "khatm" ? "xetmler" : "bolguler")}
              className={button("outline", "sm")}
            >
              {exporting === `all-${tab}` ? "Hazırlanır..." : "Hamısını PDF et"}
            </button>
          )}
        </div>

        {syncError && <div className="text-sm font-semibold text-danger">{syncError}</div>}
        {exportError && <div className="text-sm font-semibold text-danger">{exportError}</div>}

        <section role="tabpanel" aria-label={TAB_LABEL[tab]} className="flex flex-col gap-3.5">
          {list.length === 0 ? (
            <Card>
              <p className="m-0 text-sm text-muted">
                {tab === "khatm"
                  ? "Hələ tamamlanmış xətm yoxdur. 30 cüzün hamısı oxunan xətm buraya köçür."
                  : "Hələ tamamlanmış bölgü yoxdur. Hamının cüzünü bitirdiyi bölgü buraya köçür."}
              </p>
            </Card>
          ) : list.map((e) => (
            <ArchiveCard
              key={e.id}
              entry={e}
              exporting={exporting === e.id}
              disabled={exporting !== null}
              onExport={() => exportPdf(e.id, [e], entryTitle(e), entryTitle(e))}
            />
          ))}
        </section>
      </div>
    </AppLayout>
  );
}

function ArchiveCard({ entry, exporting, disabled, onExport }: { entry: ArchiveEntry; exporting: boolean; disabled: boolean; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const [summary1, summary2] = entrySummary(entry);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base md:text-lg font-bold text-ink">{entryTitle(entry)}</h3>
        <Chip tone="done">{entry.kind === "khatm" ? "Tamamlanıb" : "Hamı bitirib"}</Chip>
      </div>
      <div className="flex flex-col gap-0.5 text-[13px] text-muted">
        <span>{summary1}</span>
        <span>{summary2}</span>
      </div>
      {open && entryTables(entry).map((t) => <ArchiveTableView key={t.title} table={t} />)}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={button("outline", "sm")}>
          {open ? "Gizlət" : "Ətraflı"}
        </button>
        <button type="button" disabled={disabled} onClick={onExport} className={button("outline", "sm")}>
          {exporting ? "Hazırlanır..." : "PDF"}
        </button>
      </div>
    </Card>
  );
}

function ArchiveTableView({ table }: { table: ArchiveTable }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <h4 className="m-0 text-sm font-bold text-ink">{table.title}</h4>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[480px] text-[13px] border-collapse">
          <thead>
            <tr className="bg-sand text-muted">
              {table.columns.map((c) => (
                <th key={c.label} scope="col" style={{ width: `${c.width * 100}%` }} className={`px-2 py-2 font-bold ${c.align === "right" ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-b border-line">
                {r.map((v, j) => (
                  <td key={j} className={`px-2 py-2 text-ink ${table.columns[j].align === "right" ? "text-right tabular-nums" : ""}`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
