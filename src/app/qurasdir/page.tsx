"use client";
// Public step-by-step guide: adding Xətm to the home screen on iPhone (Safari) and Android (Chrome).
// Each step pairs a short instruction with a drawn phone screen that marks where to tap.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo, btn } from "@/components/ui";

type Platform = "ios" | "android";

// Chrome on Android offers its own install prompt; we keep it to show a one-tap button
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SITE = "xetm-app.onrender.com";

export default function InstallGuidePage() {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [standalone, setStandalone] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/android/i.test(ua) ? "android" : "ios");
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };

  const steps = platform === "ios" ? IOS_STEPS : ANDROID_STEPS;

  return (
    <main className="min-h-screen bg-cream text-ink px-4 py-8 md:px-10 md:py-12">
      <div className="max-w-[960px] mx-auto flex flex-col gap-6 md:gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] bg-tile flex items-center justify-center"><Logo /></div>
            <span className="font-extrabold text-[22px] tracking-[-0.01em]">Xətm</span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-extrabold text-[30px] md:text-[40px] leading-[1.1] tracking-[-0.02em]">
              Xətm-i telefonun ana ekranına əlavə et
            </h1>
            <p className="m-0 max-w-[60ch] text-[15px] md:text-base leading-relaxed text-muted">
              Ana ekrana əlavə edəndə Xətm adi tətbiq kimi açılır, ünvan sətri olmadan tam ekran işləyir və bildirişlər gəlir.
              Telefonuna uyğun bölməni seç və addımları ardıcıl et.
            </p>
          </div>
        </header>

        {(standalone || installed) && (
          <div role="status" className="rounded-card bg-donebg text-donetext px-5 py-4 text-[15px] font-semibold">
            Xətm artıq ana ekrandadır. Tətbiqi oradakı ikondan aç.
          </div>
        )}

        <div role="tablist" aria-label="Telefon növü" className="grid grid-cols-2 gap-1 p-1 rounded-[16px] bg-sand max-w-md">
          {(["ios", "android"] as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={platform === p}
              onClick={() => setPlatform(p)}
              className={`press min-h-[48px] rounded-[12px] text-[15px] ${
                platform === p ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"
              }`}
            >
              {p === "ios" ? "iPhone" : "Android"}
            </button>
          ))}
        </div>

        {platform === "android" && installEvent && !installed && (
          <section className="bg-white border border-line rounded-card shadow-card p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[15px] leading-relaxed text-ink flex-[1_1_240px]">
              Telefonun bir toxunuşla quraşdırmağa icazə verir. Addımlara ehtiyac yoxdur.
            </p>
            <button type="button" onClick={handleInstall} className={`${btn.primary} w-full sm:w-auto`}>İndi quraşdır</button>
          </section>
        )}

        {platform === "ios" && (
          <p className="m-0 rounded-card bg-progress text-progresstext px-5 py-4 text-[14px] leading-relaxed">
            <strong>Vacib:</strong> iPhone-da bunu yalnız <strong>Safari</strong> ilə etmək olur. Link WhatsApp-da açılıbsa, aşağı-sağdakı
            kompas ikonuna və ya <strong>•••</strong> menyusunda <strong>“Safari-də aç”</strong> seçiminə toxun.
          </p>
        )}

        <ol className="m-0 p-0 list-none flex flex-col gap-4 md:gap-5">
          {steps.map((step, i) => (
            <li key={step.title} className="bg-white border border-line rounded-card shadow-card p-5 md:p-7 flex flex-col sm:flex-row gap-5 md:gap-8 items-start">
              <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-forest text-white font-extrabold text-[15px] flex items-center justify-center shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  <h2 className="m-0 text-lg md:text-xl font-bold text-ink">{step.title}</h2>
                </div>
                <div className="text-[15px] leading-relaxed text-ink flex flex-col gap-2">{step.body}</div>
              </div>
              <div className="w-full sm:w-[200px] shrink-0 flex justify-center">
                <Phone>{step.screen}</Phone>
              </div>
            </li>
          ))}
        </ol>

        <section className="bg-white border border-line rounded-card shadow-card p-5 md:p-7 flex flex-col gap-3">
          <h2 className="m-0 text-lg md:text-xl font-bold">Bildirişləri aç</h2>
          <p className="m-0 text-[15px] leading-relaxed text-ink">
            Xətm-i ana ekrandakı ikondan aç, daxil ol və <strong>“Bu gün”</strong> panelinin yuxarısındakı <strong>zəng</strong> düyməsinə toxun.
            Sonra <strong>“İcazə ver”</strong> seç. iPhone-da bildirişlər yalnız ana ekrandan açılan tətbiqdə işləyir.
          </p>
        </section>

        <Link href="/" className={`${btn.primary} self-start`}>Xətm-ə keç</Link>
      </div>
    </main>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-md bg-sand px-1.5 py-0.5 font-bold text-ink">{children}</span>;
}

function Alt({ children }: { children: ReactNode }) {
  return <span className="block text-[13px] text-muted">{children}</span>;
}

interface Step {
  title: string;
  body: ReactNode;
  screen: ReactNode;
}

const IOS_STEPS: Step[] = [
  {
    title: "Safari-də saytı aç",
    body: (
      <>
        <p className="m-0">Safari-də <Label>{SITE}</Label> ünvanını aç və daxil ol.</p>
      </>
    ),
    screen: <IosSafari highlight="address" />,
  },
  {
    title: "Paylaş düyməsinə toxun",
    body: (
      <>
        <p className="m-0">Ekranın aşağısındakı <strong>Paylaş</strong> düyməsinə (yuxarı ox olan kvadrat) toxun.</p>
        <Alt>Yeni iOS-da əvvəlcə aşağıdakı <strong>•••</strong> düyməsinə, sonra <strong>Paylaş</strong>-a toxun.</Alt>
      </>
    ),
    screen: <IosSafari highlight="share" />,
  },
  {
    title: "“Ana ekrana əlavə et” seç",
    body: (
      <>
        <p className="m-0">Açılan siyahını bir az aşağı sürüşdür və <strong>“Ana ekrana əlavə et”</strong> seç.</p>
        <Alt>Telefonun dilinə görə: Add to Home Screen · На экран «Домой» · Ana Ekrana Ekle</Alt>
      </>
    ),
    screen: <IosShareSheet />,
  },
  {
    title: "“Əlavə et” düyməsinə toxun",
    body: (
      <>
        <p className="m-0">Ad <strong>Xətm</strong> olaraq qalsın. <strong>“Veb tətbiq kimi aç”</strong> açıqdırsa, belə saxla və yuxarı-sağdakı <strong>“Əlavə et”</strong>-ə toxun.</p>
        <Alt>Add · Добавить · Ekle</Alt>
      </>
    ),
    screen: <IosAddDialog />,
  },
  {
    title: "Ana ekrandan aç",
    body: <p className="m-0">Ana ekranda <strong>Xətm</strong> ikonu yarandı. Bundan sonra tətbiqi həmişə bu ikondan aç.</p>,
    screen: <HomeScreen />,
  },
];

const ANDROID_STEPS: Step[] = [
  {
    title: "Chrome-da saytı aç",
    body: <p className="m-0">Chrome-da <Label>{SITE}</Label> ünvanını aç və daxil ol.</p>,
    screen: <AndroidChrome highlight="address" />,
  },
  {
    title: "Üç nöqtəyə toxun",
    body: <p className="m-0">Yuxarı-sağ küncdəki <strong>⋮</strong> (üç nöqtə) menyusuna toxun.</p>,
    screen: <AndroidChrome highlight="menu" />,
  },
  {
    title: "“Ana ekrana əlavə et” seç",
    body: (
      <>
        <p className="m-0">Menyuda <strong>“Ana ekrana əlavə et”</strong> və ya <strong>“Tətbiqi quraşdır”</strong> seç.</p>
        <Alt>Add to Home screen / Install app · Добавить на главный экран / Установить приложение · Ana ekrana ekle / Uygulamayı yükle</Alt>
      </>
    ),
    screen: <AndroidMenu />,
  },
  {
    title: "“Quraşdır” düyməsinə toxun",
    body: (
      <>
        <p className="m-0">Açılan pəncərədə <strong>“Quraşdır”</strong> (və ya <strong>“Əlavə et”</strong>) düyməsinə toxun.</p>
        <Alt>Install / Add · Установить / Добавить · Yükle / Ekle</Alt>
      </>
    ),
    screen: <AndroidInstallDialog />,
  },
  {
    title: "Ana ekrandan aç",
    body: <p className="m-0">Ana ekranda <strong>Xətm</strong> ikonu yarandı. Bundan sonra tətbiqi həmişə bu ikondan aç.</p>,
    screen: <HomeScreen />,
  },
];

/* ---------- Drawn phone screens ---------- */

const C = {
  frame: "#2B241F",
  screen: "#FFFFFF",
  ground: "#F6F1E8",
  line: "#EADFCF",
  muted: "#B7AA9C",
  text: "#6F625A",
  ink: "#2B241F",
  green: "#0F5C45",
  mint: "#E3EFE8",
  ios: "#0A84FF",
};

function Phone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 400" className="w-[180px] md:w-[200px] h-auto" role="img" aria-hidden="true">
      <rect x="4" y="4" width="192" height="392" rx="30" fill={C.frame} />
      <rect x="12" y="12" width="176" height="376" rx="23" fill={C.screen} />
      <rect x="76" y="20" width="48" height="12" rx="6" fill={C.frame} />
      {children}
    </svg>
  );
}

// The real home-screen icon, so people recognise it on their phone
function AppIcon({ x, y, size, id }: { x: number; y: number; size: number; id: string }) {
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={size} height={size} rx={size * 0.24} />
        </clipPath>
      </defs>
      <image href="/icon.png" x={x} y={y} width={size} height={size} clipPath={`url(#${id})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  );
}

// A green ring around the thing to tap, softly pulsing (static when motion is reduced)
function Tap({ cx, cy, r = 16 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.green} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.green} strokeWidth="2" className="tap-pulse" style={{ transformOrigin: `${cx}px ${cy}px` }} />
    </g>
  );
}

// Same mark for things with text on them: a frame around the control, never over its label
function TapRect({ x, y, w, h, r = 10 }: { x: number; y: number; w: number; h: number; r?: number }) {
  const pad = 4;
  return (
    <g>
      <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={r + pad} fill="none" stroke={C.green} strokeWidth="3" />
      <rect
        x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={r + pad}
        fill="none" stroke={C.green} strokeWidth="2" className="tap-pulse-soft"
      />
    </g>
  );
}

function PageSkeleton({ top = 52 }: { top?: number }) {
  return (
    <g>
      <rect x="24" y={top} width="110" height="10" rx="5" fill={C.ink} opacity="0.8" />
      <rect x="24" y={top + 18} width="80" height="7" rx="3.5" fill={C.muted} />
      <rect x="24" y={top + 38} width="152" height="70" rx="12" fill={C.ground} />
      <rect x="24" y={top + 118} width="152" height="96" rx="12" fill={C.ground} />
      <rect x="36" y={top + 186} width="128" height="18" rx="9" fill={C.green} />
    </g>
  );
}

function IosSafari({ highlight }: { highlight: "address" | "share" }) {
  return (
    <g>
      <PageSkeleton />
      {/* bottom address bar and toolbar */}
      <rect x="12" y="310" width="176" height="78" fill="#F2F2F7" />
      <rect x="24" y="318" width="152" height="26" rx="13" fill="#FFFFFF" stroke={C.line} />
      <text x="100" y="335" textAnchor="middle" fontSize="9" fill={C.text} fontFamily="system-ui">{SITE}</text>
      {/* toolbar icons: back, forward, share, book, tabs */}
      <path d="M36 362l-6 6 6 6" stroke={C.ios} strokeWidth="2" fill="none" />
      <path d="M64 362l6 6-6 6" stroke={C.muted} strokeWidth="2" fill="none" />
      <g stroke={C.ios} strokeWidth="2" fill="none">
        <rect x="93" y="362" width="14" height="14" rx="2" />
        <path d="M100 356v12M96 359l4-4 4 4" />
      </g>
      <path d="M128 362h10v14h-10z" stroke={C.ios} strokeWidth="2" fill="none" />
      <rect x="156" y="362" width="12" height="12" rx="2" stroke={C.ios} strokeWidth="2" fill="none" />
      {highlight === "address" ? <TapRect x={24} y={318} w={152} h={26} r={13} /> : <Tap cx={100} cy={367} r={15} />}
    </g>
  );
}

function IosShareSheet() {
  const rows = ["Kopyala", "Siyahıya əlavə et", "Ana ekrana əlavə et", "Ekran şəkli"];
  return (
    <g>
      <rect x="12" y="12" width="176" height="376" rx="23" fill="#00000033" />
      <rect x="12" y="120" width="176" height="268" rx="18" fill="#F2F2F7" />
      <rect x="86" y="128" width="28" height="4" rx="2" fill={C.muted} />
      <rect x="24" y="142" width="152" height="40" rx="10" fill="#FFFFFF" />
      <AppIcon x={32} y={150} size={24} id="icon-share" />
      <rect x="64" y="154" width="70" height="7" rx="3.5" fill={C.ink} opacity="0.8" />
      <rect x="64" y="166" width="50" height="6" rx="3" fill={C.muted} />
      {rows.map((label, i) => {
        const y = 196 + i * 40;
        const active = i === 2;
        return (
          <g key={label}>
            <rect x="24" y={y} width="152" height="34" rx="10" fill={active ? C.mint : "#FFFFFF"} />
            <text x="36" y={y + 21} fontSize="10" fontWeight={active ? 700 : 500} fill={active ? C.green : C.ink} fontFamily="system-ui">{label}</text>
            {active && (
              <g stroke={C.green} strokeWidth="1.6" fill="none">
                <rect x="152" y={y + 10} width="14" height="14" rx="3" />
                <path d={`M159 ${y + 13}v8M155 ${y + 17}h8`} />
              </g>
            )}
          </g>
        );
      })}
      <TapRect x={24} y={276} w={152} h={34} />
    </g>
  );
}

function IosAddDialog() {
  return (
    <g>
      <rect x="12" y="12" width="176" height="376" rx="23" fill="#F2F2F7" />
      <text x="28" y="56" fontSize="10" fill={C.ios} fontFamily="system-ui">Ləğv et</text>
      <text x="100" y="56" textAnchor="middle" fontSize="10" fontWeight="700" fill={C.ink} fontFamily="system-ui">Ana ekrana</text>
      <text x="172" y="56" textAnchor="end" fontSize="10" fontWeight="700" fill={C.ios} fontFamily="system-ui">Əlavə et</text>
      <rect x="24" y="76" width="152" height="60" rx="12" fill="#FFFFFF" />
      <AppIcon x={34} y={86} size={40} id="icon-add" />
      <text x="84" y="104" fontSize="11" fontWeight="700" fill={C.ink} fontFamily="system-ui">Xətm</text>
      <text x="84" y="118" fontSize="8" fill={C.text} fontFamily="system-ui">{SITE}</text>
      <rect x="24" y="148" width="152" height="34" rx="10" fill="#FFFFFF" />
      <text x="34" y="169" fontSize="9" fill={C.ink} fontFamily="system-ui">Veb tətbiq kimi aç</text>
      <rect x="146" y="157" width="24" height="15" rx="7.5" fill="#34C759" />
      <circle cx="162" cy="164.5" r="6" fill="#FFFFFF" />
      <TapRect x={136} y={44} w={40} h={14} r={6} />
    </g>
  );
}

function HomeScreen() {
  const apps = Array.from({ length: 12 }, (_, i) => i);
  return (
    <g>
      <rect x="12" y="12" width="176" height="376" rx="23" fill="#DCE7E1" />
      {apps.map((i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 28 + col * 40;
        const y = 56 + row * 52;
        const xetm = i === 9;
        return (
          <g key={i}>
            {xetm ? <AppIcon x={x} y={y} size={28} id="icon-home" /> : <rect x={x} y={y} width="28" height="28" rx="8" fill="#FFFFFF" opacity={0.7} />}
            {xetm && <text x={x + 14} y={y + 40} textAnchor="middle" fontSize="7" fontWeight="700" fill={C.ink} fontFamily="system-ui">Xətm</text>}
          </g>
        );
      })}
      <rect x="24" y="336" width="152" height="40" rx="16" fill="#FFFFFF" opacity="0.6" />
      <TapRect x={68} y={160} w={28} h={28} r={8} />
    </g>
  );
}

function AndroidChrome({ highlight }: { highlight: "address" | "menu" }) {
  return (
    <g>
      <rect x="12" y="34" width="176" height="34" fill="#F1F3F4" />
      <rect x="22" y="40" width="130" height="22" rx="11" fill="#FFFFFF" stroke={C.line} />
      <text x="87" y="55" textAnchor="middle" fontSize="8.5" fill={C.text} fontFamily="system-ui">{SITE}</text>
      <g fill={C.ink}>
        <circle cx="170" cy="45" r="1.8" />
        <circle cx="170" cy="51" r="1.8" />
        <circle cx="170" cy="57" r="1.8" />
      </g>
      <PageSkeleton top={84} />
      {highlight === "address" ? <TapRect x={22} y={40} w={130} h={22} r={11} /> : <Tap cx={170} cy={51} r={13} />}
    </g>
  );
}

function AndroidMenu() {
  const rows = ["Yeni tab", "Tarixçə", "Ana ekrana əlavə et", "Parametrlər"];
  return (
    <g>
      <rect x="12" y="34" width="176" height="34" fill="#F1F3F4" />
      <PageSkeleton top={84} />
      <rect x="70" y="40" width="112" height="176" rx="10" fill="#FFFFFF" stroke={C.line} />
      {rows.map((label, i) => {
        const y = 52 + i * 38;
        const active = i === 2;
        return (
          <g key={label}>
            {active && <rect x="74" y={y - 6} width="104" height="30" rx="8" fill={C.mint} />}
            <text x="84" y={y + 13} fontSize="9" fontWeight={active ? 700 : 500} fill={active ? C.green : C.ink} fontFamily="system-ui">{label}</text>
          </g>
        );
      })}
      <TapRect x={74} y={122} w={104} h={30} r={8} />
    </g>
  );
}

function AndroidInstallDialog() {
  return (
    <g>
      <PageSkeleton top={84} />
      <rect x="12" y="12" width="176" height="376" rx="23" fill="#00000040" />
      <rect x="26" y="140" width="148" height="120" rx="16" fill="#FFFFFF" />
      <text x="40" y="166" fontSize="11" fontWeight="700" fill={C.ink} fontFamily="system-ui">Tətbiqi quraşdır</text>
      <AppIcon x={40} y={178} size={30} id="icon-install" />
      <text x="78" y="192" fontSize="10" fontWeight="700" fill={C.ink} fontFamily="system-ui">Xətm</text>
      <text x="78" y="204" fontSize="7.5" fill={C.text} fontFamily="system-ui">{SITE}</text>
      <text x="92" y="244" fontSize="9.5" fontWeight="600" fill={C.green} fontFamily="system-ui">Ləğv et</text>
      <rect x="122" y="230" width="44" height="22" rx="11" fill={C.green} />
      <text x="144" y="245" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFFFFF" fontFamily="system-ui">Quraşdır</text>
      <TapRect x={122} y={230} w={44} h={22} r={11} />
    </g>
  );
}
