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
  IconLogout,
  IconChevronDown,
  LoadingScreen,
  btn,
} from "./ui";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "groups" | "admin" | "ai";
}

type NavKey = "dashboard" | "readings" | "progress" | "admin" | "groups";

// Map every screen to the navigation item it belongs to
const NAV_FOR_TAB: Record<AppLayoutProps["activeTab"], NavKey> = {
  dashboard: "dashboard",
  readings: "readings",
  progress: "progress",
  stats: "progress",
  groups: "groups",
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
  ];
  if (canManageGroup) {
    navItems.push({ key: "admin", href: "/admin", label: "İnzibatçı paneli", short: "Admin", icon: <IconShield /> });
  }
  // On mobile, members without admin rights get "Qruplarım" as the fourth tab
  const mobileItems = canManageGroup
    ? navItems
    : [...navItems, { key: "groups" as NavKey, href: "/groups", label: "Qruplarım", short: "Qruplarım", icon: <IconLayers /> }];

  return (
    <div className="min-h-screen bg-cream text-ink md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-[264px] shrink-0 box-border bg-forest text-[#EAE3D2] px-5 py-8 flex-col gap-7 sticky top-0 h-screen overflow-y-auto">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-11 h-11 rounded-xl bg-tile border border-[rgba(226,184,92,0.4)] flex items-center justify-center">
            <Logo />
          </div>
          <span className="font-display font-bold text-2xl text-gold">Xətm App</span>
        </Link>

        <div className="flex flex-col gap-2 px-1">
          <div className="text-xs font-semibold text-sidebarmuted pl-1">Aktiv qrup</div>
          <Link
            href="/groups"
            className={`flex items-center justify-between gap-3 min-h-[52px] px-3.5 py-2 rounded-btn border text-cream transition-colors ${
              current === "groups"
                ? "bg-tile border-[rgba(226,184,92,0.5)]"
                : "bg-white/[0.07] border-white/[0.16] hover:bg-white/10"
            }`}
          >
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-base font-bold truncate">{activeGroupName}</span>
              <span className="text-xs text-sidebarmuted">
                {activeGroup ? `${memberCount} iştirakçı` : "Qruplarım"}
              </span>
            </span>
            <IconChevronDown size={18} className="text-sidebarmuted shrink-0" />
          </Link>
        </div>

        <nav aria-label="Əsas naviqasiya" className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isCurrent = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex items-center gap-3 min-h-[48px] px-3.5 rounded-btn text-[15px] transition-colors ${
                  isCurrent ? "bg-cream text-forest font-bold" : "text-sidebartext font-semibold hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-1">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 min-h-[48px] px-3.5 rounded-btn text-exit font-semibold text-[15px] border-t border-white/[0.12] hover:bg-white/5"
          >
            <IconLogout />
            Çıxış
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 box-border px-5 pt-7 pb-28 md:px-12 md:pt-9 md:pb-14">
        <div className="max-w-[1160px] mx-auto">
          {isApproved || activeTab === "groups" ? children : <ApprovalPendingScreen user={user} logout={logout} />}
        </div>
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav
        aria-label="Əsas naviqasiya"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid bg-white border-t border-[#E3DBC7] px-2 pt-2 pb-safe"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
      >
        {mobileItems.map((item) => {
          const isCurrent = current === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={`min-h-[56px] flex flex-col items-center justify-center gap-1 text-xs ${
                isCurrent ? "font-bold text-forest" : "font-semibold text-muted"
              }`}
            >
              <span className={`h-[30px] flex items-center justify-center ${isCurrent ? "w-14 rounded-full bg-mint" : ""}`}>
                {item.icon}
              </span>
              {item.short}
            </Link>
          );
        })}
      </nav>
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
      <section className="bg-white border border-line rounded-hero w-full max-w-md p-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-mint flex items-center justify-center text-forest">
          <IconGroup size={40} />
        </div>
        <h1 className="m-0 font-display font-semibold text-2xl text-forest">Təsdiq gözlənilir</h1>
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
