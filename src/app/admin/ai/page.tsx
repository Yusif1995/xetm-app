"use client";

import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import AppLayout from "@/components/AppLayout";
import { setGroupSettings } from "@/lib/db";
import { bakuDateKey, dailyContent } from "@/lib/dailyContent";
import { Card, IconSparkle, LoadingScreen, PageHeader, btn, inputCls } from "@/components/ui";

// Asked of the assistant when the owner wants today's ayah and hadith written for the group
const DAILY_PROMPT =
  "Bu gün qrupumuz üçün bir Quran ayəsi və bir səhih hədis seç. Cavabı yalnız bu formatda ver, başqa heç nə yazma:\n" +
  "AYƏ:\n<ayənin ərəbcə mətni>\n<Azərbaycan dilində tərcüməsi> (<surə adı>, <ayə nömrəsi>)\n" +
  "HƏDİS:\n<hədisin Azərbaycan dilində mətni> (<mənbə və nömrə>)";

// Splits "AYƏ: ... HƏDİS: ..." into the two fields
function splitDailyReply(reply: string): { ayah: string; hadith: string } | null {
  const m = reply.match(/AY[ƏE]\s*:\s*([\s\S]*?)\s*H[ƏE]D[İI]S\s*:\s*([\s\S]*)$/i);
  if (!m) return null;
  const clean = (t: string) => t.replace(/\*\*/g, "").trim();
  return { ayah: clean(m[1]), hadith: clean(m[2]) };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  { label: "Səbr haqqında ayə gətir", prompt: "Mənə səbr və çətinliklər qarşısında dözümlü olmaq haqqında bir Quran ayəsi (ərəbcə orijinalı, Azərbaycan dilində tərcüməsi və surə adı ilə) gətir." },
  { label: "Elm haqqında hədis yaz", prompt: "Mənə elmin fəziləti haqqında mötəbər bir hədis (ərəbcə orijinalı, Azərbaycan dilində tərcüməsi və mənbəsi ilə) yaz." },
  { label: "İnşirah surəsinin təfsiri", prompt: "İnşirah (Şərh) surəsinin ümumi mənası və bizə verdiyi nəsihətlər haqqında qısa məlumat verə bilərsən?" },
  { label: "Valideynə hörmət", prompt: "Quran və hədislərdə valideynə yaxşılıq etmək və onlara hörmətlə yanaşmaq barədə nə buyurulub?" }
];

export default function AiPage() {
  const { user, loading, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  // Today's ayah and hadith for the group (saved for today only; the app rotates them otherwise)
  const [dailyAyah, setDailyAyah] = useState("");
  const [dailyHadith, setDailyHadith] = useState("");
  const [savedDate, setSavedDate] = useState("");
  const [dailyBusy, setDailyBusy] = useState<"idle" | "writing" | "saving">("idle");
  const [dailyStatus, setDailyStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Salam aleykum! Mən sizin Süni İntellekt Köməkçinizəm. Məndən Quran ayələri, mötəbər hədislər və İslam dini barəsində öyrənmək istədiyiniz mövzuları soruşa bilərsiniz. Sizə necə kömək edim?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load what the group saved; prefill with today's automatic pick when nothing is saved for today
  useEffect(() => {
    if (!activeGroupId || activeGroupId === "default") return;
    return onSnapshot(doc(db, "groups", activeGroupId), (snap) => {
      const data = snap.data() || {};
      const today = bakuDateKey();
      setSavedDate(data.dailyDate || "");
      if (data.dailyDate === today) {
        setDailyAyah(data.currentAyah || "");
        setDailyHadith(data.currentHadith || "");
      } else {
        const auto = dailyContent();
        setDailyAyah((v) => v || `${auto.ayah.text}\n${auto.ayah.translation} (${auto.ayah.source})`);
        setDailyHadith((v) => v || `${auto.hadith.translation} (${auto.hadith.source})`);
      }
    });
  }, [activeGroupId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (loading || !activeGroupLoaded) {
    return <LoadingScreen text="Süni İntellekt Köməkçisi yüklənir..." />;
  }

  if (!user || !(isSuperAdmin || activeGroup?.createdBy === user.uid)) {
    return null;
  }

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    setError(null);
    const userMessageId = Math.random().toString(36).substring(7);
    const userMessage: Message = {
      id: userMessageId,
      role: "user",
      content: textToSend
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const history = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken || ""}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Serverdə xəta baş verdi.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          content: data.reply
        }
      ]);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Cavab alarkən xəta baş verdi. Yenidən cəhd edin.";
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const savedToday = savedDate === bakuDateKey();

  const handleWriteDaily = async () => {
    setDailyBusy("writing");
    setDailyStatus(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
        body: JSON.stringify({ messages: [{ role: "user", content: DAILY_PROMPT }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI cavab vermədi.");
      const parts = splitDailyReply(String(data.reply || ""));
      if (!parts) throw new Error("AI cavabı gözlənilən formatda deyil. Yenidən cəhd et və ya mətni əl ilə yaz.");
      setDailyAyah(parts.ayah);
      setDailyHadith(parts.hadith);
      setDailyStatus({ tone: "ok", text: "AI yazdı. Yoxla, istəsən düzəlt və yadda saxla." });
    } catch (err) {
      setDailyStatus({ tone: "error", text: err instanceof Error ? err.message : "AI ilə yazmaq alınmadı." });
    } finally {
      setDailyBusy("idle");
    }
  };

  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId || activeGroupId === "default") return;
    setDailyBusy("saving");
    setDailyStatus(null);
    try {
      await setGroupSettings({ currentAyah: dailyAyah.trim(), currentHadith: dailyHadith.trim(), dailyDate: bakuDateKey() }, activeGroupId);
      setDailyStatus({ tone: "ok", text: "Yadda saxlanıldı. Bu gün qrupun \"Bu gün\" panelində görünəcək." });
    } catch (err) {
      console.error("Error saving daily text:", err);
      setDailyStatus({ tone: "error", text: "Yadda saxlamaq alınmadı. Yenidən cəhd et." });
    } finally {
      setDailyBusy("idle");
    }
  };

  const handleResetDaily = async () => {
    if (!activeGroupId || activeGroupId === "default") return;
    setDailyBusy("saving");
    setDailyStatus(null);
    try {
      await setGroupSettings({ dailyDate: "" }, activeGroupId);
      const auto = dailyContent();
      setDailyAyah(`${auto.ayah.text}\n${auto.ayah.translation} (${auto.ayah.source})`);
      setDailyHadith(`${auto.hadith.translation} (${auto.hadith.source})`);
      setDailyStatus({ tone: "ok", text: "Avtomatik seçimə qayıdıldı." });
    } catch (err) {
      console.error("Error resetting daily text:", err);
      setDailyStatus({ tone: "error", text: "Alınmadı. Yenidən cəhd et." });
    } finally {
      setDailyBusy("idle");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const parseMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, index) => {
      const isListItem = line.trim().startsWith("- ") || line.trim().startsWith("* ");
      const cleanLine = isListItem ? line.replace(/^[\s*-]+/, "") : line;

      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const content = parts.map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={partIdx} className="font-bold text-forest">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (isListItem) {
        return (
          <li key={index} className="ml-4 list-disc text-sm leading-relaxed text-ink my-0.5">
            {content}
          </li>
        );
      }

      const hasArabic = /[\u0600-\u06FF]/.test(line);
      if (hasArabic) {
        return (
          <p key={index} className="text-xl md:text-2xl leading-loose font-amiri text-ink text-right my-2.5 py-0.5 select-all" dir="rtl">
            {content}
          </p>
        );
      }

      return (
        <p key={index} className="text-sm leading-relaxed text-ink my-1 min-h-[0.25rem]">
          {content}
        </p>
      );
    });
  };

  return (
    <AppLayout activeTab="ai">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader title="AI köməkçi" subtitle="Günün ayə və hədisini yaz, Quran və hədislər barədə suallarını ver." />

        {activeGroupId && activeGroupId !== "default" && (
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base md:text-lg font-bold text-ink">Günün ayəsi və hədisi</h2>
              <span className="text-[13px] text-muted">{savedToday ? "Bu gün üçün yadda saxlanılıb" : "Avtomatik seçim göstərilir"}</span>
            </div>
            <p className="m-0 text-sm leading-relaxed text-muted">
              Ayə və hədis hər gün avtomatik dəyişir. Burada yazıb yadda saxladığın mətn yalnız bu gün qrupun &quot;Bu gün&quot; panelində onların yerinə göstərilir.
            </p>
            <form onSubmit={handleSaveDaily} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                Günün ayəsi
                <textarea value={dailyAyah} onChange={(e) => setDailyAyah(e.target.value)} rows={4} dir="auto" className={`${inputCls} py-3 resize-y leading-relaxed`} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                Günün hədisi
                <textarea value={dailyHadith} onChange={(e) => setDailyHadith(e.target.value)} rows={3} className={`${inputCls} py-3 resize-y leading-relaxed`} />
              </label>
              {dailyStatus && (
                <div role={dailyStatus.tone === "error" ? "alert" : "status"} className={`text-sm font-semibold ${dailyStatus.tone === "error" ? "text-danger" : "text-donetext"}`}>
                  {dailyStatus.text}
                </div>
              )}
              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                <button type="button" onClick={handleWriteDaily} disabled={dailyBusy !== "idle"} className={btn.outline}>
                  <IconSparkle size={18} />
                  {dailyBusy === "writing" ? "AI yazır..." : "AI ilə yaz"}
                </button>
                <button type="submit" disabled={dailyBusy !== "idle" || !dailyAyah.trim()} className={btn.primary}>
                  {dailyBusy === "saving" ? "Yadda saxlanılır..." : "Bu gün üçün yadda saxla"}
                </button>
                {savedToday && (
                  <button type="button" onClick={handleResetDaily} disabled={dailyBusy !== "idle"} className={btn.ghostDark}>
                    Avtomatik seçimə qayıt
                  </button>
                )}
              </div>
            </form>
          </Card>
        )}

        <section className="bg-white border border-line rounded-card shadow-card h-[70dvh] min-h-[420px] flex flex-col overflow-hidden">
          {/* Chat history */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-9 h-9 rounded-full bg-mint text-forest flex items-center justify-center shrink-0 self-start">
                    <IconSparkle size={18} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-forest text-white rounded-tr-md text-sm font-medium"
                      : "bg-cream border border-line text-ink rounded-tl-md"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="m-0 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="flex flex-col gap-1">{parseMessageText(msg.content)}</div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex w-full gap-2.5 justify-start">
                <div className="w-9 h-9 rounded-full bg-mint text-forest flex items-center justify-center shrink-0">
                  <IconSparkle size={18} />
                </div>
                <div className="bg-cream border border-line rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
                  <span className="text-sm text-muted animate-pulse">Düşünür</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-[#FBEAE5] border border-dangerline text-danger text-sm rounded-btn text-center">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && !isSending && (
            <div className="px-4 md:px-6 py-3 border-t border-sand shrink-0 flex flex-col gap-2">
              <span className="text-xs font-bold text-goldtext">Hazır sorğular</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sug.prompt)}
                    className="min-h-[44px] px-3 text-left bg-cream hover:bg-sand border border-line rounded-xl text-sm font-semibold text-forest transition-colors"
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleFormSubmit} className="p-3 md:p-4 border-t border-sand flex gap-2.5 shrink-0">
            <label className="sr-only" htmlFor="ai-input">Sorğun</label>
            <input
              id="ai-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sualını yaz…"
              disabled={isSending}
              className={`${inputCls} flex-1 disabled:opacity-60`}
            />
            <button type="submit" disabled={isSending || !input.trim()} className={btn.primary}>
              Göndər
            </button>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
