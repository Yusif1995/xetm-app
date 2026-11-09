"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { getGroupDoc, isUserApprovedInGroup, type UserDoc } from "@/lib/db";
import OnboardingScreen from "./OnboardingScreen";
import { isPushSupported, registerPushSubscription, enablePushFromUserGesture } from "@/lib/push";
import {
  IconToday,
  IconBook,
  IconGroup,
  IconShield,
  IconLayers,
  IconChart,
  IconMessage,
  IconLogout,
  IconChevronDown,
  IconBell,
  IconSettings,
  Avatar,
  LoadingScreen,
  btn,
} from "./ui";
import { GeminiFab } from "./dash";
import { useRouter } from "next/navigation";
import { surahStartPage } from "@/lib/quran";
import { PageTransition, TabPill, useNavFrom } from "./PageMotion";
import { useGroupThreads, useThreadSummary } from "@/lib/useGroupData";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "groups" | "analytics" | "messages" | "admin" | "ai";
}

type NavKey = "dashboard" | "readings" | "progress" | "messages" | "analytics" | "admin" | "groups";

// Left-to-right order of the screens: decides which side a screen slides in from
const NAV_ORDER: NavKey[] = ["dashboard", "readings", "progress", "messages", "analytics", "groups", "admin"];

// Map every screen to the navigation item it belongs to
const NAV_FOR_TAB: Record<AppLayoutProps["activeTab"], NavKey> = {
  dashboard: "dashboard",
  readings: "readings",
  progress: "progress",
  stats: "progress",
  groups: "groups",
  analytics: "analytics",
  messages: "messages",
  admin: "admin",
  ai: "admin",
};

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin, previewAsMember, setPreviewAsMember } = useAuth();
  const navFrom = useNavFrom(NAV_FOR_TAB[activeTab]);
  // Unread conversations: the leader sees every member's thread and bulk conversation, a member
  // their own; anyone their private chat with the app owner
  const isCreator = !!user && !!activeGroup && activeGroup.createdBy === user.uid;
  const threads = useGroupThreads(activeGroupId, isCreator);
  const bulk = useGroupThreads(activeGroupId, isCreator, "broadcasts");
  const ownThread = useThreadSummary(activeGroupId, user && !isCreator ? user.uid : undefined);
  const ownBulk = useThreadSummary(activeGroupId, user && !isCreator ? user.uid : undefined, "broadcasts");
  const ownerChat = useThreadSummary(activeGroupId, user?.uid, "ownerChats");
  const hasUnread = !!ownerChat?.memberUnread || (isCreator
    ? [...Object.values(threads), ...Object.values(bulk)].some((t) => t.managerUnread)
    : !!ownThread?.memberUnread || !!ownBulk?.memberUnread);
  // Keep this browser's push subscription up to date once permission has been granted.
  // Permission itself is only requested from the bell button (a user gesture), never on load.
  useEffect(() => {
    if (!user || !isPushSupported() || Notification.permission !== "granted") return;
    registerPushSubscription(user.uid).catch((err) => {
      console.error("Error setting up push subscription:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  if (loading || (user && !activeGroupLoaded)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  // Onboarding Screen Wall check
  if (!user.isOnboarded) {
    return <OnboardingScreen user={user} logout={logout} />;
  }

  // Approval Pending Wall check
  const isApproved = isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup);
  const isActiveGroupOwner = !!activeGroup && activeGroup.createdBy === user.uid;
  const canManageGroup = isActiveGroupOwner || isSuperAdmin;

  const current = NAV_FOR_TAB[activeTab];
  const memberCount = Object.values(activeGroup?.members || {}).filter((s) => s === "owner" || s === "member").length;
  const activeGroupName = activeGroup?.name || "Qrup seçilməyib";

  const navItems: { key: NavKey; href: string; label: string; short: string; icon: ReactNode }[] = [
    { key: "dashboard", href: "/dashboard", label: "Bu gün", short: "Bu gün", icon: <IconToday size={22} /> },
    { key: "readings", href: "/readings", label: "Səhifələrim", short: "Səhifələrim", icon: <IconBook size={22} /> },
    { key: "progress", href: "/progress", label: "Qrup", short: "Qrup", icon: <IconGroup size={22} /> },
    { key: "messages", href: "/mesajlar", label: "Mesajlar", short: "Mesajlar", icon: <IconMessage size={22} /> },
    { key: "analytics", href: "/analytics", label: "Analitika", short: "Analitika", icon: <IconChart size={22} /> },
  ];
  if (canManageGroup) {
    navItems.push({ key: "admin", href: "/admin", label: "İnzibatçı paneli", short: "Admin", icon: <IconShield size={22} /> });
  }
  // Phone tab bar: the screens without "Mesajlar" (it sits in the top bar); admins get "Admin" last
  const mobileItems = navItems.filter((i) => i.key !== "messages");

  return (
    <div className="min-h-screen text-ink overflow-x-clip">
      {previewAsMember && (
        <div role="status" className="relative z-50 bg-accent text-white text-[14px] font-bold">
          <div className="max-w-[1184px] mx-auto min-h-[44px] px-4 md:px-8 flex items-center justify-between gap-3">
            <span>İştirakçı görünüşü: sayt adi üzvə necə görünürsə, elə göstərilir (yalnız lokal sınaq)</span>
            <button
              type="button"
              onClick={() => { setPreviewAsMember(false); window.location.href = "/dashboard"; }}
              className="press shrink-0 min-h-[36px] px-3.5 rounded-[10px] bg-white text-ink text-[13px] font-extrabold"
            >
              Admin görünüşünə qayıt
            </button>
          </div>
        </div>
      )}

      {/* Top bar on the night artwork: logo, the screens and search (desktop), bell, messages and the profile menu */}
      <DesktopNav
        items={navItems.filter((i) => i.key !== "messages")}
        current={current}
        hasUnread={hasUnread}
        user={user}
        groupName={activeGroupName}
        memberCount={activeGroup ? memberCount : null}
        role={isActiveGroupOwner ? "Qrup rəhbəri" : isSuperAdmin ? "Admin" : "İştirakçı"}
        onPreviewMember={process.env.NODE_ENV === "development" && canManageGroup && !previewAsMember
          ? () => { setPreviewAsMember(true); window.location.href = "/dashboard"; }
          : undefined}
        canManage={canManageGroup && current === "admin"}
        logout={logout}
      />

      {/* Content: on desktop the page title sits on a night tile band and the first cards ride over its lower edge */}
      <main className="relative min-w-0 box-border px-4 pt-6 pb-36 md:px-8 md:pt-9 md:pb-14">
        <div className="max-w-[1120px] mx-auto">
          <PageTransition from={navFrom} current={current} order={NAV_ORDER}>
            {isApproved || activeTab === "groups" ? children : <ApprovalPendingScreen user={user} logout={logout} />}
          </PageTransition>
        </div>
      </main>

      {canManageGroup && current === "admin" && <GeminiFab />}

      {/* Tab bar (phone), docked to the bottom edge: icon over label, a mint pill behind the current one */}
      <div className="fixed-layer md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-[22px] shadow-[0_-6px_20px_-8px_rgba(24,34,53,0.22)] pb-safe">
        <nav
          aria-label="Əsas naviqasiya"
          className="relative grid px-1 pt-2.5 pb-1.5"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          <TabPill items={mobileItems.map((i) => i.key)} current={current} from={navFrom} />
          {mobileItems.map((item) => {
            const isCurrent = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={item.key === "messages" && hasUnread ? `${item.short}, yeni mesaj var` : undefined}
                className={`press relative min-h-[60px] flex flex-col items-center gap-1 text-[12px] leading-tight ${
                  isCurrent ? "font-extrabold text-ink" : "font-semibold text-muted"
                }`}
              >
                <span className={`relative h-9 grid place-items-center ${isCurrent ? "text-forest" : ""}`}>
                  {item.icon}
                  {item.key === "messages" && hasUnread && <UnreadDot />}
                </span>
                <span className="max-w-full truncate px-0.5">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function UnreadDot() {
  return <span aria-hidden="true" className="absolute -top-0.5 -right-1 w-[9px] h-[9px] rounded-full bg-accent border-2 border-white" />;
}

function ApprovalPendingScreen({ user, logout }: { user: UserDoc; logout: () => Promise<void> }) {
  const [groupName, setGroupName] = useState<string>("");
  const { activeGroupId } = useAuth();
  const hasGroup = (!!activeGroupId && activeGroupId !== "default") || (user.groupIds?.length ?? 0) > 0;

  useEffect(() => {
    const loadGroup = async () => {
      const gId = activeGroupId && activeGroupId !== "default" ? activeGroupId : (user.groupId !== "default" ? user.groupId : "");
      if (gId) {
        const gDoc = await getGroupDoc(gId);
        if (gDoc) {
          setGroupName(gDoc.name);
        }
      }
    };
    loadGroup();
  }, [user.groupId, activeGroupId]);

  return (
    <div className="w-full flex justify-center py-8 md:py-16">
      <section className="bg-white border border-line rounded-hero shadow-card w-full max-w-md p-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-mint flex items-center justify-center text-forest">
          <IconGroup size={40} />
        </div>
        <h1 className="m-0 font-display font-normal text-[26px] text-ink">{hasGroup ? "Təsdiq gözlənilir" : "Hələ qrupun yoxdur"}</h1>
        <p className="m-0 text-sm leading-relaxed text-muted">
          {!hasGroup ? (
            "Qrup sahibindən dəvət linkini al və Qruplarım bölməsində yapışdır. Təsdiq ediləndən sonra qrupa daxil olacaqsan."
          ) : groupName ? (
            <>
              <strong className="text-ink">“{groupName}”</strong> qrupuna qoşulmaq istəyiniz qeydə alınıb. Qrup sahibi təsdiq edən kimi qrupa daxil olacaqsınız.
            </>
          ) : (
            "Qoşulma istəyiniz qeydə alınıb. Qrup sahibi təsdiq edən kimi qrupa daxil olacaqsınız."
          )}
        </p>
        <div className="flex flex-col gap-2.5 w-full mt-2">
          <Link href="/groups" className={btn.primary}>
            {hasGroup ? "Qruplarım — başqa qrupa keç" : "Dəvət linkini yapışdır"}
          </Link>
          <button onClick={logout} className={btn.danger}>
            <IconLogout size={18} />
            Çıxış
          </button>
        </div>
      </section>
    </div>
  );
}

type NavItem = { key: NavKey; href: string; label: string; short: string; icon: ReactNode };

// Top bar on the night artwork (phone and desktop). The screen links and search are desktop only;
// on the phone the bell shows on "Bu gün" only. Search: a page number (1-604) or a surah name opens the reader there.
function DesktopNav({
  items, current, hasUnread, user, groupName, memberCount, role, canManage, onPreviewMember, logout,
}: {
  items: NavItem[];
  current: NavKey;
  hasUnread: boolean;
  user: UserDoc;
  groupName: string;
  memberCount: number | null;
  role: string;
  canManage: boolean;
  onPreviewMember?: () => void;
  logout: () => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pushOn, setPushOn] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = user.name || user.nickname || "";

  useEffect(() => {
    setPushOn(!isPushSupported() || Notification.permission === "granted");
  }, []);

  // Ctrl K / Cmd K focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Profile menu closes on outside click or Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const n = Number(q);
    if (Number.isInteger(n) && n >= 1 && n <= 604) {
      router.push(`/oxu?s=${n}`);
      return;
    }
    const surah = surahStartPage(q);
    if (surah) {
      router.push(`/oxu?s=${surah.page}`);
      return;
    }
    setHint("Səhifə nömrəsi (1–604) və ya surə adı yaz");
  };

  const enablePush = async () => {
    setNotice(await enablePushFromUserGesture(user.uid));
    if (isPushSupported()) setPushOn(Notification.permission === "granted");
  };

  return (
    <header className="night-nav night-nav-m relative md:sticky top-0 z-40">
      <div className="relative max-w-[1184px] mx-auto h-16 md:h-[76px] px-4 md:px-8 flex items-center gap-6 lg:gap-8">
        <Link href="/dashboard" aria-label="Xətm · Bu gün" className="press shrink-0 rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-round.png" alt="" width={56} height={56} className="w-10 h-10 md:w-14 md:h-14 rounded-full ring-1 ring-gold/40" />
        </Link>

        <nav aria-label="Əsas naviqasiya" className="hidden md:flex items-center gap-5 lg:gap-7 min-w-0">
          {items.map((item) => {
            const isCurrent = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`press relative min-h-[44px] inline-flex items-center text-[15px] whitespace-nowrap transition-colors ${
                  isCurrent ? "text-white font-extrabold" : "text-onforest font-semibold hover:text-white"
                }`}
              >
                <span className="xl:hidden">{item.short}</span>
                <span className="hidden xl:inline">{item.label}</span>
                {isCurrent && <span aria-hidden="true" className="absolute left-0 right-0 bottom-1.5 h-[2px] rounded-full bg-gold" />}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={submitSearch} role="search" className="relative ml-auto hidden lg:block w-[240px] xl:w-[280px]">
          <label className="flex items-center gap-2.5 h-11 pl-3.5 pr-2 rounded-[12px] bg-white/[0.07] border border-white/10 focus-within:border-gold/50 text-nightmuted">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            <span className="sr-only">Səhifə və ya surə axtar</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHint(null); }}
              placeholder="Səhifə və ya surə…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-white placeholder:text-nightmuted"
            />
            <kbd className="font-sans text-[12px] font-bold text-white bg-white/10 rounded-lg px-2 py-1">Ctrl K</kbd>
          </label>
          {hint && <div role="status" className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-white text-ink text-[13px] px-3 py-2 shadow-bar">{hint}</div>}
        </form>

        <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-auto lg:ml-0">
          <button
            type="button"
            onClick={enablePush}
            aria-label={pushOn ? "Bildirişlər aktivdir" : "Bildirişləri aktiv et"}
            title={pushOn ? "Bildirişlər aktivdir" : "Bildirişləri aktiv et"}
            className={`press relative w-11 h-11 rounded-[12px] place-items-center text-white hover:bg-white/[0.07] ${current === "dashboard" ? "grid" : "hidden md:grid"}`}
          >
            <IconBell size={21} />
            {!pushOn && <span aria-hidden="true" className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent ring-2 ring-[#0B1F33]" />}
          </button>
          {canManage && (
            <Link
              href="/admin?ayarlar=1"
              onClick={() => {
                // Already on the admin screen: open the panel without a reload
                if (window.location.pathname === "/admin") setTimeout(() => window.dispatchEvent(new Event("xetm:open-settings")), 0);
              }}
              aria-label="Qrup ayarları"
              title="Qrup ayarları"
              className="press w-11 h-11 rounded-[12px] grid place-items-center text-white hover:bg-white/[0.07]"
            >
              <IconSettings size={21} />
            </Link>
          )}
          <Link
            href="/mesajlar"
            aria-current={current === "messages" ? "page" : undefined}
            aria-label={hasUnread ? "Mesajlar, yeni mesaj var" : "Mesajlar"}
            title="Mesajlar"
            className={`press relative w-11 h-11 rounded-[12px] grid place-items-center text-white hover:bg-white/[0.07] ${current === "messages" ? "bg-white/[0.1]" : ""}`}
          >
            <IconMessage size={21} />
            {hasUnread && <span aria-hidden="true" className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent ring-2 ring-[#0B1F33]" />}
          </Link>

          <div ref={menuRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Profil menyusu: ${name || "hesabın"}`}
              className="press flex items-center gap-1.5 min-h-[44px] rounded-full"
            >
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <Avatar name={name} size={40} />
              )}
              <IconChevronDown size={16} className="hidden md:block text-nightmuted" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-[min(260px,calc(100vw-2rem))] bg-white rounded-[16px] shadow-bar p-2 text-ink z-50">
                <div className="px-3 py-2.5 border-b border-line mb-1">
                  <div className="text-[14px] font-bold truncate">{name}</div>
                  <div className="text-[12px] text-muted truncate">{role} · {groupName}{memberCount !== null ? ` · ${memberCount} iştirakçı` : ""}</div>
                </div>
                <MenuLink href="/groups" icon={<IconLayers size={18} />}>Qruplarım · qrupu dəyiş</MenuLink>
                <MenuLink href="/mesajlar" icon={<IconMessage size={18} />}>Mesajlar</MenuLink>
                <MenuLink href="/qurasdir" icon={<IconToday size={18} />}>Ana ekrana əlavə et</MenuLink>
                {onPreviewMember && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onPreviewMember}
                    className="w-full flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl text-[14px] font-semibold text-ink hover:bg-cream"
                  >
                    <span className="text-muted"><IconGroup size={18} /></span>
                    İştirakçı kimi bax
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl text-[14px] font-semibold text-danger hover:bg-[#FBEFEB]"
                >
                  <IconLogout size={18} />
                  Çıxış
                </button>
              </div>
            )}
          </div>
        </div>

        {notice && (
          <div role="status" className="absolute right-4 md:right-8 top-full mt-2 max-w-sm rounded-xl bg-white text-ink text-[13px] px-4 py-3 shadow-bar">{notice}</div>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl text-[14px] font-semibold hover:bg-cream">
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}
