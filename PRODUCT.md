# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first web app installed as a PWA (`src/app/manifest.ts`, `public/sw.js`). Most use happens on phones, the owner tests on iPhone.

## Users

People reading the Quran together as a group khatm, in Azerbaijani:

- **Family and friends:** small groups of people who know each other, often reading a khatm with a shared intention.
- **Mosque and community groups:** larger groups organised by a community leader, where members may not know each other.
- **Ramadan groups:** seasonal groups that aim to finish one or more khatms within the month.

Two roles inside each group: the **owner** (creates the group, invites members, approves them, runs distributions) and **members** (read their assigned juz and mark pages). Super admins run the app itself.

Members are mostly young adults (roughly 18–40) who are comfortable with smartphones; standard mobile app expectations apply.

## Product Purpose

Let a group finish the whole Quran (604 pages, 30 juz) together, without a spreadsheet or a chat thread to keep track of who reads what. Each member knows exactly which pages are theirs today, marks them as read, and the group sees how far the khatm has come. Success means khatms actually get finished, cycle after cycle.

## Positioning

- **Page-by-page tracking.** Progress is recorded per page, not per juz or per "I'm done" message, so the group sees the live state of all 604 pages.
- **Azerbaijani and local.** Fully in Azerbaijani, with Azerbaijani Quran text (`src/lib/quran-az.json`), built for the local community.
- **Spiritual and calm.** Worship comes first: no points, badges, leaderboards or rankings. Progress is shown to support and encourage the reading, not to rank people. Two motivating elements are deliberate and stay (confirmed 2026-10-19): the personal reading streak and the per-member status in the group (including "Geri qalır"), because they help members keep going and help the group notice who needs support.

## Operating Context

- An owner creates a group and shares an invite link; members join through it and the owner approves them.
- Juz are distributed automatically and at random within a khatm; a member who still has 2 or more unfinished juz is skipped by the next distribution. When all 30 juz are done, a new khatm cycle begins. The owner can transfer a juz to another member.
- Daily use: open the app, see today's target and assigned pages, tap each page read to mark it.
- Push notifications remind and inform members; a daily ayah and hadith appear in the app.
- Finishing juz 30 surfaces the khatm dua.

## Capabilities and Constraints

- Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Firebase Auth (Google sign-in) and Firestore, web-push. Deployed to Render on push to `main`; Firestore rules are published by hand.
- Features: groups and invites, member approval, random juz distribution with per-member shares, page marking, khatm cycles, progress, stats and analytics, readings, push notifications, daily ayah/hadith, AI chat about the Quran (RAG), admin pages.
- Privacy: names, emails, push subscriptions and messages are private data and must stay out of public documents.
- Terminology (keep as used): xətm, cüz, səhifə, qrup, iştirakçı, paylanma.
- Voice addresses the user informally as "sən".

## Brand Commitments

- Name: "Xətm" (full title "Quran Xətm İzləyicisi").
- Existing assets: `public/logo.png`, `public/quran-rehal.png`, `src/app/icon.png`.
- Tone: respectful, calm and warm, suited to worship.

## Evidence on Hand

- Real product copy across the app, all in Azerbaijani.
- Azerbaijani Quran translation data in `src/lib/quran-az.json`.
- No testimonials, user counts, case studies or press exist. Do not invent them.

## Product Principles

1. **Worship comes first.** Every feature serves the reading itself; nothing should turn it into a game, a race or a score. The streak and member status are encouragement, not competition, and should be presented that way.
2. **Today's pages first.** A member opening the app should see what they need to read and be able to mark it in one tap.
3. **Fair and visible to the group.** Distribution is automatic and fair, and progress is shared, so nobody has to chase anyone.
4. **Private by default.** Personal data stays private; the group sees progress, not personal details.
5. **Native in Azerbaijani.** Copy, terms and Quran text are written for the local community, not translated after the fact.
