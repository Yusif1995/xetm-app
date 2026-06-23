"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { IslamicBorders } from "./IslamicBorders";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { addPushSubscription, getGroupDoc, getUserGroupIds, getUserAssignment, createGroup, type UserDoc, type GroupDoc } from "@/lib/db";
import OnboardingScreen from "./OnboardingScreen";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "admin" | "ai";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout, activeGroupId, setActiveGroupId } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const prevCompletionsRef = useRef<Record<string, number[]>>({});
  const isFirstLoadRef = useRef(true);

  // Group creation modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setCreateGroupLoading(true);
    setCreateGroupError(null);

    try {
      if (!user) return;
      
      // Upgrade role to admin if not already, to satisfy Firestore write rules
      if (user.role !== "admin") {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { role: "admin" });
      }

      const newGroupId = await createGroup(newGroupName.trim(), user.uid);
      
      // Set active group and close modal
      setActiveGroupId(newGroupId);
      setShowCreateGroupModal(false);
      setNewGroupName("");
      
      // Redirect to refresh all hooks
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Error creating group in AppLayout:", err);
      setCreateGroupError("Qrup yaradılarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setCreateGroupLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
      const list: GroupDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.createdBy === user.uid || getUserGroupIds(user).includes(docSnap.id)) {
          list.push({ id: docSnap.id, ...data } as GroupDoc);
        }
      });
      setGroups(list);
    }, (err) => {
      console.error("Error in AppLayout groups listener:", err);
    });

    return () => unsubGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Request browser Notification permission and register push subscription on mount/login
  useEffect(() => {
    if (!user) return;
    
    const initPush = async () => {
      if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        
        if (permission === "granted") {
          try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
              const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
              });
            }
            
            if (subscription) {
              await addPushSubscription(user.uid, JSON.stringify(subscription));
              console.log("Registered Push Subscription for user", user.uid);
            }
          } catch (err) {
            console.error("Error setting up push subscription:", err);
          }
        }
      }
    };
    
    initPush();
  }, [user]);

  // Listen to completedPages updates in real-time
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const currentCompletions: Record<string, number[]> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data() as UserDoc;
        if (getUserGroupIds(data).includes(activeGroupId)) {
          const assignment = getUserAssignment(data, activeGroupId);
          currentCompletions[doc.id] = assignment.completedPages || [];
        }
      });

      if (isFirstLoadRef.current) {
        prevCompletionsRef.current = currentCompletions;
        isFirstLoadRef.current = false;
        return;
      }

      // Check for changes
      snapshot.forEach((docSnap) => {
        const uid = docSnap.id;
        if (uid === user.uid) return; // Do not notify about self
        const data = docSnap.data() as UserDoc;
        if (!getUserGroupIds(data).includes(activeGroupId)) return; // Only notify if in same group

        const oldPages = prevCompletionsRef.current[uid] || [];
        const assignment = getUserAssignment(data, activeGroupId);
        const newPages = assignment.completedPages || [];
        const newlyCompleted = newPages.filter((p: number) => !oldPages.includes(p));

        if (newlyCompleted.length > 0) {
          const name = data.name || "Bir iştirakçı";
          const title = "Quran Xətm - Yeni Tamamlama!";
          const options = {
            body: `${name} yeni səhifəni tamamladı: Səhifə ${newlyCompleted.sort((a: number, b: number) => a - b).join(", ")}`,
            icon: "/icon.png",
            badge: "/favicon.ico",
            vibrate: [200, 100, 200],
            data: { url: "/dashboard" }
          };

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, options);
              }).catch((err) => {
                console.error("Error in service worker notification:", err);
                try {
                  new Notification(title, { body: options.body, icon: options.icon });
                } catch (e) {
                  console.error("Fallback notification error:", e);
                }
              });
            } else {
              try {
                new Notification(title, { body: options.body, icon: options.icon });
              } catch (err) {
                console.error("Error triggering HTML5 notification:", err);
              }
            }
          }
        }
      });

      prevCompletionsRef.current = currentCompletions;
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">Yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Onboarding Screen Wall check
  if (!user.isOnboarded) {
    return <OnboardingScreen user={user} logout={logout} />;
  }

  // Approval Pending Wall check
  const isApproved = user.role === "admin" || (
    activeGroupId === "default" 
      ? user.approved === true 
      : user.groupData?.[activeGroupId]?.approved === true
  );

  return (
    <div className="min-h-screen flex bg-[#F7F4EB] text-[#1c2e24] relative overflow-x-hidden pb-16 md:pb-0">
      {/* Background Star Patterns */}
      <IslamicBorders />

      {/* Left Sidebar (Desktop) */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-[#0F3D2C] text-white py-8 px-4 gap-6 relative z-20 border-r border-[#D5A85A]/10 shadow-2xl">
        <div className="sidebar-pattern" />

        {/* Logo Section */}
        <div className="flex flex-col items-center justify-center gap-3 relative z-10 border-b border-white/10 pb-6">
          {/* Mosque Dome & Quran Logo */}
          <div className="w-20 h-20 flex items-center justify-center relative overflow-hidden rounded-2xl border border-[#D5A85A]/35 shadow-md">
            <img 
              src="/logo.png" 
              alt="Xətm App" 
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-lg font-serif font-bold tracking-wider text-[#D5A85A]">
            Xətm App
          </span>
        </div>

        {/* Group Selector for Desktop */}
        {user && (
          <div className="flex flex-col gap-1.5 px-4 relative z-10">
            <span className="text-[9px] uppercase tracking-wider text-[#D5A85A] font-bold">Aktiv Qrup</span>
            <select
              value={activeGroupId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setShowCreateGroupModal(true);
                } else {
                  setActiveGroupId(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-bold text-xs outline-none focus:border-white/40 transition-colors cursor-pointer"
            >

              {groups.map((g) => (
                <option key={g.id} value={g.id} className="text-black font-semibold">{g.name}</option>
              ))}
              <option value="__new__" className="text-[#D5A85A] font-bold">+ Yeni Qrup Yarat...</option>
            </select>
          </div>
        )}

        {/* Sidebar Nav Items */}
        <nav className="flex-1 flex flex-col gap-2 relative z-10 pt-2 font-sans">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "dashboard"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Panel</span>
          </Link>

          {/* My Readings */}
          <Link
            href="/readings"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "readings"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>Səhifələrim</span>
          </Link>

          {/* Groups */}
          <Link
            href="/progress"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "progress"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18v-1a3 3 0 0 1 3-3h1" />
              <circle cx="7" cy="10" r="2" />
              <path d="M16 14h1a3 3 0 0 1 3 3v1" />
              <circle cx="17" cy="10" r="2" />
              <path d="M8 21v-1.5a3.5 3.5 0 0 1 7 0V21" />
              <circle cx="11.5" cy="7" r="2.5" />
            </svg>
            <span>Qrup</span>
          </Link>

          {/* Statistics */}
          <Link
            href="/stats"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "stats"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Statistika</span>
          </Link>

          {/* Admin panel routes if user is admin */}
          {user.role === "admin" && (activeGroupId === "default" || groups.find(g => g.id === activeGroupId)?.createdBy === user.uid) && (
            <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#D5A85A] font-bold px-4">Admin</span>
              <Link
                href="/admin"
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all font-semibold text-xs ${
                  activeTab === "admin"
                    ? "bg-[#F7F4EB] text-[#0F3D2C]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>İnzibatçı Paneli</span>
              </Link>
              {(activeTab === "admin" || activeTab === "ai") && (
                <Link
                  href="/admin/ai"
                  className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all font-semibold text-xs ${
                    activeTab === "ai"
                      ? "bg-[#F7F4EB] text-[#0F3D2C]"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8.01" y2="16" />
                    <line x1="16" y1="16" x2="16.01" y2="16" />
                    <path d="M9 11V9a3 3 0 0 1 6 0v2" />
                  </svg>
                  <span>AI Köməkçi</span>
                </Link>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="relative z-10 border-t border-white/10 pt-4 flex flex-col gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-semibold text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Çıxış</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        
        {/* Desktop Top Header Bar (Action area for bell) */}
        <header className="hidden md:flex justify-end items-center px-8 py-5 border-b border-[#0F3D2C]/5 bg-transparent">
          <div className="flex items-center gap-4 relative">
            
            {/* AI Icon (Desktop) - ONLY visible on Admin page */}
            {user.role === "admin" && activeTab === "admin" && (
              <Link
                href="/admin/ai"
                className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#0F3D2C]/10 flex items-center justify-center text-[#0F3D2C] hover:bg-white hover:shadow-sm transition-all focus:outline-none"
                title="AI Köməkçi"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
                  <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
                </svg>
              </Link>
            )}

            {/* Notification Bell */}
            {/* Notification Bell */}
            {activeTab === "dashboard" && (
              <>
                <button 
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    setIsProfileOpen(false);
                  }}
                  className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#0F3D2C]/10 flex items-center justify-center text-[#0F3D2C] hover:bg-white hover:shadow-sm transition-all focus:outline-none relative"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#D5A85A] rounded-full border-2 border-[#FAF7F2]" />
                </button>

                {/* Notifications Dropdown */}
                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-12 top-0 w-52 bg-white border border-[#0F3D2C]/10 rounded-xl shadow-xl z-50 p-2 animate-fadeIn">
                    <button
                      onClick={async () => {
                        setIsNotificationsOpen(false);
                        if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
                          try {
                            const permission = await Notification.requestPermission();
                            if (permission === "granted") {
                              const registration = await navigator.serviceWorker.ready;
                              const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
                              const subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(publicKey)
                              });
                              await addPushSubscription(user.uid, JSON.stringify(subscription));
                              alert("Bildirişlər uğurla aktiv edildi!");
                            } else {
                              alert("Bildiriş icazəsi rədd edildi: " + permission);
                            }
                          } catch (err) {
                            console.error("Subscription error:", err);
                            alert("Bildirişləri aktiv edərkən xəta baş verdi: " + (err instanceof Error ? err.message : String(err)));
                          }
                        } else {
                          alert("Cihazınız və ya brauzeriniz Web Push bildirişləri dəstəkləmir.");
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[#FAF7F2] rounded-lg transition-colors text-[#0F3D2C] flex items-center gap-1.5"
                    >
                      <span>🔔</span> Bildirişləri Aktiv Et
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Profile Avatar Icon - ONLY visible on Dashboard, to the right of the Bell */}
            {activeTab === "dashboard" && (
              <>
                <button
                  onClick={() => {
                    setIsProfileOpen(!isProfileOpen);
                    setIsNotificationsOpen(false);
                  }}
                  className="w-10 h-10 rounded-full overflow-hidden border border-[#0F3D2C]/20 shadow-sm flex items-center justify-center bg-[#EAE3D5] text-[#0F3D2C] font-bold text-sm hover:border-[#0F3D2C]/40 transition-colors"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-12 top-0 w-52 bg-white border border-[#0F3D2C]/10 rounded-xl shadow-xl z-50 p-3 animate-fadeIn text-[#0F3D2C]">
                    <div className="flex flex-col gap-1.5 pb-2 border-b border-[#0F3D2C]/5 mb-1.5">
                      <span className="text-xs font-bold">{user.name}</span>
                      <span className="text-[10px] text-[#0F3D2C]/60 truncate">{user.email}</span>
                      <span className="text-[10px] uppercase font-bold text-[#D5A85A] tracking-wider mt-0.5">
                        Rol: {user.role === "admin" ? "İnzibatçı" : "İştirakçı"}
                      </span>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                    >
                      Sistemdən Çıxış
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </header>

        <header className="md:hidden sticky top-0 z-30 bg-[#0F3D2C] text-white border-b border-[#D5A85A]/20 px-4 py-3 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#D5A85A]/25">
              <img 
                src="/logo.png" 
                alt="Xətm App" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-base font-serif font-bold tracking-wide">Xətm App</span>
          </div>

          {/* Group Selector for Mobile */}
          {user && (
            <select
              value={activeGroupId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setShowCreateGroupModal(true);
                } else {
                  setActiveGroupId(e.target.value);
                }
              }}
              className="mx-2 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white font-bold text-[10px] outline-none focus:border-white/40 transition-colors max-w-[120px] truncate"
            >

              {groups.map((g) => (
                <option key={g.id} value={g.id} className="text-black font-semibold">{g.name}</option>
              ))}
              <option value="__new__" className="text-[#D5A85A] font-bold">+ Yeni...</option>
            </select>
          )}

          <div className="flex items-center gap-2 relative">
            {/* AI Icon (Mobile Header) - ONLY visible on Admin page */}
            {user.role === "admin" && activeTab === "admin" && (
              <Link
                href="/admin/ai"
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
                  <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
                </svg>
              </Link>
            )}

            {/* Mobile Notification Bell */}
            {activeTab === "dashboard" && (
              <>
                <button
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    setIsProfileOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-all relative"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#D5A85A] rounded-full border border-[#0F3D2C]" />
                </button>

                {/* Mobile Notifications Dropdown - ONLY has Bildirişləri Aktiv Et */}
                {isNotificationsOpen && (
                  <div className="absolute right-8 mt-10 top-0 w-44 bg-[#0F3D2C] border border-white/10 rounded-xl shadow-2xl z-50 p-2 animate-fadeIn text-white">
                    <button
                      onClick={async () => {
                        setIsNotificationsOpen(false);
                        if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
                          try {
                            const permission = await Notification.requestPermission();
                            if (permission === "granted") {
                              const registration = await navigator.serviceWorker.ready;
                              const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
                              const subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(publicKey)
                              });
                              await addPushSubscription(user.uid, JSON.stringify(subscription));
                              alert("Bildirişlər uğurla aktiv edildi!");
                            } else {
                              alert("Bildiriş icazəsi rədd edildi: " + permission);
                            }
                          } catch (err) {
                            console.error("Subscription error:", err);
                          }
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span>🔔</span> Bildirişləri Aktiv Et
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Mobile Profile Avatar - ONLY visible on Dashboard, to the right of the Bell */}
            {activeTab === "dashboard" && (
              <>
                <button
                  onClick={() => {
                    setIsProfileOpen(!isProfileOpen);
                    setIsNotificationsOpen(false);
                  }}
                  className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shadow-sm flex items-center justify-center bg-white/10 text-white font-bold text-xs hover:bg-white/25 transition-all"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </button>

                {/* Mobile Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-10 top-0 w-44 bg-[#0F3D2C] border border-white/10 rounded-xl shadow-2xl z-50 p-3 animate-fadeIn text-white text-xs">
                    <div className="flex flex-col gap-1 pb-2 border-b border-white/10 mb-1.5">
                      <span className="font-bold">{user.name}</span>
                      <span className="text-[10px] text-white/60 truncate">{user.email}</span>
                      <span className="text-[9px] uppercase font-bold text-[#D5A85A] tracking-wider mt-0.5">
                        Rol: {user.role === "admin" ? "İnzibatçı" : "İştirakçı"}
                      </span>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      Sistemdən Çıxış
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 min-w-0 relative z-10 bg-[#F7F4EB]">
          {isApproved ? children : <ApprovalPendingScreen user={user} logout={logout} />}
        </main>
      </div>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F3D2C] border-t border-white/10 flex justify-around items-center py-2 shadow-2xl pb-safe">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "dashboard" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Panel</span>
        </Link>
        <Link
          href="/readings"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "readings" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Səhifələr</span>
        </Link>
        <Link
          href="/progress"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "progress" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 18v-1a3 3 0 0 1 3-3h1" />
            <circle cx="7" cy="10" r="2" />
            <path d="M16 14h1a3 3 0 0 1 3 3v1" />
            <circle cx="17" cy="10" r="2" />
            <path d="M8 21v-1.5a3.5 3.5 0 0 1 7 0V21" />
            <circle cx="11.5" cy="7" r="2.5" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Qrup</span>
        </Link>
        <Link
          href="/stats"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "stats" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Statistika</span>
        </Link>
        {user.role === "admin" && (activeGroupId === "default" || groups.find(g => g.id === activeGroupId)?.createdBy === user.uid) && (
          <Link
            href="/admin"
            className={`flex flex-col items-center py-1 px-3 rounded-lg ${
              activeTab === "admin" ? "text-[#D5A85A]" : "text-white/50"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[9px] font-semibold mt-0.5">Admin</span>
          </Link>
        )}
      </nav>

      {/* Group Creation Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#FAF7F2] border border-[#0F3D2C]/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-[#0F3D2C]">
            <h3 className="text-lg font-bold text-[#0F3D2C] mb-2 font-serif">Yeni Xətm Qrupu Yarat</h3>
            <p className="text-xs text-[#0F3D2C]/70 mb-4 font-sans">
              Yeni qrup yaradaraq Quranın 30 cüzünü iştirakçılar arasında bölüşdürün.
            </p>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4 font-sans">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#0F3D2C]/80">Qrup Adı</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Məs. Vəfa Qrupu"
                  disabled={createGroupLoading}
                  className="px-3.5 py-2.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-xl text-xs font-semibold text-[#0F3D2C] placeholder-[#0F3D2C]/30 focus:outline-none transition-colors"
                />
              </div>

              {createGroupError && (
                <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                  {createGroupError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName("");
                    setCreateGroupError(null);
                  }}
                  disabled={createGroupLoading}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={createGroupLoading}
                  className="px-4 py-2.5 bg-[#0F3D2C] hover:bg-[#16503c] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {createGroupLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Yaradılır...</span>
                    </>
                  ) : (
                    <span>Yarat</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
    <div className="w-full flex flex-col justify-center items-center py-12 px-4 relative z-10">
      <div className="card-premium w-full max-w-md p-8 flex flex-col items-center text-center relative z-10 shadow-2xl border border-[#D5A85A]/20">
        {/* Mosque Dome & Quran Icon */}
        <div className="w-16 h-16 bg-[#0F3D2C] rounded-2xl flex items-center justify-center border border-[#D5A85A]/30 mb-6 shadow-md">
          <span className="text-3xl">🕌</span>
        </div>

        <h1 className="text-2xl font-bold text-[#0F3D2C] mb-3">
          Giriş Təsdiqi Gözlənilir
        </h1>

        <p className="text-sm text-[#0F3D2C]/70 leading-relaxed mb-6 font-sans">
          {groupName ? (
            <>
              Sizin <strong>“{groupName}”</strong> qrupuna qoşulmaq istəyiniz qeydə alınıb. Hesabınızın aktivləşdirilməsi və qrupa daxil edilməyiniz üçün qrup inzibatçısının təsdiqi lazımdır.
            </>
          ) : (
            "Sizin sistem qrupuna qoşulmaq istəyiniz qeydə alınıb. Hesabınızın aktivləşdirilməsi üçün inzibatçının təsdiqi lazımdır."
          )}
          <br />
          <span className="block mt-4 text-xs font-semibold text-[#D5A85A]">
            Zəhmət olmasa, adminin təsdiq etməsini gözləyin.
          </span>
        </p>

        <button
          onClick={logout}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
        >
          Çıxış (Sistemdən ayrıl)
        </button>


      </div>
    </div>
  );
}
