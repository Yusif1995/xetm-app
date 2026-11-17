// What's new: shown once on each device after an update, as full-screen slides (WhatsNew.tsx).
// Add a release at the top for every update members should hear about; `id` must be new each time.
// `art` picks one of the drawings in WhatsNew.tsx.

export type ReleaseArt = "meal" | "listen" | "hold" | "nextJuz" | "sideways" | "toolbar";

export interface ReleaseSlide {
  title: string;
  text: string;
  art: ReleaseArt;
}

export interface Release {
  id: string;
  date: string; // as shown, in Azerbaijani
  slides: ReleaseSlide[];
}

export const RELEASES: Release[] = [
  {
    id: "2026-11-17-anim",
    date: "17 noyabr",
    slides: [
      {
        title: "Meal",
        text: "Quranda aşağıdakı «Meal» düyməsi səhifəni Suat Yıldırımın məalına çevirir. Açıqlamalar gizlidir, istəyən basıb oxuyur.",
        art: "meal",
      },
      {
        title: "Səhifəni dinləyin",
        text: "«Dinlə» düyməsi Səd əl-Ğamidinin qiraəti ilə bütün səhifəni oxuyur. Oxunan ayə qızılı rənglə işıqlanır.",
        art: "listen",
      },
      {
        title: "Ayəni basılı saxlayın",
        text: "Ayənin üstündə barmağınızı bir az saxlayın: menyudan onun məalını açın və ya yalnız o ayəni dinləyin.",
        art: "hold",
      },
      {
        title: "Yeni alət paneli",
        text: "Səhifəyə bir dəfə basın: bütün düymələr aşağıdadır, barmağın çatdığı yerdə. Ortadakı böyük düymə «Oxudum»dur.",
        art: "toolbar",
      },
      {
        title: "Növbəti cüz açılır",
        text: "Səhifələrimdə cari cüzün səhifələrini oxuduqca növbədəki cüz yaşıl işıqla yavaş-yavaş görünür.",
        art: "nextJuz",
      },
      {
        title: "Yan çevirib oxuyun",
        text: "Telefonu və ya planşeti yan çevirəndə səhifə bütün eni tutur, yazı iri görünür. Aşağı sürüşdürüb oxuyursunuz.",
        art: "sideways",
      },
    ],
  },
];
