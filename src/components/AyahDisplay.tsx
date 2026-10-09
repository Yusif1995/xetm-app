"use client";

import { useEffect, useState } from "react";

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
    text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
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
        const res = await fetch("/api/daily");
        if (res.ok) {
          const dailyItem = await res.json();
          setItem(dailyItem);
          return;
        }
      } catch (err) {
        console.error("Failed to load daily item from API, falling back to local list:", err);
      }

      // Fallback or default random selection
      const randomIdx = Math.floor(Math.random() * DEFAULT_ITEMS.length);
      setItem(DEFAULT_ITEMS[randomIdx]);
    }

    loadFeatured();
  }, []);

  if (!item) {
    return (
      <div className="flex gap-2 py-6" aria-label="Yüklənir">
        <span className="h-2 w-2 bg-gold rounded-full animate-pulse" />
        <span className="h-2 w-2 bg-gold rounded-full animate-pulse" />
        <span className="h-2 w-2 bg-gold rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <figure className="m-0 rounded-card border border-[rgba(226,184,92,0.35)] bg-tile p-5 md:p-6 flex flex-col gap-3">
      <figcaption className="text-[13px] font-bold text-gold">
        {item.type === "ayah" ? "Günün ayəsi" : "Günün hədisi"}
      </figcaption>
      {item.text && (
        <blockquote dir="rtl" lang="ar" className="m-0 font-amiri text-[26px] md:text-[30px] leading-[1.8] text-cream text-right">
          {item.text}
        </blockquote>
      )}
      <p className="m-0 text-[15px] leading-relaxed text-cream/90">{item.translation}</p>
      <div className="text-[13px] text-onforest">{item.source}</div>
    </figure>
  );
}
