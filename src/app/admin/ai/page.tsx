"use client";

import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { IconSparkle, LoadingScreen, PageHeader, btn, inputCls } from "@/components/ui";

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
  const { user, loading, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
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
          <p key={index} className="text-xl md:text-2xl leading-loose font-amiri text-forest text-right my-2.5 py-0.5 select-all" dir="rtl">
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
      <div className="flex flex-col gap-5 md:gap-7 h-[calc(100dvh-10rem)] md:h-[calc(100vh-6rem)]">
        <PageHeader title="AI köməkçi" subtitle="Quran ayələri, hədislər və İslam dini barədə suallarını ver." />

        <section className="bg-white border border-line rounded-card flex-1 flex flex-col overflow-hidden min-h-0">
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
                      ? "bg-forest text-cream rounded-tr-md text-sm font-medium"
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
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
              placeholder="Quran ayəsi, hədis və ya dini sual..."
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
