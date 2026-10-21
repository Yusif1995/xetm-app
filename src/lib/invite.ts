const STORAGE_KEY = "pendingInviteGroupId";
// Set by the middleware when an invite link is opened; shared by every tab of the browser and,
// on Android, by the installed home-screen app
export const INVITE_COOKIE = "pending_invite";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null; // private mode or blocked storage
  }
}

function inviteFromCookie(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${INVITE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function rememberInvite(groupId: string): void {
  if (typeof window === "undefined" || !ID_PATTERN.test(groupId)) return;
  attempt(() => localStorage.setItem(STORAGE_KEY, groupId));
  attempt(() => sessionStorage.setItem(STORAGE_KEY, groupId));
}

// The invite this browser came with: the link itself, else anything remembered from it earlier
// (the link is often opened in WhatsApp's browser and the app continued in Chrome or from the home screen)
export function readPendingInvite(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("invite") || "";
  if (ID_PATTERN.test(fromUrl)) {
    rememberInvite(fromUrl);
    return fromUrl;
  }
  const stored = attempt(() => localStorage.getItem(STORAGE_KEY))
    || attempt(() => sessionStorage.getItem(STORAGE_KEY))
    || attempt(() => inviteFromCookie())
    || "";
  return ID_PATTERN.test(stored) ? stored : "";
}

export function clearPendingInvite(): void {
  if (typeof window === "undefined") return;
  attempt(() => localStorage.removeItem(STORAGE_KEY));
  attempt(() => sessionStorage.removeItem(STORAGE_KEY));
  attempt(() => { document.cookie = `${INVITE_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`; });
}

// Reads a group id out of an invite link ("https://…/?invite=ID"), a pasted "invite=ID" fragment,
// or a bare group id. Returns "" when nothing usable is found.
export function parseInviteId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.searchParams.get("invite") || "";
  } catch {
    const match = value.match(/invite=([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : "";
  }
}
