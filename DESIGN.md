---
name: Xətm
description: Quran Xətm İzləyicisi, a calm group khatm tracker for Azerbaijani readers on their phones.
colors:
  forest: "#0F5C45"
  forestpress: "#0B4836"
  mint: "#E2EEE8"
  lapis: "#23406B"
  donebg: "#E4E9F1"
  accent: "#C4862A"
  progress: "#F7EBD3"
  progresstext: "#6E4B12"
  goldtext: "#7A5A1E"
  leaf: "#A9823A"
  leaflight: "#E9DDBF"
  gold: "#E2B85C"
  tile: "#0A2C20"
  cream: "#F1F2EC"
  vellum: "#FCFBF6"
  card: "#FFFFFF"
  sand: "#EAECE3"
  track: "#E7E8E0"
  line: "#DEE0D6"
  field: "#C9CCC0"
  ink: "#182235"
  muted: "#5E6675"
  danger: "#9E3426"
  dangerline: "#EBC9BF"
typography:
  display:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "36px (52px from md)"
    fontWeight: 400
    lineHeight: 1.08
  title-cartouche:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "clamp(20px, 6.6vw, 30px) (32px from md)"
    fontWeight: 400
    lineHeight: 1
  today:
    fontFamily: "Marcellus, Georgia, serif"
    fontSize: "28px (38px from md)"
    fontWeight: 400
    lineHeight: 1.12
  numeral:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  meta:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  arabic:
    fontFamily: "Amiri, serif"
    fontSize: "24px (28px from md)"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  chip: "8px"
  field: "14px"
  btn: "14px"
  card: "18px"
  hero: "20px"
spacing:
  card-pad: "18px"
  card-pad-md: "24px"
  section-gap: "20px"
  section-gap-md: "28px"
  touch: "44px"
---

# Design System: Xətm

## Overview

**Creative North Star: "Təzhib" (mushaf illumination)**

Xətm borrows its ornament from the illuminated Ottoman mushaf the group reads from: surah-header
cartouches, ayah-end medallions, the mihrab arch, the 8-point star (khatam) and the girih lattice.
The ground is a cool porcelain white; text is lapis ink; the one saturated action colour is emerald;
gold leaf only ever draws lines. The result should read as a well-made devotional object, quiet and
professional, never as a game.

**Spend the ornament in a few places.** The night artwork band at the top of every screen (the group
artwork: "وفاء" calligraphy on a starry blue-green sky), today's page tiles (star medallions) and
the juz octagons carry the ornament. Everything else is borderless white panels.

## Colors

- **Emerald** (`forest` #0F5C45, press #0B4836, companion `mint` #E2EEE8): only things you can
  press, the active tab, live selection and marked page medallions.
- **Lapis** (`lapis`/`done` #23406B on `donebg` #E4E9F1): finished data. Bar fills, streak days,
  "Bitirib" chips.
- **Saffron** (`accent` #C4862A, chips `progress` #F7EBD3 / `progresstext` #6E4B12): data under way.
- **Juz states** keep their pre-tezhip colours by the owner's choice: finished `juzdone` green
  #2F8A5B, in progress `juzprogress` amber #B5651D, handed out `juzassigned` yellow #F7E3A3 (line
  #DDBB55). Used by the juz octagons, the Qrup reader tabs and analytics charts.
- **Gold leaf** (`leaf` #A9823A, `leaflight` #E9DDBF): ornament lines only (cartouche, mihrab frame,
  medallion rings, lozenge on bars, tab star, separators). Never a fill for a button or a state.
- **Night** (#0B1F33, muted text `nightmuted` #9DBDAE) and **logo gold** (#E2B85C): the header
  artwork band and top bar, and the "Günün ayəsi / hədisi" panel at the bottom of Bu gün (the same
  night sky without the calligraphy, `.night-texture`, a thin gold frame, Arabic in gold Amiri Quran).
- **Quranic text** uses `font-quran` (Amiri Quran), which draws the Uthmani small marks correctly;
  plain `font-amiri` is for other Arabic.
- **Neutrals:** porcelain ground `cream` #F1F2EC, `vellum` #FCFBF6 (mihrab card, messages),
  white cards, `sand` #EAECE3 quiet fills, `track` #E7E8E0, hairline `line` #DEE0D6, `field`
  #C9CCC0 input strokes, lapis `ink` #182235, `muted` #5E6675. Danger #9E3426 / #EBC9BF.

### Named Rules
**The Pressable Emerald Rule.** If it cannot be tapped and is not "yours, now", it is not emerald.
**The Lapis Data Rule.** Finished is lapis, under way is saffron, on a track. Never emerald.
**The Gold Leaf Rule.** Gold draws, it never fills a control or encodes status.
**The Disabled Loses Colour Rule.** Disabled buttons drop to track with muted text.

## Typography

- **Marcellus** (inscriptional capitals, like carved mosque lettering): page titles in white on the
  night band (27px phone, 40px desktop), the today greeting, signed-out display heading, the app name, dialog titles. One weight.
- **Manrope** 400–800: everything else. Card headings 700, big numerals 800 tabular.
- **Amiri**: Arabic (Quran, hadith) only, right-to-left, line height 1.8.

**The Figure Strip Rule.** Each screen opens with at most one figure strip (`StatStrip`): four
figures with hairline dividers, a 2×2 card on the phone and one row on desktop, riding over the
bottom edge of the night band.
**The Caption Not Kicker Rule.** A small old-gold caption may name a figure ("Günün ayəsi"); no
eyebrows above headings, nothing uppercased or letter-spaced.

## Layout

Mobile-first, one column, 16px side padding. Every screen starts with the night artwork band: the
top bar (round logo, bell on Bu gün only on the phone, messages, settings gear on the admin screen,
profile menu) and below it the page title and one muted sentence, on one continuous picture
(`.night-nav`/`.girih-tile` desktop with `band-vefa-d.webp`, `.night-nav-m`/`.girih-tile-m` phone
with `band-vefa-m.webp`; the top bar shows the first 76px / 64px, the band continues from there).
The first panel rides over the band's lower edge. Desktop: the top bar is sticky and holds the
screen links (gold underline on the current one), search (page number or surah name) and the
section tabs sit at the band's bottom right; the phone has no section tabs. Content max 1120px.
Every target is at least 44px. The Gemini button (admin screen only) floats bottom right.

## Ornament components (`src/components/ornament.tsx`)

- **Cartouche / MihrabCard:** no longer used by the screens (the night band replaced them).
- **PageMedal:** a page of today's share as an 8-point star medallion in a thin gold ring. Open:
  white with a pale gold outline. Next: mint with an emerald outline. Read: solid emerald, white
  number; it turns in when it becomes read.
- **OrnamentRule:** gold rule with a centred lozenge, between figures (ayah and hadith).
- **StarMark / starPath:** the khatam star.
- **Juz tiles** (`JuzBadge` in `GroupWidgets.tsx`) are octagons, the same on every screen; the Qrup
  map groups them by distribution ("N-ci bölgü · Cüz a–b" with dates).
- **Bar:** fully round on track, lapis or saffron, fills from empty on appear; bars 8px and up carry a
  gold lozenge at the leading edge.
- `.girih` (globals.css): the lattice behind page titles, lapis at 7% and faded downward.

## Elevation & Shapes

Shadows are tinted with lapis ink: card `0 1px 2px rgba(24,34,53,.05), 0 10px 28px -16px
rgba(24,34,53,.22)`; floating `0 8px 28px -10px rgba(24,34,53,.24)`. Radii: chips 8px, inputs and
buttons 14px, cards 18px, hero and dialogs 20px. The phone tab bar is docked to the bottom edge with
no gap under it, white with 22px rounded top corners and a soft upward shadow: Bu gün, Səhifələrim,
Qrup, Analitika, plus Admin for managers (Mesajlar lives in the top bar, Qruplarım in the profile
menu). 22px icon over a 12px label, the current one with a mint pill behind an emerald icon.

## Motion

- Screen change (`PageMotion.tsx`): content slides 24px in from the side you travel towards, a faint
  gold khatam star opens and fades at the centre, the tab bar's mint pill glides from the previous
  tab. The previous screen is kept in sessionStorage because each screen mounts its own layout.
- Medallions pop in centre-out; bars fill; juz tiles wave in.
- Soft press (scale 0.97) on everything tappable.
- Everything respects `prefers-reduced-motion`.

## Don'ts

- No emerald on bars, rings, finished juz, streak days or decoration.
- No dark surfaces beyond the night band and the ayah/hadith panel; no gold fills on controls.
- No second figure strip on a screen; no rankings, points or leaderboards (see PRODUCT.md).
- No eyebrows, uppercase or letter-spaced labels; no emoji as icons.
- No fonts beyond Marcellus, Manrope and Amiri.
- No neutral-black or hard-offset shadows.
