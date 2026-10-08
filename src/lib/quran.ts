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

// First surah of the juz that contains the page
export function surahForPage(page: number): string {
  return JUZ_MAP[juzOfPage(page)]?.surah.split(" - ")[0] || `Səhifə ${page}`;
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
