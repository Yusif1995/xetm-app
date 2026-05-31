"use client";

import { useEffect, useState } from "react";
import { getGlobalSettings } from "../lib/db";

interface Item {
  text: string;
  translation: string;
  source: string;
  type: "ayah" | "hadith";
}

const DEFAULT_ITEMS: Item[] = [
  {
    text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Şübhəsiz ki, hər çətinliklə bərabər bir asanlıq da vardır.",
    source: "Şərh (İnşirah) surəsi, 5-ci ayə",
    type: "ayah"
  },
  {
    text: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    translation: "Hamınız Allahın ipindən (dinindən) möhkəm yapışın və parçalanmayın!",
    source: "Ali-İmran surəsi, 103-cü ayə",
    type: "ayah"
  },
  {
    text: "إِنَّ اللَّهَ مَعَ الصَّABِرِينَ",
    translation: "Şübhəsiz ki, Allah səbr edənlərlədir.",
    source: "Bəqərə surəsi, 153-cü ayə",
    type: "ayah"
  },
  {
    text: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ",
    translation: "Yaradan Rəbbinin adı ilə oxu!",
    source: "Ələq surəsi, 1-ci ayə",
    type: "ayah"
  },
  {
    text: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    translation: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
    source: "Hədis (Səhih əl-Buxari)",
    type: "hadith"
  },
  {
    text: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
    translation: "Əməllər yalnız niyyətlərə görədir.",
    source: "Hədis (Səhih əl-Buxari və Müslim)",
    type: "hadith"
  }
];

export default function AyahDisplay() {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const settings = await getGlobalSettings();
        if (settings.currentAyah || settings.currentHadith) {
          // If Firestore settings are set, we choose between the configured ayah or hadith randomly
          const options: Item[] = [];
          if (settings.currentAyah) {
            options.push({
              text: settings.currentAyah,
              translation: "Günün Ayəsi",
              source: "Quran-ı Kərim",
              type: "ayah"
            });
          }
          if (settings.currentHadith) {
            options.push({
              text: settings.currentHadith,
              translation: "Günün Hədisi",
              source: "Mənbə qeyd olunmayıb",
              type: "hadith"
            });
          }
          
          if (options.length > 0) {
            const selected = options[Math.floor(Math.random() * options.length)];
            setItem(selected);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load global config from Firestore, falling back to local list:", err);
      }

      // Fallback or default random selection
      const randomIdx = Math.floor(Math.random() * DEFAULT_ITEMS.length);
      setItem(DEFAULT_ITEMS[randomIdx]);
    }

    loadFeatured();
  }, []);

  if (!item) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-pulse flex space-x-2">
          <div className="h-2 w-2 bg-[#c9a84c] rounded-full"></div>
          <div className="h-2 w-2 bg-[#c9a84c] rounded-full"></div>
          <div className="h-2 w-2 bg-[#c9a84c] rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center p-6 bg-[#1a5c38]/10 rounded-xl border border-[#c9a84c]/20 max-w-xl mx-auto shadow-inner">
      <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider text-[#c9a84c] border border-[#c9a84c]/30 rounded-full bg-[#1a5c38]/5">
        {item.type === "ayah" ? "Ayə" : "Hədis"}
      </span>
      
      {/* Arabic text with custom font */}
      <p className="text-2xl md:text-3xl leading-loose font-amiri text-[#fdf6e3] mb-4 direction-rtl select-none tracking-wide text-right md:text-center">
        {item.text}
      </p>

      {/* Translation */}
      <p className="text-sm md:text-base italic text-[#fdf6e3]/80 font-light leading-relaxed mb-3">
        &quot;{item.translation}&quot;
      </p>

      {/* Source */}
      <p className="text-xs text-[#c9a84c] font-medium tracking-wide">
        — {item.source}
      </p>
    </div>
  );
}
