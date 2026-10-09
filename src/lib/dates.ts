// Date formatting helpers (Azerbaijani labels)

const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

const HIJRI_MONTHS = [
  "Məhərrəm", "Səfər", "Rəbiül-Əvvəl", "Rəbiüs-Sani", "Cəmadiyəl-Əvvəl", "Cəmadiyəl-Axır",
  "Rəcəb", "Şaban", "Ramazan", "Şəvval", "Zilqədə", "Zilhiccə",
];

// "9 oktyabr 2026"
export function formatGregorianAz(date: Date, withYear = true): string {
  const base = `${date.getDate()} ${AZ_MONTHS[date.getMonth()]}`;
  return withYear ? `${base} ${date.getFullYear()}` : base;
}

// "28 Rəbiüs-Sani 1448" (Umm al-Qura calendar). Empty string if the runtime lacks the calendar.
export function formatHijriAz(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const year = (parts.find((p) => p.type === "year")?.value || "").replace(/\D/g, "");
    if (!day || !month || month < 1 || month > 12) return "";
    return `${day} ${HIJRI_MONTHS[month - 1]}${year ? ` ${year}` : ""}`;
  } catch {
    return "";
  }
}

// "dd.mm.yyyy" from "yyyy-mm-dd"
export function formatIsoDateAz(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
}

export function relativeTimeAz(time: number): string {
  const diffMin = Math.floor((Date.now() - time) / 60000);
  if (diffMin < 1) return "indi";
  if (diffMin < 60) return `${diffMin} dəq əvvəl`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} saat əvvəl`;
  const days = Math.floor(diffMin / 1440);
  if (days === 1) return "dünən";
  return `${days} gün əvvəl`;
}
