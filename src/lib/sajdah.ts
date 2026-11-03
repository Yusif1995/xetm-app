// The 14 ayahs of prostration (tilavət səcdəsi) in the list the owner gave (Diyanet numbering),
// and where each one sits on the reader's page image (public/mushaf/{page}.webp, the "Bilgisayar hatlı" edition).
// Every page has 15 lines on the same grid; a surah banner takes the place of two lines.
// Each part is [line 1..15, from, to], from/to measured from the left edge of the image (0..1),
// read off the ayah markers on the image itself. Re-check these if the mushaf is re-exported.

export interface SajdahAyah {
  page: number;
  surah: string;
  ayah: number;
  parts: [number, number, number][];
}

export const SAJDAH_AYAHS: SajdahAyah[] = [
  { page: 175, surah: "Əl-Əraf", ayah: 206, parts: [[14, 0, 0.36], [15, 0, 1]] },
  { page: 250, surah: "Ər-Rəd", ayah: 15, parts: [[3, 0, 0.594], [4, 0.343, 1]] },
  { page: 271, surah: "Ən-Nəhl", ayah: 49, parts: [[9, 0, 1], [10, 0.435, 1]] },
  { page: 292, surah: "Əl-İsra", ayah: 107, parts: [[3, 0, 1], [4, 0.365, 1]] },
  { page: 308, surah: "Məryəm", ayah: 58, parts: [[5, 0, 0.127], [6, 0, 1], [7, 0, 1], [8, 0.151, 1]] },
  { page: 333, surah: "Əl-Həcc", ayah: 18, parts: [[4, 0, 0.176], [5, 0, 1], [6, 0, 1], [7, 0, 1], [8, 0.301, 1]] },
  { page: 364, surah: "Əl-Furqan", ayah: 60, parts: [[6, 0, 0.647], [7, 0.136, 1]] },
  { page: 378, surah: "Ən-Nəml", ayah: 25, parts: [[4, 0, 0.648], [5, 0.084, 1]] },
  { page: 415, surah: "Əs-Səcdə", ayah: 15, parts: [[6, 0, 0.472], [7, 0, 1], [8, 0.696, 1]] },
  { page: 453, surah: "Sad", ayah: 24, parts: [[8, 0, 0.153], [9, 0, 1], [10, 0, 1], [11, 0.016, 1]] },
  { page: 479, surah: "Fussilət", ayah: 37, parts: [[12, 0, 1], [13, 0, 1], [14, 0.564, 1]] },
  { page: 527, surah: "Ən-Nəcm", ayah: 62, parts: [[8, 0.016, 0.441]] },
  { page: 589, surah: "Əl-İnşiqaq", ayah: 21, parts: [[3, 0.149, 0.735]] },
  { page: 597, surah: "Əl-Ələq", ayah: 19, parts: [[13, 0.015, 0.659]] },
];

// Page image size in pixels and the line grid on it (as fractions of the height)
export const PAGE_IMAGE = { width: 1001, height: 1716 };
export const LINE_TOP = 0.007;
export const LINE_HEIGHT = 0.06655;

export function sajdahOnPage(page: number): SajdahAyah | null {
  return SAJDAH_AYAHS.find((s) => s.page === page) || null;
}
