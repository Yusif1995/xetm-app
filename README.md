# Quran Xətm İzləyicisi (Quran Khatm Tracker)

Bu layihə, Next.js 14, Tailwind CSS və Firebase (Authentication + Firestore) texnologiyalarından istifadə edilərək hazırlanmış tam funksional Quran completion tracker veb tətbiqidir. İştirakçılar təyin edilmiş səhifələri oxuduqca tamamlama vəziyyətini qeyd edir və qrup üzrə ümumi 604 səhifəlik Quranın hansı səviyyədə tamamlandığı izlənilir.

## Texnologiyalar
- **Framework:** Next.js 14 (App Router)
- **Proqramlaşdırma Dili:** TypeScript
- **Styling:** Tailwind CSS + Google Fonts (Amiri, Inter)
- **Database & Auth:** Firebase Firestore & Firebase Auth (Google OAuth)

---

## Layihənin Qurulması və Quraşdırılması

Tətbiqi lokal mühitdə işə salmaq üçün aşağıdakı addımları izləyin:

### 1. Kitabxanaları Yükləyin
Layihə qovluğunda terminalı açın və asılılıqları quraşdırın:
```bash
npm install
```

### 2. Ətraf Mühit Dəyişənlərini Qurun (`.env.local`)
Layihənin kök (root) qovluğunda `.env.local` faylını yaradın və öz Firebase layihənizə uyğun olaraq aşağıdakı məlumatları daxil edin:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sizin_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sizin_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sizin_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sizin_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=sizin_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=sizin_app_id
```

### 3. Firebase Layihənizdə Quraşdırma

#### A. Authentication Aktiv Edin:
1. Firebase konsoluna daxil olun.
2. **Build > Authentication > Get Started** düyməsinə klikləyin.
3. **Sign-in method** bölməsindən **Google** provayderini seçin və aktiv edin.

#### B. Cloud Firestore Verilənlər Bazasını Yaradın:
1. Firebase konsolunda **Build > Firestore Database > Create Database** yolunu izləyin.
2. Məlumat bazasını **Production mode** (İstehsal rejimi) və ya test rejimində yaradın.
3. Təhlükəsizlik qaydaları üçün layihədə yerləşən `firestore.rules` faylının məzmununu Firestore **Rules** bölməsinə kopyalayıb dərc edin (**Publish**).

#### C. İlk Admin İstifadəçisini Təyin Edin:
Tətbiqə ilk dəfə giriş etdiyiniz zaman, Firebase Firestore-da sizin üçün `users/{istifadəçi_id}` formasında avtomatik sənəd (document) yaradılacaq.
1. Həmin istifadəçi sənədinə daxil olun.
2. `role` sahəsinin (field) dəyərini `"user"` statusundan `"admin"` statusuna dəyişin.
3. Brauzerinizdə giriş-çıxış edin və ya səhifəni yeniləyin. Artıq `/admin` səhifəsinə tam daxil ola biləcəksiniz.

---

## Tətbiqin Lokal İşə Salınması

Quraşdırma işləri tamamlandıqdan sonra tətbiqi inkişaf (development) rejimində başlatmaq üçün:

```bash
npm run dev
```

Tətbiq brauzerdə `http://localhost:3000` ünvanında aktiv olacaq.

---

## Qovluq Quruluşu

Layihənin əsas qovluq strukturu aşağıdakı kimidir:
- `src/app/` — Səhifələrin yerləşdiyi yer (Login, Dashboard, Admin, Progress).
- `src/components/` — Yenidən istifadə edilə bilən UI komponentləri.
- `src/lib/` — Firebase, Firestore verilənlər bazası və Auth kontekst xidmətləri.
- `src/middleware.ts` — Səhifə qorunmasını (Route Guarding) və kuki yoxlanışını icra edən middleware.
- `firestore.rules` — Firestore verilənlər bazasının icazə və təhlükəsizlik qaydaları.
