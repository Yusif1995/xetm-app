"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";

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
  const { user, loading } = useAuth();
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Süni İntellekt Köməkçisi yüklənir...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null; // Guarded by middleware
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

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
            <strong key={partIdx} className="font-bold text-[#c9a84c]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (isListItem) {
        return (
          <li key={index} className="ml-4 list-disc text-xs leading-relaxed text-[#fdf6e3]/90 my-0.5">
            {content}
          </li>
        );
      }

      const hasArabic = /[\u0600-\u06FF]/.test(line);
      if (hasArabic) {
        return (
          <p key={index} className="text-lg md:text-xl leading-loose font-amiri text-[#c9a84c] text-center my-2.5 py-0.5 font-semibold select-all" dir="rtl">
            {content}
          </p>
        );
      }

      return (
        <p key={index} className="text-xs leading-relaxed text-[#fdf6e3]/95 my-1 min-h-[0.25rem]">
          {content}
        </p>
      );
    });
  };

  return (
    <AppLayout activeTab="ai">
      <div className="space-y-6 max-w-4xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col">
        {/* Page Header */}
        <div className="p-4 islamic-card shrink-0 relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 flex items-center gap-3">
            <svg className="w-8 h-8 text-[#c9a84c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" fill="currentColor" fillOpacity="0.15" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
            <div>
              <h2 className="text-lg font-amiri font-bold text-[#c9a84c] leading-none">
                Süni İntellekt Köməkçisi
              </h2>
              <p className="text-[10px] text-[#fdf6e3]/60 font-sans mt-1">
                Quran ayələri, hədislər və İslam dini barədə öyrənmək istədiyiniz sualları ünvanlayın.
              </p>
            </div>
          </div>
        </div>

        {/* Chat Card Box */}
        <div className="islamic-card flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          
          <div className="relative z-10 flex flex-col h-full w-full overflow-hidden bg-[#05180d]/40">
            {/* Chat History */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-[#c9a84c]/20 bg-[#05180d]/60">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/20 flex items-center justify-center font-bold text-[#c9a84c] text-[10px] shrink-0 self-start mt-0.5">
                      🕋
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-[#c9a84c]/90 to-[#b0913e]/90 text-[#0b301a] rounded-tr-none font-semibold text-xs"
                        : "bg-[#05180d]/80 border border-[#c9a84c]/20 text-[#fdf6e3] rounded-tl-none"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="space-y-1">{parseMessageText(msg.content)}</div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center font-bold text-[#c9a84c] text-[9px] shrink-0 self-start mt-0.5">
                      👤
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex w-full gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/20 flex items-center justify-center font-bold text-[#c9a84c] text-[10px] shrink-0">
                    🕋
                  </div>
                  <div className="bg-[#05180d]/80 border border-[#c9a84c]/20 text-[#fdf6e3] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                    <span className="text-[10px] text-[#fdf6e3]/70 font-medium animate-pulse">Düşünür</span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] rounded-xl text-center">
                  ⚠️ {error}
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length === 1 && !isSending && (
              <div className="p-3 border-t border-[#c9a84c]/10 bg-[#05180d]/85 shrink-0">
                <span className="text-[9px] text-[#c9a84c] uppercase tracking-wider font-bold block mb-1.5">
                  Hazır Sorğular:
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug.prompt)}
                      className="p-2 text-left bg-[#05180d]/60 hover:bg-[#1a5c38]/20 border border-[#c9a84c]/20 hover:border-[#c9a84c]/40 rounded-lg transition-all group flex flex-col justify-between"
                    >
                      <span className="text-[10px] font-bold text-[#c9a84c] block line-clamp-1 group-hover:text-[#fdf6e3]">
                        {sug.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleFormSubmit} className="p-3 border-t border-[#c9a84c]/15 bg-[#05180d]/90 flex gap-2 shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Quran ayəsi, hədis və ya dini sual..."
                disabled={isSending}
                className="flex-1 bg-[#05180d]/80 border border-[#c9a84c]/30 focus:border-[#c9a84c] rounded-xl px-3 py-2.5 text-xs text-[#fdf6e3] placeholder-[#fdf6e3]/40 focus:outline-none transition-all disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="bg-[#c9a84c] hover:bg-[#b0913e] disabled:bg-[#c9a84c]/40 disabled:text-[#0b301a]/60 text-[#0b301a] font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center shrink-0"
              >
                Göndər
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
