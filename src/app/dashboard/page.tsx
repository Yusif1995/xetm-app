"use client";

import { useAuth } from "@/lib/auth";
import { getGlobalSettings, type AppSettings } from "@/lib/db";
import PageCard from "@/components/PageCard";
import Link from "next/link";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function DashboardPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [showDua, setShowDua] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ completedKhatms: 0 });

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Sync state with user doc when it loads
  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
    }
  }, [user]);

  // Load settings and PWA logic
  useEffect(() => {
    async function loadSettings() {
      try {
        const appSettings = await getGlobalSettings();
        setSettings(appSettings);
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }
    loadSettings();

    // Check if running in standalone display mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (('standalone' in window.navigator) && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt on Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Bu brauzer avtomatik quraşdırmağı dəstəkləmir. Brauzerinizin menyusundan 'Ana ekrana əlavə et' seçə bilərsiniz.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Məlumatlar yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = user.assignedPages || [];
  // Ensure we only count completed pages that are actually assigned
  const activeCompleted = completedPagesState.filter(p => assignedPages.includes(p));

  // Group pages into chunks of 5
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const pageChunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += 5) {
    pageChunks.push(sortedPages.slice(i, i + 5));
  }

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  const handleStatusChange = (pageNumbers: number[], isCompleted: boolean) => {
    if (isCompleted) {
      setCompletedPagesState(prev => {
        const next = [...prev];
        pageNumbers.forEach(p => {
          if (!next.includes(p)) {
            next.push(p);
          }
        });
        return next;
      });
    } else {
      setCompletedPagesState(prev => prev.filter(p => !pageNumbers.includes(p)));
    }
    // Also trigger user doc refresh in auth context in background
    refreshUser();
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen islamic-bg">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#0b301a]/95 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Rub el Hizb logo decoration */}
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#0b301a] rounded-full z-10"></div>
            </div>
            <h1 className="text-xl md:text-2xl font-amiri font-bold text-[#fdf6e3]">
              Quran Xətm İzləyicisi
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {/* User Profile Info */}
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-[#c9a84c]/30 shadow"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/30 flex items-center justify-center font-bold text-[#c9a84c] text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs md:text-sm font-semibold text-[#fdf6e3]/90">{user.name}</span>
            </div>

            {/* Navigation links */}
            <nav className="flex items-center gap-2.5">
              <Link
                href="/progress"
                className="px-3 py-1.5 bg-[#1a5c38]/20 hover:bg-[#1a5c38]/40 border border-[#1a5c38]/40 hover:border-[#1a5c38] text-[#fdf6e3]/90 text-xs font-semibold rounded-lg transition-all"
              >
                Gedişat Cədvəli
              </Link>

              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 bg-[#c9a84c]/15 hover:bg-[#c9a84c] border border-[#c9a84c]/30 hover:border-[#c9a84c] text-[#c9a84c] hover:text-[#0b301a] text-xs font-semibold rounded-lg transition-all"
                >
                  Admin Panel
                </Link>
              )}

              <button
                onClick={logout}
                className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all"
              >
                Çıxış
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        {/* PWA Install Banner */}
        {!isStandalone && (
          <div className="mb-6 p-4 islamic-card flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <span className="text-2xl md:text-3xl">📱</span>
                <div>
                  <h4 className="text-sm md:text-base font-bold text-[#c9a84c] font-amiri">Tətbiqi Ana Ekrana Əlavə Edin</h4>
                  <p className="text-[11px] md:text-xs text-[#fdf6e3]/75">
                    Uygulama kimi sürətli daxil olmaq və daha rahat istifadə etmək üçün ana ekrana əlavə edin.
                  </p>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 islamic-btn-gold rounded-lg transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto text-xs"
              >
                📥 Ana Ekrana Əlavə Et
              </button>
            </div>
          </div>
        )}

        {/* Welcome Card banner */}
        <div className="mb-8 p-6 islamic-card relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 flex flex-col">
            <h2 className="text-2xl md:text-3xl font-amiri font-bold text-[#c9a84c] mb-1">
              Salam, {user.name}!
            </h2>
            <p className="text-sm text-[#fdf6e3]/75 max-w-xl">
              Sizin üçün təyin edilmiş Quran səhifələrini aşağıdakı siyahıdan izləyə bilərsiniz. Oxuduğunuz hər bir səhifəni işarələməyi unutmayın.
            </p>
          </div>
        </div>

        {/* Assigned Pages validation */}
        {assignedPages.length === 0 ? (
          <div className="text-center py-16 px-6 islamic-card max-w-2xl mx-auto flex flex-col items-center">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col items-center w-full">
              <span className="text-5xl mb-4">🕋</span>
              <h3 className="text-lg md:text-xl font-semibold text-[#fdf6e3] mb-2">Səhifə təyin edilməyib</h3>
              <p className="text-sm text-[#fdf6e3]/60 leading-relaxed mb-6 max-w-md">
                Hörmətli iştirakçı, hazırda sizə oxumaq üçün heç bir səhifə təyin edilməyib. İnzibatçı səhifə təyin edən kimi səhifələriniz burada görünəcək.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <Link
                  href="/progress"
                  className="px-4 py-2 bg-[#c9a84c]/20 hover:bg-[#c9a84c]/30 text-[#c9a84c] border border-[#c9a84c]/40 font-semibold rounded-lg transition-all text-sm shadow"
                >
                  Ümumi gedişata baxın
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Date Range Banner */}
            {user.assignmentStartDate && user.assignmentEndDate && (
              <div className="p-4 bg-[#0b301a]/40 border border-[#c9a84c]/25 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-fadeIn">
                <div>
                  <span className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider block">Oxuma Müddətiniz</span>
                  <span className="text-[10px] text-[#fdf6e3]/50">Bu tarixlər ərzində sizə təyin olunmuş cüzü oxuyub bitirməlisiniz.</span>
                </div>
                <span className="text-xs md:text-sm font-extrabold text-[#fdf6e3] font-mono bg-[#05180d] px-3 py-1.5 rounded-lg border border-[#c9a84c]/20 self-start sm:self-auto">
                  📅 {formatDateDisplay(user.assignmentStartDate)} — {formatDateDisplay(user.assignmentEndDate)}
                </span>
              </div>
            )}

            {/* Juz 30 & Khatm Dua Banner */}
            {user.assignedJuz === 30 && (
              <div className="p-5 islamic-card space-y-4 animate-fadeIn">
                <div className="islamic-card-inner" />
                <div className="islamic-pattern" />
                <div className="relative z-10 space-y-4 w-full">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📖</span>
                    <div>
                      <h4 className="text-sm md:text-base font-bold text-[#c9a84c] font-amiri">30-cu Cüz və Xətm Duası</h4>
                      <p className="text-[11px] text-[#fdf6e3]/75">
                        Sizə Quranın sonuncu (30-cu) cüzü təyin edilmişdir. Zəhmət olmasa 24 səhifəni bitirdikdən sonra **Xətm Duasını** oxuyun.
                      </p>
                    </div>
                  </div>
                  
                  <div className="border border-[#c9a84c]/25 rounded-lg overflow-hidden bg-[#05180d]/80">
                    <button
                      onClick={() => setShowDua(!showDua)}
                      className="w-full px-4 py-2.5 flex justify-between items-center text-xs font-bold text-[#c9a84c] hover:bg-[#c9a84c]/5 transition-all focus:outline-none"
                    >
                      <span>{showDua ? "Xətm Duasını Gizlə" : "Xətm Duasını Oxu"}</span>
                      <span>{showDua ? "▲" : "▼"}</span>
                    </button>
                    {showDua && (
                      <div className="p-4 space-y-3 border-t border-[#c9a84c]/20 text-center font-amiri text-[#fdf6e3]">
                        <div className="text-xl md:text-2xl leading-loose text-[#c9a84c] py-2" dir="rtl">
                          صَدَقَ اللهُ الْعَلِيُّ الْعَظِيمُ، وَبَلَّغَ رَسُولُهُ النَّبِيُّ الْكَرِيمُ، وَنَحْنُ عَلَى ذَلِكَ مِنَ الشَّاهِدِينَ وَالشَّاكِرِينَ. اَللَّهُمَّ انْفَعْنَا وَارْفَعْنَا بِالْقُرْآنِ الْعَظِيمِ، وَبَارِkْ لَنَا بِالآيَاتِ وَالذِّكْرِ الْحَكِيمِ. اَللَّهُمَّ اجْعَلْهُ لَنَا إِمَاماً وَنُوراً وَهُدًى وَرَحْمَةً. اَللَّهُمَّ ذَكِّرْنَا مِنْهُ مَا نَسِينَا، وَعَلِّمْنَا مِنْهُ مَا جَهِلْنَا، وَارْزُقْنَا تِلاَوَتَهُ آنَاءَ اللَّيْلِ وَأَطْرَافَ النَّهَارِ، وَاجْعَلْهُ لَنَا حُجَّةً يَا رَبَّ الْعَالَمِينَ.
                        </div>
                        <div className="text-[11px] md:text-xs font-sans italic text-[#fdf6e3]/70 border-t border-[#c9a84c]/20 pt-3 leading-relaxed">
                          &quot;Uca və Əzəmətli Allah doğru söylədi! Onun şərəfli Peyğəmbər elçisi bunu təbliğ etdi. Biz də buna şahidlik edənlərdən və şükr edənlərdənik. Allahım! Qurani-Kərim ilə bizə fayda ver, bizi ucalt, ayələr və hikmətli zikr ilə bizə bərəkət bəxş et. Allahım! Quranı bizim üçün rəhbər, nur, doğru yol göstərən və rəhmət et. Allahım! Ondan unutduqlarımızı yadımıza sal, bilmədiklərimizi öyrət, gecənin bəzi saatlarında və günün hər iki tərəfində onu oxumağı bizə nəsib et. Ey aləmlərin Rəbbi, onu bizim xeyrimizə dəlil et!&quot;
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Progress metrics */}
            <div className="islamic-card p-6">
              <div className="islamic-card-inner" />
              <div className="islamic-pattern" />
              <div className="relative z-10 w-full">
                <h3 className="text-xs font-bold text-[#c9a84c] mb-4 uppercase tracking-wider">
                  Şəxsi Oxuma Gedişatınız
                </h3>
                {/* Personal Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#c9a84c]/20">
                  <div className="p-4 bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-xl text-center shadow-sm">
                    <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Mənim Tamamlanan Səhifələrim</span>
                    <div className="text-2xl font-extrabold text-[#fdf6e3] mt-1 font-mono">
                      {activeCompleted.length} / {assignedPages.length}
                    </div>
                  </div>
                  <div className="p-4 bg-[#1a5c38]/20 border border-[#c9a84c]/25 rounded-xl text-center shadow-md">
                    <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Qrup Üzrə Tamamlanan Xətmlər</span>
                    <div className="text-2xl font-extrabold text-[#c9a84c] mt-1 font-mono">
                      {settings.completedKhatms || 0} xətm
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid of assigned pages */}
            <div>
              <h3 className="text-lg font-bold text-[#fdf6e3] mb-4 flex items-center gap-2.5">
                <span>Mənim Səhifələrim</span>
                <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
                  {assignedPages.length} səhifə
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pageChunks.map((chunk) => (
                  <PageCard
                    key={chunk.join(",")}
                    userId={user.uid}
                    pageNumbers={chunk}
                    initialCompleted={chunk.every((page) => completedPagesState.includes(page))}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a2e]/85 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a2e] border border-[#c9a84c]/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <h3 className="text-base md:text-lg font-bold text-[#c9a84c] font-amiri">iPhone / iPad üçün Quraşdırma</h3>
            <div className="space-y-3 text-xs text-[#fdf6e3]/85 text-left bg-[#1a1a2e]/60 p-4 rounded-xl border border-[#c9a84c]/10">
              <p className="flex items-start gap-2">
                <span className="bg-[#c9a84c]/20 text-[#c9a84c] w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">1</span>
                <span>Safari brauzerinin altındakı **Paylaş (Share)** 📤 düyməsinə klikləyin.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-[#c9a84c]/20 text-[#c9a84c] w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">2</span>
                <span>Açılan menyudan aşağı enərək **Ana Ekrana Əlavə Et (Add to Home Screen)** ➕ seçin.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="bg-[#c9a84c]/20 text-[#c9a84c] w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">3</span>
                <span>Sağ üst küncdəki **Əlavə et (Add)** düyməsinə klikləyin.</span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full px-4 py-2 bg-[#1a5c38] hover:bg-[#1a5c38]/80 text-[#fdf6e3] border border-[#c9a84c]/30 font-semibold rounded-lg text-xs transition-all"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
