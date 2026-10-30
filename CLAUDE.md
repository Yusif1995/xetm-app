# Xetm

Group Quran khatm tracker, fully in Azerbaijani: a group reads all 604 pages (30 juz) together, each
member marks the pages they read. Mobile-first PWA; the owner tests on an iPhone home-screen install.
Product intent and tone: `PRODUCT.md`. Visual system: `DESIGN.md`. (`README.md` is outdated: it says
Next.js 14 and an old `role` field admin setup.)

## Working with the owner

- Reply in Azerbaijani. The owner is not a developer: give exact click paths for Firebase Console and
  Render, and say what to check on the phone.
- Commit and push only when asked. Commit messages in English, conventional style (`feat(qrup): ...`).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3, Firebase Auth (Google) + Firestore,
`firebase-admin` on the server, `web-push` for notifications. Node 20.

- `src/app/` pages: `dashboard`, `groups`, `oxu` (mushaf reader), `readings`, `progress`, `stats`,
  `analytics`, `admin`, `qurasdir` (install guide). Server routes in `src/app/api/*`.
- `src/lib/`: `db.ts` (client Firestore access), `khatm.ts` (juz distribution and cycles), `quran.ts`
  (surah/juz page table), `serverAuth.ts` + `firebaseAdmin.ts` (server auth, Admin SDK), `push*.ts`,
  `dailyContent.ts` (daily ayah/hadith rotation, no AI).
- `src/instrumentation-node.ts`: in-process scheduler (18:00 Baku last-day reminder). Render is a paid
  always-on plan, so this is reliable; no external cron.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npx tsc --noEmit`
- `npm run test:rules`: Firestore emulator + `node --test` over `tests/*.test.mjs` (needs Java). Run it
  after any change to `firestore.rules` or `src/lib/{db,khatm,analytics,privateData}.ts`. A Stop hook
  reminds you if rules or `db.ts` changed since the last passing run.

## Deploy (read before shipping)

- Render (service `xetm-app`) deploys `main` automatically on push. Use `/ship`.
- **Firestore rules are not deployed by anything.** The owner pastes `firestore.rules` into Firebase
  Console (project `quran-khetm`) and clicks Publish. When code and rules change together: push code,
  wait for Render "live", then ask the owner to publish the rules.
- Env vars live on Render (`FIREBASE_SERVICE_ACCOUNT`, `OWNER_EMAIL`, `CRON_SECRET`, VAPID keys,
  `NEXT_PUBLIC_FIREBASE_*`). Locally: `.env.local`.

## Permission model

- **Owner** of the app = the server sees a verified email equal to `OWNER_EMAIL`. Owner-only tools:
  `/admin/sistem` via `/api/owner` (grant/revoke admins, delete groups).
- **Super admins** = docs in `admins/{uid}`, written only through the Admin SDK.
- **Group creator** = `groups/{id}.createdBy`; approved members in `groups/{id}.members`. Only admins
  create groups (`/api/create-group`; rules forbid client creates). Member messages via
  `/api/group-message`.
- Private data (email, push subscriptions) in `users/{uid}/private/profile`.
- Prefer a server route with the Admin SDK over loosening `firestore.rules`: rules publishing is manual
  and this is the pattern the owner chose. Every API route must verify the caller itself.
- After changes to rules, API routes or roles, run the `security-reviewer` agent.

## Mushaf reader (`/oxu`)

- Page images `public/mushaf/{1,1b,2..604,dua-1..3}.webp` from the vector "Bilgisayar hatlı" PDF.
  Re-export with `/mushaf-export`; it holds the page mapping and crop boxes.
- Images have a one-year immutable cache: any re-export must bump `IMAGE_VERSION` in
  `src/app/oxu/page.tsx`.
- Every juz is exactly 20 pages (juz 30 = 581-604); the owner chose this over Medina juz boundaries.

## Never

- Never commit or edit `.env*` or `*firebase-adminsdk*.json` (a PreToolUse hook blocks it). The service
  account key in the project root is for local scripts only.
- No points, badges, leaderboards or rankings in the UI (see `PRODUCT.md`).
- Gemini credits are used up: AI chat and "AI ilə yaz" do not work; do not build new features on Gemini.
