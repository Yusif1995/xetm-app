"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  { label: "Səbr haqqında ayə gətir", prompt: "Mənə səbr və çətinliklər qarşısında dözümlü olmaq haqqında bir Quran ayəsi (ərəbcə orijinalı, Azərbaycan dilində tərcüməsi və surə adı ilə) gətir." },
  { label: "Elm haqqında hədis yaz", prompt: "Mənə elm öyrənməyin fəziləti haqqında mötəbər bir hədis (ərəbcə orijinalı, Azərbaycan dilində tərcüməsi və mənbəsi ilə) yaz." },
  { label: "İnşirah surəsinin təfsiri", prompt: "İnşirah (Şərh) surəsinin ümumi mənası və bizə verdiyi nəsihətlər haqqında qısa məlumat verə bilərsən?" },
  { label: "Valideynə hörmət", prompt: "Quran və hədislərdə valideynə yaxşılıq etmək və onlara hörmətlə yanaşmaq barədə nə buyurulub?" }
];

export default function AiChatWidget() {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending, isOpen]);

  // Don't render the widget if the user is not authenticated or loading
  if (loading || !user) {
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

  // Helper parser to render text beautifully with Arabic styling
  const parseMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, index) => {
      // Check for list item
      const isListItem = line.trim().startsWith("- ") || line.trim().startsWith("* ");
      const cleanLine = isListItem ? line.replace(/^[\s*-]+/, "") : line;

      // Parse bold markdown "**text**"
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

      // Check for Arabic characters
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
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="AI Köməkçi"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-[#c9a84c] to-[#b0913e] text-[#0b301a] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border border-[#c9a84c]/40 group"
      >
        <span className="text-2xl transition-transform duration-300 group-hover:rotate-12">
          {isOpen ? "✖" : "🤖"}
        </span>
        {/* Subtle Pulse Ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-[#c9a84c]/60 animate-ping opacity-75 pointer-events-none"></span>
        )}
      </button>

      {/* Floating Chat Container */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] md:w-[420px] h-[550px] max-h-[70vh] flex flex-col overflow-hidden animate-fadeIn">
          <div className="islamic-card flex-1 flex flex-col h-full w-full relative">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col h-full w-full overflow-hidden">
            {/* Widget Header */}
            <div className="bg-[#0b301a]/60 border-b border-[#c9a84c]/20 p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center relative">
                  <div className="absolute w-6 h-6 bg-[#c9a84c] rotate-0 rounded-sm"></div>
                  <div className="absolute w-6 h-6 bg-[#c9a84c] rotate-45 rounded-sm"></div>
                  <div className="absolute w-1.5 h-1.5 bg-[#0b301a] rounded-full z-10"></div>
                </div>
                <div>
                  <h3 className="text-sm font-amiri font-bold text-[#fdf6e3] leading-none">AI Köməkçi</h3>
                  <span className="text-[9px] text-[#c9a84c] font-semibold uppercase tracking-wider">İslam AI Assistant</span>
                </div>
              </div>
              
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#fdf6e3]/60 hover:text-[#fdf6e3] text-sm p-1 transition-colors focus:outline-none"
              >
                ✖
              </button>
            </div>

            {/* Chat History Area */}
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

              {/* Typing indicator */}
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

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] rounded-xl text-center">
                  ⚠️ {error}
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompts (only visible when chat starts and not sending) */}
            {messages.length === 1 && !isSending && (
              <div className="p-3 border-t border-[#c9a84c]/10 bg-[#05180d]/80 shrink-0">
                <span className="text-[9px] text-[#c9a84c] uppercase tracking-wider font-bold block mb-1.5">
                  Hazır Sorğular
                </span>
                <div className="grid grid-cols-2 gap-1.5">
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

            {/* Message Input Box */}
            <form onSubmit={handleFormSubmit} className="p-3 border-t border-[#c9a84c]/15 bg-[#05180d]/90 flex gap-2 shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Quran ayəsi, hədis və ya mövzu..."
                disabled={isSending}
                className="flex-1 bg-[#05180d]/80 border border-[#c9a84c]/30 focus:border-[#c9a84c] rounded-xl px-3 py-2 text-xs text-[#fdf6e3] placeholder-[#fdf6e3]/40 focus:outline-none transition-all disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="bg-[#c9a84c] hover:bg-[#b0913e] disabled:bg-[#c9a84c]/40 disabled:text-[#0b301a]/60 text-[#0b301a] font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center justify-center shrink-0"
              >
                ➔
              </button>
            </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
