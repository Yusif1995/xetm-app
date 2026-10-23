// Juz helpers shared by the UI. Page ranges use the app's existing 20-pages-per-juz scheme.

// 1-30 Cüz üzrə Surə aralıqları
export const JUZ_MAP: Record<number, { surah: string }> = {
  1: { surah: "Əl-Fatihə - Əl-Bəqərə" },
  2: { surah: "Əl-Bəqərə" },
  3: { surah: "Əl-Bəqərə - Ali-İmran" },
  4: { surah: "Ali-İmran - An-Nisa" },
  5: { surah: "An-Nisa" },
  6: { surah: "An-Nisa - Al-Maidə" },
  7: { surah: "Al-Maidə - Al-Ənam" },
  8: { surah: "Al-Ənam - Al-Əraf" },
  9: { surah: "Al-Əraf - Al-Ənfal" },
  10: { surah: "Al-Ənfal - At-Tövbə" },
  11: { surah: "At-Tövbə - Hud" },
  12: { surah: "Hud - Yusuf" },
  13: { surah: "Yusuf - İbrahim" },
  14: { surah: "Al-Hicr - An-Nahl" },
  15: { surah: "Al-İsra - Al-Kəhf" },
  16: { surah: "Al-Kəhf - Taha" },
  17: { surah: "Al-Ənbiya - Al-Həcc" },
  18: { surah: "Al-Muminun - Al-Furqan" },
  19: { surah: "Al-Furqan - An-Naml" },
  20: { surah: "An-Naml - Al-Ankabut" },
  21: { surah: "Al-Ankabut - Al-Ahzab" },
  22: { surah: "Al-Ahzab - Yasin" },
  23: { surah: "Yasin - Az-Zumar" },
  24: { surah: "Az-Zumar - Fussilat" },
  25: { surah: "Fussilat - Al-Jasiya" },
  26: { surah: "Al-Ahqaf - Az-Zariyat" },
  27: { surah: "Az-Zariyat - Al-Hadid" },
  28: { surah: "Al-Mujadilah - At-Tahrim" },
  29: { surah: "Al-Mulk - Al-Mursalat" },
  30: { surah: "Ən-Nəbə - Ən-Nas" }
};

export function juzPageRange(juz: number): { start: number; end: number } {
  return { start: (juz - 1) * 20 + 1, end: juz === 30 ? 604 : juz * 20 };
}

export function juzPages(juz: number): number[] {
  const { start, end } = juzPageRange(juz);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export function juzOfPage(page: number): number {
  return Math.min(30, Math.floor((page - 1) / 20) + 1);
}

// Surah names and the page each one starts on in the standard 604-page Medina mushaf
const SURAHS: [string, number][] = [
  ["Əl-Fatihə", 1], ["Əl-Bəqərə", 2], ["Ali-İmran", 50], ["Ən-Nisa", 77], ["Əl-Maidə", 106],
  ["Əl-Ənam", 128], ["Əl-Əraf", 151], ["Əl-Ənfal", 177], ["Ət-Tövbə", 187], ["Yunus", 208],
  ["Hud", 221], ["Yusuf", 235], ["Ər-Rəd", 249], ["İbrahim", 255], ["Əl-Hicr", 262],
  ["Ən-Nəhl", 267], ["Əl-İsra", 282], ["Əl-Kəhf", 293], ["Məryəm", 305], ["Taha", 312],
  ["Əl-Ənbiya", 322], ["Əl-Həcc", 332], ["Əl-Muminun", 342], ["Ən-Nur", 350], ["Əl-Furqan", 359],
  ["Əş-Şuəra", 367], ["Ən-Nəml", 377], ["Əl-Qəsəs", 385], ["Əl-Ənkəbut", 396], ["Ər-Rum", 404],
  ["Loğman", 411], ["Əs-Səcdə", 415], ["Əl-Əhzab", 418], ["Səba", 428], ["Fatir", 434],
  ["Yasin", 440], ["Əs-Saffat", 446], ["Sad", 453], ["Əz-Zumər", 458], ["Ğafir", 467],
  ["Fussilət", 477], ["Əş-Şura", 483], ["Əz-Zuxruf", 489], ["Əd-Duxan", 496], ["Əl-Casiyə", 499],
  ["Əl-Əhqaf", 502], ["Muhəmməd", 507], ["Əl-Fəth", 511], ["Əl-Hucurat", 515], ["Qaf", 518],
  ["Əz-Zariyat", 520], ["Ət-Tur", 523], ["Ən-Nəcm", 526], ["Əl-Qəmər", 528], ["Ər-Rəhman", 531],
  ["Əl-Vaqiə", 534], ["Əl-Hədid", 537], ["Əl-Mucadilə", 542], ["Əl-Həşr", 545], ["Əl-Mumtəhinə", 549],
  ["Əs-Saff", 551], ["Əl-Cumuə", 553], ["Əl-Munafiqun", 554], ["Ət-Təğabun", 556], ["Ət-Talaq", 558],
  ["Ət-Təhrim", 560], ["Əl-Mulk", 562], ["Əl-Qələm", 564], ["Əl-Haqqə", 566], ["Əl-Məaric", 568],
  ["Nuh", 570], ["Əl-Cinn", 572], ["Əl-Muzzəmmil", 574], ["Əl-Muddəssir", 575], ["Əl-Qiyamə", 577],
  ["Əl-İnsan", 578], ["Əl-Mursəlat", 580], ["Ən-Nəbə", 582], ["Ən-Naziat", 583], ["Əbəsə", 585],
  ["Ət-Təkvir", 586], ["Əl-İnfitar", 587], ["Əl-Mutəffifin", 587], ["Əl-İnşiqaq", 589], ["Əl-Buruc", 590],
  ["Ət-Tariq", 591], ["Əl-Əla", 591], ["Əl-Ğaşiyə", 592], ["Əl-Fəcr", 593], ["Əl-Bələd", 594],
  ["Əş-Şəms", 595], ["Əl-Leyl", 595], ["Əd-Duha", 596], ["Əş-Şərh", 596], ["Ət-Tin", 597],
  ["Əl-Ələq", 597], ["Əl-Qədr", 598], ["Əl-Bəyyinə", 598], ["Əz-Zəlzələ", 599], ["Əl-Adiyat", 599],
  ["Əl-Qariə", 600], ["Ət-Təkasur", 600], ["Əl-Əsr", 601], ["Əl-Huməzə", 601], ["Əl-Fil", 601],
  ["Qureyş", 602], ["Əl-Maun", 602], ["Əl-Kövsər", 602], ["Əl-Kafirun", 603], ["Ən-Nəsr", 603],
  ["Əl-Məsəd", 603], ["Əl-İxlas", 604], ["Əl-Fələq", 604], ["Ən-Nas", 604],
];

// Surah the page belongs to: the last surah that starts on or before it
export function surahForPage(page: number): string {
  let name = SURAHS[0][0];
  for (const [surah, start] of SURAHS) {
    if (start > page) break;
    name = surah;
  }
  return name;
}

// "Əl-Bəqərə - Ali-İmran" style label for a list of juzs
export function surahRangeLabel(juzs: number[]): string {
  if (juzs.length === 0) return "";
  const first = juzs[0];
  const last = juzs[juzs.length - 1];
  if (first === last) return JUZ_MAP[first]?.surah || "";
  const firstSurah = JUZ_MAP[first]?.surah.split(" - ")[0] || "";
  const lastSurah = JUZ_MAP[last]?.surah.split(" - ").pop() || "";
  return `${firstSurah} - ${lastSurah}`;
}

// Compact "1–20, 35" label for a page list
export function pageRangesLabel(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join(", ");
}

// Azerbaijani ordinal suffix: 1-ci, 3-cü, 6-cı, 9-cu, 10-cu, 40-cı, 100-cü ...
export function ordinalAz(n: number): string {
  const lastDigit: Record<number, string> = { 1: "ci", 2: "ci", 3: "cü", 4: "cü", 5: "ci", 6: "cı", 7: "ci", 8: "ci", 9: "cu" };
  const tens: Record<number, string> = { 10: "cu", 20: "ci", 30: "cu", 40: "cı", 50: "ci", 60: "cı", 70: "ci", 80: "ci", 90: "cı" };
  let suffix = "ci";
  if (n % 10 !== 0) suffix = lastDigit[n % 10];
  else if (n % 100 !== 0) suffix = tens[n % 100];
  else if (n % 1000 !== 0) suffix = "cü";
  return `${n}-${suffix}`;
}

export function khatmLabel(khatm: number): string {
  return `${ordinalAz(khatm)} xətm`;
}
