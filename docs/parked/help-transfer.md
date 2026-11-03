# Parked: "Ötür" panel (help with pages / hand over a whole juz)

Status: **switched off in the UI on 2026-11-03** at the owner's request. The owner may ask for it
again ("ötür / kömək funksiyasını geri qaytar"); this file is how to bring it back.

## What it did

In `/admin` (Cüz bölgüsü -> Oxunmaqda olan cüzlər) every unfinished juz had an **Ötür** button next
to **Ləğv et**. It opened a panel with two modes:

- **Qalan səhifələr** (default, "kömək"): the manager picks some unread pages and a friend. The juz
  stays with its holder and is credited to the holder when finished; the friend is credited with the
  pages they read (`readBy`). The friend gets a "Kömək" push and a Kömək card on /dashboard with an
  "Oxu" button; the holder gets a push when the friend finishes. The holder sees those pages as
  dashed blue stars ("dostun oxuyur").
- **Bütün cüz**: the whole juz moves to the chosen member (`previousHolders` keeps the old holder
  and the pages they read).

## What is still in the code (left in place, not removed)

Only the admin panel was taken out. Everything below still works, so existing help (juz 19 of VƏFA,
pages 377-380 given to the owner) runs to the end:

- `src/app/api/assignments/route.ts`: actions `help`, `unhelp`, `helpRead`, `transfer`,
  `notifyHelper`, `notifyHolderOfHelp`.
- `src/lib/khatm.ts`: `Helper`, `Assignment.helpers`, `readBy`, `helperPages`, `holderPages`,
  `helpTasksOf`, helper credit in `pagesReadBy` / `memberStats`.
- `src/lib/db.ts`: `giveHelpPages`, `takeBackHelpPages`, `markHelpPages`, `transferAssignment`.
- `/dashboard` Kömək card, `/oxu` help pages, `/readings` dashed tiles, `PageMedal` "helped" state,
  archive `helpedBy`.
- `/admin` still shows "X kömək edir · səhifə ... · Geri al" rows when a juz has helpers.
- `transferAssignment` is still used in `/admin` for juz of members who left or are removed.

## How to bring it back

1. In `src/app/admin/page.tsx` put back the state, handlers and JSX below (the original lines came
   from commit `6f5a1d4`; `git show 6f5a1d4:src/app/admin/page.tsx` has the full file).
2. Re-add `giveHelpPages`, `takeBackHelpPages` (if removed) and `helperPages` to the imports.
3. `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:rules`; security review is not
   needed if the server route is unchanged.

Known limits accepted when it shipped: help pages given to someone who later leaves stay given until
a manager presses "Geri al"; the holder can, by a direct Firestore write, unmark a page the friend
read (would need a rules change to close).

## The removed admin code

```tsx
  // Transfer an unfinished juz to another member
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [transferUid, setTransferUid] = useState("");
  // "pages": a friend only helps with the chosen pages; "juz": the whole juz moves to them
  const [transferMode, setTransferMode] = useState<"juz" | "pages">("pages");
  const [helpPages, setHelpPages] = useState<number[]>([]);

  const handleTransfer = async (a: Assignment) => {
    if (!transferUid) return;
    try {
      if (transferMode === "pages") {
        if (helpPages.length === 0) return;
        await giveHelpPages(activeGroupId, a, transferUid, helpPages);
      } else {
        await transferAssignment(activeGroupId, a, transferUid);
      }
      setTransferFor(null);
      setTransferUid("");
    } catch (err) {
      console.error("Error transferring assignment:", err);
      alert(err instanceof Error ? err.message : "Cüzü ötürərkən xəta baş verdi.");
    }
  };

  const handleTakeBackHelp = async (a: Assignment, helperUid: string) => {
    try {
      await takeBackHelpPages(activeGroupId, a, helperUid);
    } catch (err) {
      console.error("Error taking back help pages:", err);
      alert(err instanceof Error ? err.message : "Səhifələri geri almaq alınmadı.");
    }
  };

  // Unread pages of a juz that nobody is helping with yet: these can be given to a friend
  const freePagesOf = (a: Assignment) => {
    const given = helperPages(a);
    return [...a.pages].sort((x, y) => x - y).filter((p) => !a.completedPages.includes(p) && !given.has(p));
  };

  const openTransfer = (a: Assignment) => {
    const opening = transferFor !== a.id;
    setTransferFor(opening ? a.id : null);
    setTransferUid("");
    setTransferMode("pages");
    setHelpPages(opening ? freePagesOf(a) : []);
  };

// Button next to "Ləğv et" in each open juz row:
                                <button type="button" onClick={() => openTransfer(a)} className={button("outline", "sm")}>Ötür</button>

// Panel under the helper rows:
                            {transferFor === a.id && (() => {
                              const free = freePagesOf(a);
                              const canSend = !!transferUid && (transferMode === "juz" || helpPages.length > 0);
                              return (
                                <div className="flex flex-col gap-3 pt-1">
                                  <div role="radiogroup" aria-label="Nə ötürülsün" className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
                                    {([["pages", "Qalan səhifələr"], ["juz", "Bütün cüz"]] as const).map(([v, label]) => (
                                      <button
                                        key={v}
                                        type="button"
                                        role="radio"
                                        aria-checked={transferMode === v}
                                        onClick={() => setTransferMode(v)}
                                        className={`press min-h-[40px] rounded-[10px] text-[13px] ${transferMode === v ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"}`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {transferMode === "pages" ? (
                                    <div className="flex flex-col gap-2">
                                      <p className="m-0 text-xs text-muted">
                                        Seçilən səhifələri dostu oxuyur. Cüz {nameOf(u)} adında qalır və bitəndə ona yazılır; dostun oxuduğu səhifələr dostun hesabına düşür.
                                      </p>
                                      {free.length === 0 ? (
                                        <p className="m-0 text-xs font-semibold text-ink">Verilə biləcək oxunmamış səhifə qalmayıb.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {free.map((p) => {
                                            const on = helpPages.includes(p);
                                            return (
                                              <button
                                                key={p}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => setHelpPages((prev) => on ? prev.filter((x) => x !== p) : [...prev, p].sort((x, y) => x - y))}
                                                className={`press min-w-[48px] min-h-[40px] px-2 rounded-lg text-[13px] font-bold tabular-nums border ${on ? "bg-forest border-forest text-white" : "bg-white border-line text-muted"}`}
                                              >
                                                {p}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="m-0 text-xs text-muted">Cüz tam olaraq seçilən şəxsə keçir və bitəndə onun adına yazılır. Oxunmuş səhifələr {nameOf(u)} adına qalır.</p>
                                  )}
                                  <div className="flex flex-wrap items-end gap-2">
                                    <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                                      {transferMode === "pages" ? "Kim kömək etsin?" : "Kimə ötürülsün?"}
                                      <select value={transferUid} onChange={(e) => setTransferUid(e.target.value)} className={inputCls}>
                                        <option value="">İştirakçı seç...</option>
                                        {activeGroupUsers.filter((m) => m.uid !== u.uid).map((m) => (
                                          <option key={m.uid} value={m.uid}>{nameOf(m)}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <button type="button" disabled={!canSend} onClick={() => handleTransfer(a)} className={btn.primary}>
                                      {transferMode === "pages" ? `${helpPages.length} səhifəni ver` : "Cüzü ötür"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
```
