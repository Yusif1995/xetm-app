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
  IconMessage,
  IconLogout,
  IconChevronDown,
  LoadingScreen,
  btn,
} from "./ui";
import { StarMark } from "./ornament";
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
  const { user, loading, logout, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const navFrom = useNavFrom(NAV_FOR_TAB[activeTab]);
  // Unread conversations: the group creator sees every member's thread, a member only their own
  const isCreator = !!user && !!activeGroup && activeGroup.createdBy === user.uid;
  const threads = useGroupThreads(activeGroupId, isCreator);
  const ownThread = useThreadSummary(activeGroupId, user && !isCreator ? user.uid : undefined);
  const hasUnread = isCreator ? Object.values(threads).some((t) => t.managerUnread) : !!ownThread?.memberUnread;
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
  // Mobile tab bar keeps five tabs: analytics is reached from the "Qrup" screen there,
  // and members without admin rights get "Qruplarım" as the last tab
  const mobileBase = navItems.filter((i) => i.key !== "analytics");
  const mobileItems = canManageGroup
    ? mobileBase
    : [...mobileBase, { key: "groups" as NavKey, href: "/groups", label: "Qruplarım", short: "Qruplarım", icon: <IconLayers size={22} /> }];

  return (
    <div className="min-h-screen bg-cream text-ink md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-[264px] shrink-0 box-border bg-white border-r border-line px-5 py-8 flex-col gap-7 sticky top-0 h-screen overflow-y-auto">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-11 h-11 rounded-[14px] bg-tile flex items-center justify-center">
            <Logo />
          </div>
          <span className="font-display text-[26px] leading-none text-ink">Xətm</span>
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
                <span className="relative">
                  {item.icon}
                  {item.key === "messages" && hasUnread && <UnreadDot />}
                </span>
                <span className="flex-1">{item.label}</span>
                {isCurrent && <StarMark size={11} className="text-leaf" />}
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
          <PageTransition from={navFrom} current={current} order={NAV_ORDER}>
            {isApproved || activeTab === "groups" ? children : <ApprovalPendingScreen user={user} logout={logout} />}
          </PageTransition>
        </div>
      </main>

      {/* Tab bar (mobile), docked within thumb reach: icon over label, a mint pill behind the current one */}
      <div className="fixed-layer md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-line pb-safe">
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
