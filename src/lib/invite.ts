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
