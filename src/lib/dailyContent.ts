// Daily ayah and hadith, and the short encouragements shown after "Oxudum".
// Ayahs: Arabic (Uthmani script) and the Azerbaijani translation of Alikhan Musayev, taken verbatim
// from api.alquran.cloud (editions quran-uthmani and az.musayev). Do not edit ayah text by hand.
// Hadiths: Azerbaijani renderings of well-known sahih narrations with their standard references
// (Bukhari and Tirmidhi by sunnah.com numbering, Muslim by Abdul-Baqi numbering).

export interface DailyItem {
  text: string;        // Arabic, empty when not shown
  translation: string; // Azerbaijani
  source: string;
}

interface AyahItem extends DailyItem {
  ref: string;
  reading: boolean; // about reading the Quran, patience or steadiness: used after "Oxudum"
}

interface HadithItem extends DailyItem {
  reading: boolean;
}

export const AYAHS: AyahItem[] = [
  { ref: "17:9", reading: true, text: "إِنَّ هَٰذَا ٱلْقُرْءَانَ يَهْدِى لِلَّتِى هِىَ أَقْوَمُ وَيُبَشِّرُ ٱلْمُؤْمِنِينَ ٱلَّذِينَ يَعْمَلُونَ ٱلصَّٰلِحَٰتِ أَنَّ لَهُمْ أَجْرًۭا كَبِيرًۭا", translation: "Həqiqətən, bu Quran insanları ən doğru yola yönəldir və yaxşı işlər görən möminlərə, özləri üçün böyük mükafat olacağı ilə müjdə verir.", source: "İsra surəsi, 9" },
  { ref: "54:17", reading: true, text: "وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍۢ", translation: "Biz Quranı yada salmaq üçün asanlaşdırdıq. Amma heç bir yada salan varmı?", source: "Qəmər surəsi, 17" },
  { ref: "38:29", reading: true, text: "كِتَٰبٌ أَنزَلْنَٰهُ إِلَيْكَ مُبَٰرَكٌۭ لِّيَدَّبَّرُوٓا۟ ءَايَٰتِهِۦ وَلِيَتَذَكَّرَ أُو۟لُوا۟ ٱلْأَلْبَٰبِ", translation: "Bu mübarək Kitabı, insanların onun ayələrini düşünüb anlaması və ağıl sahiblərinin də ondan ibrət götürməsi üçün sənə nazil etdik.", source: "Sad surəsi, 29" },
  { ref: "20:114", reading: true, text: "فَتَعَٰلَى ٱللَّهُ ٱلْمَلِكُ ٱلْحَقُّ ۗ وَلَا تَعْجَلْ بِٱلْقُرْءَانِ مِن قَبْلِ أَن يُقْضَىٰٓ إِلَيْكَ وَحْيُهُۥ ۖ وَقُل رَّبِّ زِدْنِى عِلْمًۭا", translation: "Haqq Hökmdar olan Allah ucadır! Onun ayələrinin vəhyi sənə tamamlanmayınca Quranı oxumağa tələsmə və: “Ey Rəbbim! Elmimi artır!”– de.", source: "Taha surəsi, 114" },
  { ref: "96:1", reading: true, text: "ٱقْرَأْ بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ", translation: "Yaradan Rəbbinin adı ilə oxu!", source: "Ələq surəsi, 1" },
  { ref: "7:204", reading: true, text: "وَإِذَا قُرِئَ ٱلْقُرْءَانُ فَٱسْتَمِعُوا۟ لَهُۥ وَأَنصِتُوا۟ لَعَلَّكُمْ تُرْحَمُونَ", translation: "Quran oxunduğu zaman onu dinləyin və susun ki, bəlkə sizə rəhm olunsun.", source: "Əraf surəsi, 204" },
  { ref: "10:57", reading: true, text: "يَٰٓأَيُّهَا ٱلنَّاسُ قَدْ جَآءَتْكُم مَّوْعِظَةٌۭ مِّن رَّبِّكُمْ وَشِفَآءٌۭ لِّمَا فِى ٱلصُّدُورِ وَهُدًۭى وَرَحْمَةٌۭ لِّلْمُؤْمِنِينَ", translation: "Ey insanlar! Rəbbinizdən sizə bir öyüd-nəsihət, kökslərdə olana bir şəfa, möminlərə doğru yol göstəricisi və mərhəmət gəlmişdir.", source: "Yunus surəsi, 57" },
  { ref: "2:121", reading: true, text: "ٱلَّذِينَ ءَاتَيْنَٰهُمُ ٱلْكِتَٰبَ يَتْلُونَهُۥ حَقَّ تِلَاوَتِهِۦٓ أُو۟لَٰٓئِكَ يُؤْمِنُونَ بِهِۦ ۗ وَمَن يَكْفُرْ بِهِۦ فَأُو۟لَٰٓئِكَ هُمُ ٱلْخَٰسِرُونَ", translation: "Kitab verdiyimiz kəslər onu layiqincə oxuyurlar. Onlar ona iman gətirənlərdir. Onu inkar edənlər isə ziyana uğrayanlardır.", source: "Bəqərə surəsi, 121" },
  { ref: "2:153", reading: true, text: "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ", translation: "Ey iman gətirənlər! Səbir etmək və namaz qılmaqla Allahdan kömək diləyin. Həqiqətən, Allah səbir edənlərlədir!", source: "Bəqərə surəsi, 153" },
  { ref: "94:5", reading: true, text: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", translation: "Sözsüz ki, hər çətinliyin ardınca asanlıq gəlir.", source: "İnşirah surəsi, 5" },
  { ref: "94:6", reading: false, text: "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًۭا", translation: "Əlbəttə ki, hər çətinliyin ardınca asanlıq gəlir.", source: "İnşirah surəsi, 6" },
  { ref: "11:115", reading: true, text: "وَٱصْبِرْ فَإِنَّ ٱللَّهَ لَا يُضِيعُ أَجْرَ ٱلْمُحْسِنِينَ", translation: "Səbir et! Həqiqətən, Allah yaxşı iş görənlərin mükafatını puç etməz.", source: "Hud surəsi, 115" },
  { ref: "13:28", reading: true, text: "ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ", translation: "Bunlar, iman gətirənlər və qəlbləri Allahı zikr etməklə rahatlıq tapanlardır. Bilin ki, qəlblər ancaq Allahı zikr etməklə rahatlıq tapır.", source: "Rəd surəsi, 28" },
  { ref: "2:152", reading: false, text: "فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ", translation: "Siz Məni yad edin ki, Mən də sizi yad edim! Mənə şükür edin, Mənə küfr etməyin!", source: "Bəqərə surəsi, 152" },
  { ref: "2:186", reading: false, text: "وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا۟ لِى وَلْيُؤْمِنُوا۟ بِى لَعَلَّهُمْ يَرْشُدُونَ", translation: "Qullarım səndən Mənim barəmdə soruşsalar, Mən onlara yaxınam, Mənə yalvaranın duasını yalvardığı vaxt qəbul edərəm. Qoy onlar da Mənim çağırışımı qəbul edib Mənə iman gətirsinlər ki, doğru yola yönələ bilsinlər.", source: "Bəqərə surəsi, 186" },
  { ref: "2:45", reading: false, text: "وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى ٱلْخَٰشِعِينَ", translation: "Səbir etmək və namaz qılmaqla Allahdan kömək diləyin! Həqiqətən, bu, Allaha itaət edənlərdən başqa hamıya ağır gəlir.", source: "Bəqərə surəsi, 45" },
  { ref: "33:41", reading: false, text: "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱذْكُرُوا۟ ٱللَّهَ ذِكْرًۭا كَثِيرًۭا", translation: "Ey iman gətirənlər! Allahı tez-tez yada salın!", source: "Əhzab surəsi, 41" },
  { ref: "39:53", reading: false, text: "۞ قُلْ يَٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا ۚ إِنَّهُۥ هُوَ ٱلْغَفُورُ ٱلرَّحِيمُ", translation: "Qullarıma mənim bu sözümü de: “Ey Mənim özlərinə qarşı həddi aşmış qullarım! Allahın rəhmindən ümidinizi üzməyin. Şübhəsiz ki, Allah bütün günahları bağışlayır. O, həqiqətən, Bağışlayandır, Rəhmlidir!”", source: "Zumər surəsi, 53" },
  { ref: "3:139", reading: false, text: "وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ", translation: "Acizlik göstərməyin və kədərlənməyin. Möminsinizsə, üstün olacaqsınız.", source: "Ali-İmran surəsi, 139" },
  { ref: "14:7", reading: false, text: "وَإِذْ تَأَذَّنَ رَبُّكُمْ لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ ۖ وَلَئِن كَفَرْتُمْ إِنَّ عَذَابِى لَشَدِيدٌۭ", translation: "O zaman Rəbbiniz bildirmişdi: “Əgər şükür etsəniz, sizə olan nemətimi artıraram, yox əgər nankorluq etsəniz, bilin ki, Mənim əzabım şiddətlidir”.", source: "İbrahim surəsi, 7" },
  { ref: "16:128", reading: false, text: "إِنَّ ٱللَّهَ مَعَ ٱلَّذِينَ ٱتَّقَوا۟ وَّٱلَّذِينَ هُم مُّحْسِنُونَ", translation: "Həqiqətən də, Allah Ondan qorxanlar və yaxşı işlər görənlərlədir.", source: "Nəhl surəsi, 128" },
  { ref: "12:2", reading: false, text: "إِنَّآ أَنزَلْنَٰهُ قُرْءَٰنًا عَرَبِيًّۭا لَّعَلَّكُمْ تَعْقِلُونَ", translation: "Həqiqətən, Biz onu ərəbcə Quran olaraq nazil etdik ki, başa düşə biləsiniz.", source: "Yusif surəsi, 2" },
  { ref: "47:24", reading: false, text: "أَفَلَا يَتَدَبَّرُونَ ٱلْقُرْءَانَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَآ", translation: "Məgər onlar Quran haqqında düşünmürlərmi? Yoxsa qəlbləri qıfıllıdır?", source: "Muhəmməd surəsi, 24" },
  { ref: "39:10", reading: false, text: "قُلْ يَٰعِبَادِ ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ رَبَّكُمْ ۚ لِلَّذِينَ أَحْسَنُوا۟ فِى هَٰذِهِ ٱلدُّنْيَا حَسَنَةٌۭ ۗ وَأَرْضُ ٱللَّهِ وَٰسِعَةٌ ۗ إِنَّمَا يُوَفَّى ٱلصَّٰبِرُونَ أَجْرَهُم بِغَيْرِ حِسَابٍۢ", translation: "Qullarıma Mənim bu Sözümü de: “Ey Mənim iman gətirən qullarım! Rəbbinizdən qorxun! Bu dünyada yaxşılıq edənləri yaxşılıq (Cənnət) gözləyir. Allahın yaratdığı yer üzü genişdir. Yalnız səbir edənlərə mükafatları hesabsız veriləcəkdir”.", source: "Zumər surəsi, 10" },
];

export const HADITHS: HadithItem[] = [
  { reading: true, text: "", translation: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.", source: "Səhih əl-Buxari, 5027" },
  { reading: true, text: "", translation: "Allaha ən sevimli əməl az da olsa, davamlı olanıdır.", source: "Səhih əl-Buxari, 6464; Səhih Müslim, 783" },
  { reading: true, text: "", translation: "Quranı oxuyun, çünki o, qiyamət günü oxuyanlarına şəfaətçi olaraq gələcək.", source: "Səhih Müslim, 804" },
  { reading: true, text: "", translation: "Kim Allahın Kitabından bir hərf oxusa, ona bir savab yazılar, hər savab isə on misli ilədir.", source: "Tirmizi, 2910" },
  { reading: true, text: "", translation: "Quranı mahir oxuyan möhtərəm və itaətkar mələklərlə birlikdədir. Quranı çətinliklə, ilişə-ilişə oxuyana isə iki savab vardır.", source: "Səhih Müslim, 798" },
  { reading: true, text: "", translation: "Bir camaat Allahın evlərindən birində toplaşıb Allahın Kitabını oxuyar və onu öz aralarında öyrənərsə, onlara mütləq sükunət enər, rəhmət onları bürüyər və mələklər onları əhatə edər.", source: "Səhih Müslim, 2699" },
  { reading: true, text: "", translation: "Din asanlıqdır. Kim dində özünü həddən artıq yorarsa, davam gətirə bilməz. Ona görə doğru yolu tutun, mötədil olun və müjdələnin.", source: "Səhih əl-Buxari, 39" },
  { reading: true, text: "", translation: "Əməllər ancaq niyyətlərə görədir.", source: "Səhih əl-Buxari, 1" },
  { reading: false, text: "", translation: "Allah sizin görünüşünüzə və mallarınıza baxmaz, qəlblərinizə və əməllərinizə baxar.", source: "Səhih Müslim, 2564" },
  { reading: false, text: "", translation: "Sizdən biriniz özü üçün istədiyini qardaşı üçün də istəməyincə, kamil iman gətirmiş olmaz.", source: "Səhih əl-Buxari, 13" },
  { reading: false, text: "", translation: "Harada olsan da, Allahdan qorx. Pis əməlin ardınca yaxşı əməl et ki, onu silsin. İnsanlarla gözəl əxlaqla rəftar et.", source: "Tirmizi, 1987" },
  { reading: false, text: "", translation: "Möminin işi nə qəribədir! Onun hər işi xeyirdir. Sevinc üz verəndə şükür edər, bu onun üçün xeyirdir; sıxıntı üz verəndə səbr edər, bu da onun üçün xeyirdir.", source: "Səhih Müslim, 2999" },
  { reading: false, text: "", translation: "Təmizlik imanın yarısıdır.", source: "Səhih Müslim, 223" },
  { reading: false, text: "", translation: "Gözəl söz sədəqədir.", source: "Səhih əl-Buxari, 2989; Səhih Müslim, 1009" },
  { reading: false, text: "", translation: "İnsan öldükdə əməli kəsilir, üç şey istisna olmaqla: davamlı sədəqə, faydalanılan elm və onun üçün dua edən saleh övlad.", source: "Səhih Müslim, 1631" },
  { reading: false, text: "", translation: "Allaha və axirət gününə iman gətirən ya xeyir söz danışsın, ya da sussun.", source: "Səhih əl-Buxari, 6018; Səhih Müslim, 47" },
  { reading: false, text: "", translation: "Sədəqə maldan heç nə əskiltməz. Bağışlayan qulun Allah izzətini artırar. Allah rizası üçün təvazökar olanı Allah ucaldar.", source: "Səhih Müslim, 2588" },
  { reading: false, text: "", translation: "Bir nəfər Peyğəmbərdən (s.ə.s.) nəsihət istədi. O: “Qəzəblənmə”, – dedi və bunu bir neçə dəfə təkrarladı.", source: "Səhih əl-Buxari, 6116" },
];

// Short words of encouragement written for the app (not quotations)
export const KIND_WORDS: string[] = [
  "Az da olsa, hər gün. Bu günkü səhifələrin üçün Allah qəbul etsin.",
  "Bir səhifə də olsa, oxuduğun hər gün qəlbin üçün bir addımdır.",
  "Davamlılıq böyük işləri kiçik addımlarla tamamlayır. Sabah yenə görüşək.",
  "Qrupun xətmi sənin bu səhifələrinlə bir az da yaxınlaşdı.",
];

// Day number in Baku time, so everyone sees the same ayah and hadith on the same day
export function bakuDayNumber(date: Date = new Date()): number {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400000);
}

export function bakuDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
}

export function dailyContent(date: Date = new Date()): { ayah: DailyItem; hadith: DailyItem } {
  const day = bakuDayNumber(date);
  const a = AYAHS[day % AYAHS.length];
  const h = HADITHS[(day * 5) % HADITHS.length];
  return {
    ayah: { text: a.text, translation: a.translation, source: a.source },
    hadith: { text: h.text, translation: h.translation, source: h.source },
  };
}

export interface Encouragement {
  kind: "ayah" | "hadith" | "word";
  text: string;
  translation: string;
  source: string;
}

// A random encouragement about reading and steadiness, never the same one twice in a row
export function pickEncouragement(previous?: string): Encouragement {
  const pool: Encouragement[] = [
    ...AYAHS.filter((a) => a.reading).map((a) => ({ kind: "ayah" as const, text: a.text, translation: a.translation, source: a.source })),
    ...HADITHS.filter((h) => h.reading).map((h) => ({ kind: "hadith" as const, text: "", translation: h.translation, source: h.source })),
    ...KIND_WORDS.map((w) => ({ kind: "word" as const, text: "", translation: w, source: "" })),
  ];
  const options = pool.filter((p) => p.translation !== previous);
  return options[Math.floor(Math.random() * options.length)];
}
