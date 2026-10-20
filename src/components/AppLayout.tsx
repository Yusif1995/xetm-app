"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { getGroupDoc, isUserApprovedInGroup, type UserDoc } from "@/lib/db";
import OnboardingScreen from "./OnboardingScreen";
import { isPushSupported, registerPushSubscription } from "@/lib/push";
import {
  Logo,
  IconToday,
  IconBook,
  IconGroup,
  IconShield,
  IconLayers,
  IconChart,
  IconLogout,
  IconChevronDown,
  LoadingScreen,
  btn,
} from "./ui";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "groups" | "analytics" | "admin" | "ai";
}

type NavKey = "dashboard" | "readings" | "progress" | "analytics" | "admin" | "groups";

// Map every screen to the navigation item it belongs to
const NAV_FOR_TAB: Record<AppLayoutProps["activeTab"], NavKey> = {
  dashboard: "dashboard",
  readings: "readings",
  progress: "progress",
  stats: "progress",
  groups: "groups",
  analytics: "analytics",
  admin: "admin",
  ai: "admin",
};

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
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
    { key: "dashboard", href: "/dashboard", label: "Bu gün", short: "Bu gün", icon: <IconToday /> },
    { key: "readings", href: "/readings", label: "Səhifələrim", short: "Səhifələrim", icon: <IconBook /> },
    { key: "progress", href: "/progress", label: "Qrup", short: "Qrup", icon: <IconGroup /> },
    { key: "analytics", href: "/analytics", label: "Analitika", short: "Analitika", icon: <IconChart /> },
  ];
  if (canManageGroup) {
    navItems.push({ key: "admin", href: "/admin", label: "İnzibatçı paneli", short: "Admin", icon: <IconShield /> });
  }
  // Mobile tab bar keeps four tabs: analytics is reached from the "Qrup" screen there,
  // and members without admin rights get "Qruplarım" as the fourth tab
  const mobileBase = navItems.filter((i) => i.key !== "analytics");
  const mobileItems = canManageGroup
    ? mobileBase
    : [...mobileBase, { key: "groups" as NavKey, href: "/groups", label: "Qruplarım", short: "Qruplarım", icon: <IconLayers /> }];

  return (
    <div className="min-h-screen bg-cream text-ink md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-[264px] shrink-0 box-border bg-white border-r border-line px-5 py-8 flex-col gap-7 sticky top-0 h-screen overflow-y-auto">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-11 h-11 rounded-[14px] bg-tile flex items-center justify-center">
            <Logo />
          </div>
          <span className="font-extrabold text-[22px] tracking-[-0.01em] text-ink">Xətm</span>
        </Link>

        <div className="flex flex-col gap-2 px-1">
          <div className="text-xs font-bold text-sidebarmuted pl-1">Aktiv qrup</div>
          <Link
            href="/groups"
            className={`press flex items-center justify-between gap-3 min-h-[56px] px-3.5 py-2 rounded-btn border transition-colors ${
              current === "groups" ? "bg-mint border-forest/30" : "bg-cream border-line hover:bg-sand"
            }`}
          >
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[15px] font-bold text-ink truncate">{activeGroupName}</span>
              <span className="text-xs text-muted">
                {activeGroup ? `${memberCount} iştirakçı` : "Qruplarım"}
              </span>
            </span>
            <IconChevronDown size={18} className="text-muted shrink-0" />
          </Link>
        </div>

        <nav aria-label="Əsas naviqasiya" className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isCurrent = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`press flex items-center gap-3 min-h-[48px] px-3.5 rounded-btn text-[15px] transition-colors ${
                  isCurrent ? "bg-mint text-forest font-extrabold" : "text-sidebartext font-semibold hover:bg-cream"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-1 pt-4 border-t border-line">
          <button
            type="button"
            onClick={logout}
            className="press w-full flex items-center gap-3 min-h-[48px] px-3.5 rounded-btn text-danger font-semibold text-[15px] hover:bg-[#FBEFEB]"
          >
            <IconLogout />
            Çıxış
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 box-border px-4 pt-6 pb-32 md:px-12 md:pt-10 md:pb-14">
        <div className="max-w-[1120px] mx-auto">
          {isApproved || activeTab === "groups" ? children : <ApprovalPendingScreen user={user} logout={logout} />}
        </div>
      </main>

      {/* Floating tab bar (mobile), within thumb reach */}
      <div className="fixed-layer md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe pointer-events-none">
        <nav
          aria-label="Əsas naviqasiya"
          className="pointer-events-auto grid bg-white border border-line rounded-[26px] shadow-bar px-1.5 py-1.5"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const isCurrent = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`press min-h-[56px] rounded-[20px] flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isCurrent ? "font-extrabold text-forest bg-mint" : "font-bold text-muted"
                }`}
              >
                {item.icon}
                {item.short}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function ApprovalPendingScreen({ user, logout }: { user: UserDoc; logout: () => Promise<void> }) {
  const [groupName, setGroupName] = useState<string>("");
  const { activeGroupId } = useAuth();

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
        <h1 className="m-0 font-extrabold text-2xl text-ink">Təsdiq gözlənilir</h1>
        <p className="m-0 text-sm leading-relaxed text-muted">
          {groupName ? (
            <>
              <strong className="text-ink">“{groupName}”</strong> qrupuna qoşulmaq istəyiniz qeydə alınıb. Qrup sahibi təsdiq edən kimi qrupa daxil olacaqsınız.
            </>
          ) : (
            "Qoşulma istəyiniz qeydə alınıb. Qrup sahibi təsdiq edən kimi qrupa daxil olacaqsınız."
          )}
        </p>
        <div className="flex flex-col gap-2.5 w-full mt-2">
          <Link href="/groups" className={btn.primary}>
            Qruplarım — başqa qrupa keç
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
