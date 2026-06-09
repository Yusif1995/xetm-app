import fs from "fs";
import path from "path";

// 114 Surah names in Azerbaijani
export const SURAH_NAMES = [
  "", // 0-index empty
  "Əl-Fatihə", "Əl-Bəqərə", "Ali-İmran", "An-Nisa", "Al-Maidə", "Al-Ənam", "Al-Əraf", "Al-Ənfal", "At-Tövbə", "Yunus",
  "Hud", "Yusuf", "Ar-Rad", "İbrahim", "Al-Hicr", "An-Nahl", "Al-İsra", "Al-Kəhf", "Məryəm", "Taha",
  "Al-Ənbiya", "Al-Həcc", "Al-Muminun", "An-Nur", "Al-Furqan", "Ash-Shuara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Yasin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
  "Fussilat", "Ash-Shura", "Az-Zuxruf", "Ad-Duxan", "Al-Jasiya", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Az-Zariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqiah", "Al-Hadid", "Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah",
  "As-Saff", "Al-Jumuah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Maarij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddassir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Naziat", "Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-Ala", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh (İnşirah)", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Al-Zalzalah", "Al-Adiyat",
  "Al-Qariah", "At-Takasur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Maun", "Al-Kawsar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
];

interface QuranVerse {
  c: number; // chapter
  v: number; // verse
  t: string; // text
}

// Stop words to filter out during search
const AZ_STOP_WORDS = new Set([
  "mənə", "haqqında", "üçün", "olan", "olanlar", "olar", "yaz", "gətir", "nədir", "necə", "hansı", "və", "ilə", "bir", "bu", "o", "ki", "da", "də", "həm", "həmin", "hər", "öz", "dini", "məlumat", "ayə", "ayəsi", "hədis", "hədisi"
]);

let cachedQuran: QuranVerse[] | null = null;

function loadQuranData(): QuranVerse[] {
  if (cachedQuran) return cachedQuran;
  try {
    const filePath = path.join(process.cwd(), "src", "lib", "quran-az.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    cachedQuran = JSON.parse(fileContent);
    return cachedQuran || [];
  } catch (error) {
    console.error("Error loading Quran JSON file:", error);
    return [];
  }
}

export function searchQuran(query: string, maxResults = 8) {
  const quran = loadQuranData();
  if (!quran.length) return [];

  // Normalize and tokenize the query
  const cleanQuery = query
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const queryWords = cleanQuery
    .split(" ")
    .filter(word => word.length >= 3 && !AZ_STOP_WORDS.has(word));

  if (queryWords.length === 0) {
    // If no search keywords, return empty to fallback to model knowledge base
    return [];
  }

  // Calculate scores for each verse
  const scoredVerses = quran.map(verse => {
    let score = 0;
    const verseTextLower = verse.t.toLowerCase();

    queryWords.forEach(word => {
      // Check if keyword is in verse text
      if (verseTextLower.includes(word)) {
        score += 2; // base match
        
        // Exact word match bonus (e.g. "səbr" vs "səbrləri")
        const regex = new RegExp(`\\b${word}\\b`, "i");
        if (regex.test(verseTextLower)) {
          score += 3;
        }
      }
    });

    return { verse, score };
  });

  // Filter out verses with no match and sort by score descending
  const matches = scoredVerses
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => ({
      chapter: item.verse.c,
      chapterName: SURAH_NAMES[item.verse.c] || `Surə ${item.verse.c}`,
      verse: item.verse.v,
      text: item.verse.t,
      score: item.score
    }));

  return matches;
}
