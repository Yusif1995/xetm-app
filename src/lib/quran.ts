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

// Surah names and the page each one starts on in the app's mushaf (Hayrat Neşriyat, 604 pages,
// every juz 20 pages). Starts were read from the surah banners of that PDF; a banner at the very
// bottom of a page counts for the next page, where the surah's text begins.
const SURAHS: [string, number][] = [
  ["Əl-Fatihə", 1], ["Əl-Bəqərə", 2], ["Ali-İmran", 49], ["Ən-Nisa", 76], ["Əl-Maidə", 105],
  ["Əl-Ənam", 127], ["Əl-Əraf", 150], ["Əl-Ənfal", 176], ["Ət-Tövbə", 186], ["Yunus", 207],
  ["Hud", 220], ["Yusuf", 234], ["Ər-Rəd", 248], ["İbrahim", 254], ["Əl-Hicr", 261],
  ["Ən-Nəhl", 266], ["Əl-İsra", 281], ["Əl-Kəhf", 292], ["Məryəm", 304], ["Taha", 311],
  ["Əl-Ənbiya", 321], ["Əl-Həcc", 331], ["Əl-Muminun", 341], ["Ən-Nur", 349], ["Əl-Furqan", 358],
  ["Əş-Şuəra", 366], ["Ən-Nəml", 376], ["Əl-Qəsəs", 384], ["Əl-Ənkəbut", 395], ["Ər-Rum", 403],
  ["Loğman", 410], ["Əs-Səcdə", 414], ["Əl-Əhzab", 417], ["Səba", 427], ["Fatir", 433],
  ["Yasin", 439], ["Əs-Saffat", 445], ["Sad", 452], ["Əz-Zumər", 457], ["Ğafir", 466],
  ["Fussilət", 476], ["Əş-Şura", 482], ["Əz-Zuxruf", 488], ["Əd-Duxan", 495], ["Əl-Casiyə", 498],
  ["Əl-Əhqaf", 501], ["Muhəmməd", 506], ["Əl-Fəth", 510], ["Əl-Hucurat", 514], ["Qaf", 517],
  ["Əz-Zariyat", 519], ["Ət-Tur", 522], ["Ən-Nəcm", 525], ["Əl-Qəmər", 527], ["Ər-Rəhman", 530],
  ["Əl-Vaqiə", 533], ["Əl-Hədid", 536], ["Əl-Mucadilə", 541], ["Əl-Həşr", 544], ["Əl-Mumtəhinə", 548],
  ["Əs-Saff", 550], ["Əl-Cumuə", 552], ["Əl-Munafiqun", 553], ["Ət-Təğabun", 555], ["Ət-Talaq", 557],
  ["Ət-Təhrim", 559], ["Əl-Mulk", 561], ["Əl-Qələm", 563], ["Əl-Haqqə", 565], ["Əl-Məaric", 567],
  ["Nuh", 569], ["Əl-Cinn", 571], ["Əl-Muzzəmmil", 573], ["Əl-Muddəssir", 574], ["Əl-Qiyamə", 576],
  ["Əl-İnsan", 577], ["Əl-Mursəlat", 579], ["Ən-Nəbə", 581], ["Ən-Naziat", 582], ["Əbəsə", 584],
  ["Ət-Təkvir", 585], ["Əl-İnfitar", 586], ["Əl-Mutəffifin", 587], ["Əl-İnşiqaq", 588], ["Əl-Buruc", 589],
  ["Ət-Tariq", 590], ["Əl-Əla", 591], ["Əl-Ğaşiyə", 591], ["Əl-Fəcr", 592], ["Əl-Bələd", 593],
  ["Əş-Şəms", 594], ["Əl-Leyl", 595], ["Əd-Duha", 595], ["Əş-Şərh", 596], ["Ət-Tin", 596],
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
