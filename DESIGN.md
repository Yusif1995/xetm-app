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

**Spend the ornament in a few places.** Page titles (cartouche), the one prominent card on a screen
(mihrab), today's page tiles (medallions) and the juz map (octagons) carry the Islamic geometry.
Everything else is plain white cards with hairline borders.

## Colors

- **Emerald** (`forest` #0F5C45, press #0B4836, companion `mint` #E2EEE8): only things you can
  press, the active tab, live selection and marked page medallions.
- **Lapis** (`lapis`/`done`/`juzdone` #23406B on `donebg` #E4E9F1): finished data. Bar fills,
  finished juz, chart columns, streak days, "Bitirib" chips.
- **Saffron** (`accent`/`juzprogress` #C4862A, chips `progress` #F7EBD3 / `progresstext` #6E4B12):
  data under way. Handed-out-but-unstarted juz use pale saffron (`juzassigned`).
- **Gold leaf** (`leaf` #A9823A, `leaflight` #E9DDBF): ornament lines only (cartouche, mihrab frame,
  medallion rings, lozenge on bars, tab star, separators). Never a fill for a button or a state.
- **Logo gold** (#E2B85C) and **night tile** (#0A2C20): the logo mark and its tile only.
- **Neutrals:** porcelain ground `cream` #F1F2EC, `vellum` #FCFBF6 (mihrab card, messages),
  white cards, `sand` #EAECE3 quiet fills, `track` #E7E8E0, hairline `line` #DEE0D6, `field`
  #C9CCC0 input strokes, lapis `ink` #182235, `muted` #5E6675. Danger #9E3426 / #EBC9BF.

### Named Rules
**The Pressable Emerald Rule.** If it cannot be tapped and is not "yours, now", it is not emerald.
**The Lapis Data Rule.** Finished is lapis, under way is saffron, on a track. Never emerald.
**The Gold Leaf Rule.** Gold draws, it never fills a control or encodes status.
**The Disabled Loses Colour Rule.** Disabled buttons drop to track with muted text.

## Typography

- **Marcellus** (inscriptional capitals, like carved mosque lettering): page titles inside the
  cartouche, the today heading, signed-out display heading, the app name, dialog titles. One weight.
- **Manrope** 400–800: everything else. Card headings 700, big numerals 800 tabular.
- **Amiri**: Arabic (Quran, hadith) only, right-to-left, line height 1.8.

**The Sentence Summary Rule.** One numeral and one sentence, not rows of equal stat tiles.
**The Caption Not Kicker Rule.** A small old-gold caption may name a figure ("Günün ayəsi"); no
eyebrows above headings, nothing uppercased or letter-spaced.

## Layout

Mobile-first, one column, 16px side padding. Page headers are centred: girih lattice behind, the
cartouche, then one muted sentence and any actions. From md a 264px white sidebar holds the logo,
the active group and the navigation (active item mint with a small gold star). Content max 1120px.
Every target is at least 44px.

## Ornament components (`src/components/ornament.tsx`)

- **Cartouche:** the page title in a surah-header frame (double gold line, lozenge ends). Used by
  `PageHeader` on every screen and by the dashboard greeting. Lines draw in on mount.
- **MihrabCard:** vellum card under a pointed arch with a double gold frame. One per screen at most:
  today's target on the dashboard.
- **PageMedal:** a page of today's share as an 8-point star medallion in a thin gold ring. Open:
  white with a pale gold outline. Next: mint with an emerald outline. Read: solid emerald, white
  number; it turns in when it becomes read.
- **OrnamentRule:** gold rule with a centred lozenge, between figures (ayah and hadith).
- **StarMark / starPath:** the khatam star; marks the active sidebar item.
- **Analytics plinth:** the group's headline figures on the Analitika screen sit as white tiles on
  a lapis-ink plinth (`bg-ink`) with the gold lattice (`.girih-night`) and an inset gold frame. The
  one dark surface in the app; nowhere else.
- **Juz map tiles** are octagons (`.octagon`) in lapis / saffron / pale saffron / track, opening in
  a left-to-right wave.
- **Bar:** fully round on track, lapis or saffron, fills from empty on appear; bars 8px and up carry a
  gold lozenge at the leading edge.
- `.girih` (globals.css): the lattice behind page titles, lapis at 7% and faded downward.

## Elevation & Shapes

Shadows are tinted with lapis ink: card `0 1px 2px rgba(24,34,53,.05), 0 10px 28px -16px
rgba(24,34,53,.22)`; floating `0 8px 28px -10px rgba(24,34,53,.24)`. Radii: chips 8px, inputs and
buttons 14px, cards 18px, hero and dialogs 20px. The tab bar is docked to the bottom edge, white
with a hairline top border: five tabs (Bu gün, Səhifələrim, Qrup, Mesajlar, Admin or Qruplarım),
22px icon over a 12px label, the current one with a 64×36 mint pill behind an emerald icon and an
ink label. A saffron dot on Mesajlar marks an unread conversation.

## Motion

- Screen change (`PageMotion.tsx`): content slides 24px in from the side you travel towards, a faint
  gold khatam star opens and fades at the centre, the tab bar's mint pill glides from the previous
  tab. The previous screen is kept in sessionStorage because each screen mounts its own layout.
- Cartouche and mihrab lines draw in; medallions pop in centre-out; bars fill; juz tiles wave in.
- Soft press (scale 0.97) on everything tappable.
- Everything respects `prefers-reduced-motion`.

## Don'ts

- No emerald on bars, rings, finished juz, streak days or decoration.
- No dark hero slabs (the analytics plinth is the single exception), no gold fills on controls.
- No rows of equal stat tiles; no rankings, points or leaderboards (see PRODUCT.md).
- No eyebrows, uppercase or letter-spaced labels; no emoji as icons.
- No fonts beyond Marcellus, Manrope and Amiri.
- No neutral-black or hard-offset shadows.
