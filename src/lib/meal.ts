"use client";

// Suat Yıldırım's meal (Turkish) with his explanations, one JSON file per mushaf page in
// public/meal/{page}.json. Each file lists the ayahs on the page in reading order, where each sits
// on the page image (z: [line 1..15, from, to], measured from the left edge, the same grid as
// sajdah.ts) and the meal entries those ayahs belong to. Page 1 (al-Fatiha and the opening of
// al-Baqara, two ornamented panels) has no positions. Built from the page images and the meal PDF;
// the files are cached for a year, so a rebuild must bump MEAL_VERSION.
import { useEffect, useState } from "react";

export const MEAL_VERSION = 1;

export interface MealAyah {
  s: number;
  a: number;
  z?: [number, number, number][];
}

export interface MealEntry {
  s: number;
  a: number;
  to?: number; // last ayah when the meal gives several ayahs in one sentence
  m: string; // empty when the source book lacks this ayah
  r?: string; // references to other ayahs, e.g. "[63,3]"
  e?: string[]; // explanation paragraphs
}

export interface MealPage {
  ayahs: MealAyah[];
  meal: MealEntry[];
}

const cache = new Map<number, Promise<MealPage>>();

export function loadMealPage(page: number): Promise<MealPage> {
  let p = cache.get(page);
  if (!p) {
    p = fetch(`/meal/${page}.json?v=${MEAL_VERSION}`).then((r) => {
      if (!r.ok) throw new Error(`meal ${page}: ${r.status}`);
      return r.json() as Promise<MealPage>;
    });
    p.catch(() => cache.delete(page));
    cache.set(page, p);
  }
  return p;
}

export function mealFor(data: MealPage, s: number, a: number): MealEntry | null {
  return data.meal.find((m) => m.s === s && a >= m.a && a <= (m.to ?? m.a)) || null;
}

export function useMealPage(page: number | null): { data: MealPage | null; failed: boolean } {
  const [state, setState] = useState<{ page: number | null; data: MealPage | null; failed: boolean }>({ page: null, data: null, failed: false });
  useEffect(() => {
    if (page === null) return;
    let cancelled = false;
    loadMealPage(page)
      .then((data) => { if (!cancelled) setState({ page, data, failed: false }); })
      .catch(() => { if (!cancelled) setState({ page, data: null, failed: true }); });
    return () => { cancelled = true; };
  }, [page]);
  return state.page === page ? { data: state.data, failed: state.failed } : { data: null, failed: false };
}
