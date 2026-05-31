"use client";

import { useAuth } from "../lib/auth";
import { useState } from "react";

export default function LoginButton() {
  const { loginWithGoogle, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Login component caught error:", err);
      const fbError = err as { code?: string; message?: string };
      const code = fbError?.code || "";
      const message = fbError?.message || "";
      
      if (code === "auth/operation-not-allowed") {
        setError("Giriş uğursuz oldu: Firebase-də Google ilə daxil olma (Google Auth) aktiv deyil. Lütfən Firebase Console-da Authentication bölməsində aktiv edin.");
      } else if (code === "auth/popup-closed-by-user") {
        setError("Giriş pəncərəsi sizin tərəfinizdən bağlandı.");
      } else if (code === "auth/popup-blocked") {
        setError("Brauzeriniz giriş pəncərəsini (pop-up) bloklayıb. Lütfən yuxarı sağ küncdən icazə verin.");
      } else if (message.includes("permission-denied") || code.includes("permission-denied")) {
        setError("Firestore-da icazə xətası (permission-denied): Lütfən Firestore verilənlər bazasının aktiv olduğundan və təhlükəsizlik qaydalarının (firestore.rules) kopyalandığından əmin olun.");
      } else {
        setError(`Xəta baş verdi (${code || "Unknown"}): ${message || err}`);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#c9a84c] hover:bg-[#b0913e] text-[#1a1a2e] font-semibold rounded-lg shadow-lg hover:shadow-[#c9a84c]/20 transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg border-2 border-[#fdf6e3]/10"
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5 text-[#1a1a2e]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 fill-[#1a1a2e]" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>Google ilə daxil ol</span>
      </button>
      {error && (
        <p className="mt-3 text-xs md:text-sm text-red-400 font-medium text-center bg-red-950/20 px-4 py-3 rounded border border-red-500/25 w-full leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
