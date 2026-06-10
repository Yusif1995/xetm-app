"use client";

import { useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = user.assignedPages || [];

  return (
    <AppLayout activeTab="settings">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Settings Header */}
        <div className="p-6 islamic-card relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10">
            <h2 className="text-2xl font-amiri font-bold text-[#c9a84c] mb-1">
              Ayarlar və Profil
            </h2>
            <p className="text-xs text-[#fdf6e3]/75 max-w-xl">
              Şəxsi profil məlumatlarınıza baxın və tətbiq tənzimləmələrini buradan idarə edin.
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="islamic-card p-6 shadow-xl relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 space-y-6">
            
            {/* User Avatar + Name */}
            <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-[#c9a84c]/20 pb-6">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.name} 
                  className="w-16 h-16 rounded-full border-2 border-[#c9a84c] shadow"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#1a5c38]/40 border-2 border-[#c9a84c] flex items-center justify-center font-bold text-[#c9a84c] text-xl">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-bold text-[#fdf6e3]">{user.name}</h3>
                <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-semibold uppercase tracking-wider mt-1 inline-block">
                  {user.role === "admin" ? "İnzibatçı (Admin)" : "İştirakçı"}
                </span>
              </div>
            </div>

            {/* Profile Details List */}
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-[#c9a84c]/10">
                <span className="text-[#fdf6e3]/60">E-poçt ünvanı:</span>
                <span className="font-semibold text-[#fdf6e3]/90">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#c9a84c]/10">
                <span className="text-[#fdf6e3]/60">Təyin edilmiş Cüz:</span>
                <span className="font-semibold text-[#c9a84c] font-mono">
                  {user.assignedJuz ? `${user.assignedJuz}-cu cüz` : "Təyin edilməyib"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#c9a84c]/10">
                <span className="text-[#fdf6e3]/60">Səhifə aralığı:</span>
                <span className="font-semibold text-[#fdf6e3]/90 font-mono">
                  {assignedPages.length > 0 
                    ? `${Math.min(...assignedPages)} - ${Math.max(...assignedPages)} (Cəmi ${assignedPages.length} səhifə)`
                    : "Səhifə təyin edilməyib"
                  }
                </span>
              </div>
            </div>

            {/* Admin Shortcut */}
            {user.role === "admin" && (
              <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/30 rounded-xl p-4 mt-6">
                <h4 className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider mb-1">İnzibatçı Modulu</h4>
                <p className="text-[11px] text-[#fdf6e3]/75 mb-4">
                  Sizin inzibatçı statusunuz var. Sistem üzərində səhifə təyini, xətm paylamaları və digər qrup ayarlarını idarə etmək üçün Admin Panelinə keçid edin.
                </p>
                <Link
                  href="/admin"
                  className="inline-block px-4 py-2 bg-[#c9a84c] hover:bg-[#b0913e] text-[#05160c] font-bold rounded-lg text-xs tracking-wide transition-all shadow"
                >
                  Admin Panelinə Keçid
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
