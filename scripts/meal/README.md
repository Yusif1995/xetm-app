# Meal and ayah positions (public/meal)

`public/meal/{page}.json` holds, for each mushaf page, the ayahs on it in reading order, where each
one sits on the page image, and Suat Yıldırım's meal with his explanations. The reader
(`src/app/oxu`, `src/components/MealView.tsx`, `src/lib/meal.ts`) uses it for the Meal view and for
holding an ayah on the mushaf.

How it was built (2026-11-17). The scripts were run once by hand. Their input and output paths
point to a temp folder, so adjust them before running again.

1. `1-markers.py`: finds the ayah markers (brown medallions, about 46 px, the halves of
   three-digit markers merged) and the surah banners on `public/mushaf/*.webp`. It writes them in
   reading order (line, then right to left).
2. `2-zones.py`: gives the markers on pages 2..604 their ayahs in order, using the ayah counts in
   `src/lib/quran-az.json`. Page 1 (two panels) holds al-Fatiha 1-7 and al-Baqara 1-5 and has no
   positions. Every one of the 6224 markers was found. Each surah's first ayah lands on its start
   page in `src/lib/quran.ts`. An ayah area runs from the previous marker to its own.
3. `3-parse-meal.py`: reads the meal PDF with PyMuPDF. The meal text is dark, and the
   explanations and the ayah numbers are magenta. Ayahs the book renders together ("38-39 –",
   "28,29 –") become one entry with `to`.
4. A short assembly step wrote one file per page. It moves `[refs]` out of the explanations and
   adds empty entries for ayahs the book lacks.

Known gaps in the source PDF: al-Baqara 94 (text cut off), al-Mursalat 32 (merged into 31) and
al-Qalam 43-52 (the pages carry at-Talaq text). These ayahs show "Bu ayənin məalı mənbə kitabda
yoxdur".

The positions depend on the page images. After a re-export of `public/mushaf`, rebuild them and
bump `MEAL_VERSION` in `src/lib/meal.ts`.
