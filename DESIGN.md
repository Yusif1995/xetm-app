---
name: Xətm
description: Quran Xətm İzləyicisi, a calm group khatm tracker for Azerbaijani readers on their phones.
colors:
  forest: "#0F5C45"
  forestpress: "#0B4836"
  mint: "#E3EFE8"
  done: "#6E8F7C"
  donetext: "#3B5A4A"
  donebg: "#E6EDE7"
  accent: "#C98A2B"
  progress: "#F8E9CC"
  progresstext: "#6B4D12"
  goldtext: "#7A5718"
  gold: "#E2B85C"
  tile: "#0A2C20"
  cream: "#F6F1E8"
  card: "#FFFFFF"
  sand: "#F5EBDD"
  track: "#EFE5D6"
  line: "#EADFCF"
  field: "#D9CCBA"
  ink: "#2B241F"
  muted: "#6F625A"
  danger: "#A33A26"
  dangerline: "#EBC9BF"
typography:
  display:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "34px (48px from md)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "28px (36px from md)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  today:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "26px (34px from md)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  numeral:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  meta:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  arabic:
    fontFamily: "Amiri, serif"
    fontSize: "24px (28px from md)"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  tile: "12px"
  field: "14px"
  btn: "16px"
  card: "24px"
  hero: "28px"
  pill: "9999px"
spacing:
  card-pad: "18px"
  card-pad-md: "24px"
  hero-pad: "22px"
  hero-pad-md: "32px"
  section-gap: "20px"
  section-gap-md: "28px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.card}"
    typography: "{typography.title}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.forestpress}"
  button-primary-disabled:
    backgroundColor: "{colors.track}"
    textColor: "{colors.muted}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.card}"
    textColor: "{colors.danger}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "48px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "18px"
  card-hero:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.hero}"
    padding: "22px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "48px"
  chip-done:
    backgroundColor: "{colors.donebg}"
    textColor: "{colors.donetext}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-progress:
    backgroundColor: "{colors.progress}"
    textColor: "{colors.progresstext}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-neutral:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  page-tile-marked:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.card}"
    rounded: "{rounded.tile}"
    height: "44px"
  page-tile-next:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.tile}"
    height: "44px"
  page-tile-open:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.muted}"
    rounded: "{rounded.tile}"
    height: "44px"
  tab-active:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "20px"
    height: "56px"
---

# Design System: Xətm

## Overview

**Creative North Star: "The Quiet Rehal"**

Xətm is a warm consumer app for people reading the Quran together. The world is a tinted cream ground holding soft white cards, with exactly one saturated colour on screen: the forest green of something you can press. Everything else (progress, finished juz, streak days, status) speaks in muted sage and warm amber, so a member's eye always lands on the next action, and the group's progress reads as calm encouragement, never as a scoreboard.

Density is relaxed and mobile-first. One column of cards on the phone, a floating white tab bar within thumb reach, a white sidebar and a two-column flow on wide screens. Summaries are written as a sentence ("6 / 30 cüz oxunub, 6 cüz paylanıb · 3 iştirakçı") under one large numeral rather than broken into rows of equal stat tiles. Motion is limited to a soft press and smooth bar fills.

**Key Characteristics:**
- Warm cream ground, white cards with 24-28px corners, a hairline warm border and a low ambient shadow.
- One action colour (forest), reserved for pressable things, the active tab, live selection and marked page tiles.
- Data fills in sage (finished) and amber (in progress), never in the action green.
- Nunito for every Latin glyph, extra-bold for headings and numerals; Amiri for Arabic text only.
- Drawn stroke icons at one weight (24px grid, 2px stroke, round caps and joins).
- A soft spring press (scale 0.97) on everything tappable.

## Colors

A warm paper palette with one deep green voice and two quiet data tones.

### Primary
- **Forest** (#0F5C45): the action colour. Primary buttons, the marked page tile and its border, the active tab's icon and label, selected khatm tabs and filters, inline text links, the keyboard focus outline. Nothing that cannot be pressed or is not the live selection wears it.
- **Forest Press** (#0B4836): hover and pressed state of forest buttons.
- **Mint** (#E3EFE8): the quiet companion of forest. Background of the active tab and active sidebar item, the "next page" tile, icon discs and the invite panel.

### Secondary
- **Sage** (`done`, #6E8F7C): completed data. Bar fills for finished shares and the khatm total, finished juz tiles, read streak days, activity dots.
- **Deep Sage** (`donetext`, #3B5A4A) on **Sage Mist** (`donebg`, #E6EDE7): finished-status chips and the "Tamamlandı" confirmation block.

### Tertiary
- **Amber** (`accent`, #C98A2B): in-progress data. Bar fills for unfinished shares, the in-progress juz tile border, the unread-notification dot, the newest activity dot.
- **Wheat** (`progress`, #F8E9CC) with **Brown Wheat** text (`progresstext`, #6B4D12): in-progress and pending chips, in-progress juz tiles, the owner-message panel, other members' avatars.
- **Old Gold text** (`goldtext`, #7A5718): figure captions ("Günün ayəsi"), the owner chip text and owner-message meta line.
- **Logo Gold** (#E2B85C) and **Night Tile** (`tile`, #0A2C20): the logo mark and its rounded tile only.

### Neutral
- **Cream** (#F6F1E8): page ground, theme colour, open page tiles.
- **Card White** (#FFFFFF): every card, the tab bar, the sidebar, inputs.
- **Sand** (#F5EBDD): quiet fills; quiet buttons, hover on outline buttons, own avatar, neutral chips.
- **Track** (#EFE5D6): empty bar tracks, skeletons, disabled buttons.
- **Hairline** (`line`, #EADFCF): card, tab bar and sidebar borders; dividers.
- **Field** (#D9CCBA): input and outline-button strokes.
- **Ink** (#2B241F): all primary text and numerals.
- **Muted** (#6F625A): secondary text, meta lines, inactive tab labels, disabled text.
- **Danger** (#A33A26) with **Danger Line** (#EBC9BF): sign-out, destructive buttons, write errors.

### Named Rules
**The Pressable Green Rule.** Forest appears only on things you can press, the active tab, the live selection and the page tiles a member has marked. If it cannot be tapped and is not "yours, now", it is not forest.

**The Disabled Loses Colour Rule.** A disabled button drops to track (#EFE5D6) with muted text and no border, so colour on screen always means "you can press this".

**The Sage Data Rule.** Progress is drawn in sage when finished and amber when under way, on a track background. Never draw a bar, ring or finished state in forest.

## Typography

**Body Font:** Nunito (with system-ui, sans-serif), weights 400-800, Latin and Latin Extended for Azerbaijani.
**Arabic Font:** Amiri (with serif), right-to-left, for Quran and hadith text only.

**Character:** Nunito's rounded terminals make the app feel friendly and soft at heavy weights; Amiri gives the Arabic its traditional naskh dignity at generous leading.

### Hierarchy
- **Display** (800, 34px / 48px md, 1.08, -0.02em): the signed-out welcome heading only.
- **Headline** (800, 28px / 36px md, 1.15, -0.01em): page h1 on every screen, including the greeting.
- **Today** (800, 26px / 34px md, 1.12, -0.015em): the today card's heading (juz and page range, or the finished state).
- **Numeral** (800, 34px, 1, tabular): the one big number in a summary card, followed by a 15px muted unit ("/ 604 səhifə").
- **Title** (700, 15px): card headings ("Qrup xətmi", "İştirakçılar", "Ardıcıl gün").
- **Body** (400, 15px, relaxed, max 65ch): translations, messages, explanatory sentences.
- **Meta** (400, 13px, muted): dates, summaries, row sub-lines, helper text.
- **Label** (700, 12px): chips. Tab bar labels are 11px, bold when idle and extra-bold when active.
- **Arabic** (Amiri 400, 24px / 28px md, line-height 1.8, right-aligned): daily ayah and hadith.

### Named Rules
**The Two Heavy Weights Rule.** Card headings are 700; page h1, the today heading and big numerals are 800. Nothing in between is used for headings.

**The Sentence Summary Rule.** A card states one numeral, then one sentence of meta text. Don't split a summary into a row of equal stat tiles.

**The Caption Not Kicker Rule.** A small old-gold caption may name a content figure ("Günün ayəsi"); it never sits above a page or card heading as an eyebrow, and nothing is uppercased or letter-spaced.

## Layout

Mobile-first. On phones, content runs in one column with 16px side padding, 24px top padding and 128px bottom padding to clear the floating tab bar. Sections stack with 20px gaps (28px from md).

From md (768px) a 264px white sidebar with a hairline right border holds the logo, the active-group switcher and the navigation; content gets 48px side padding inside a 1120px max-width column. The dashboard becomes a flex-wrap pair: a wide work column (basis 520px) and a group column (basis 320px) on the right. The page tile grid is 5 columns on phones and 10 from sm.

Every interactive target is at least 44px tall; buttons are 40, 48 or 52px.

## Elevation & Depth

Soft, ambient, single-layer. Cards lift slightly off the cream with a two-part warm shadow; floating chrome (tab bar, menus, dialogs) gets one deeper shadow. Depth never encodes state; state is carried by colour.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(43,36,31,0.04), 0 8px 24px -12px rgba(43,36,31,0.12)`): every card, the header bell and profile buttons, the selected segment in a segmented filter.
- **Float** (`box-shadow: 0 8px 28px -10px rgba(43,36,31,0.22)`): the floating tab bar, the profile menu, dialogs.

### Named Rules
**The Warm Shadow Rule.** Shadows are tinted with ink (43,36,31), never neutral black, and never hard-offset.

## Shapes

Everything is softly rounded and grows with size: page tiles 12px, inputs and small controls 14px, buttons 16px, the active tab 20px, cards 24px, hero and dialog cards 28px, the tab bar 26px. Chips, avatars, bars and streak dots are fully round. Borders are 1px hairlines; the only 2px borders mark the next page tile and today's streak day.

## Components

### Buttons
Soft, solid, tactile.
- **Shape:** gently rounded (16px).
- **Primary:** forest fill, white bold text, 48px (52px large, full-width on phones for the today action); hover forest press.
- **Outline:** white with a field stroke, ink text; hover sand. A stronger ink-stroke variant exists for emphasis.
- **Quiet:** sand fill, ink text; hover track.
- **Danger:** white with a danger-line stroke and danger text; hover a pale blush.
- **Disabled:** track fill, muted text, no border, not-allowed cursor.
- **Press:** all pressables carry the soft press: scale 0.97 on active, 160ms cubic-bezier(0.22, 1, 0.36, 1), disabled under reduced motion.

### Chips
- **Style:** full pill, 12px bold, 4px by 10px padding, no border.
- **Tones:** finished (sage mist / deep sage), in progress and pending (wheat / brown wheat), owner (sand / old gold), neutral (sand / muted).

### Cards / Containers
- **Corner Style:** 24px; the today card, empty states and dialogs use 28px.
- **Background:** white on cream.
- **Shadow Strategy:** Card shadow (see Elevation).
- **Border:** 1px hairline; danger cards swap to the danger line.
- **Internal Padding:** 18px (24px md); hero cards 22px (32px md); 14px gap between children.

### Inputs / Fields
- **Style:** 48px tall, white, 1px field stroke, 14px corners, 16px ink text (prevents iOS zoom), warm grey placeholder.
- **Focus:** border turns forest with a 2px forest ring at 15% opacity. Keyboard focus elsewhere is a 2px forest outline offset 2px.
- **Date fields:** leading calendar stroke icon; the whole field opens the native picker.

### Navigation
- **Mobile:** a floating white pill tab bar (95% white with backdrop blur, 26px corners, hairline border, float shadow) inset 12px from the edges above the safe area; four equal tabs of icon over 11px label. Active tab: mint background, forest icon and extra-bold label; idle: muted.
- **Desktop:** white sidebar, 48px items with icon and 15px label; active item mint with forest extra-bold text, idle items semibold sidebar text with cream hover. Sign-out sits at the bottom in danger red.

### Page Tile Grid (signature)
The member's 20 pages of the day as 44px tiles, 12px corners, bold tabular numbers. Open: cream with hairline and muted number. Next: mint with a 2px forest border. Marked: solid forest with white number; tapping fills it with the press motion. This is the one place the action colour fills a data cell, because each tile is itself a button.

### Juz Map
Thirty juz tiles (5 columns on phones, auto-fill 88px on wide screens): finished in solid sage with white text, in progress in wheat with an amber border, assigned in white with a grey stroke, unassigned in pale dashed cream. A legend follows the grid.

### Progress Bar
Fully round, 8-14px tall, on track; sage when finished, amber while under way; width animates over 600ms with the same easing as the press.

## Do's and Don'ts

### Do:
- **Do** keep forest (#0F5C45) for pressables, the active tab, live selection and marked page tiles only.
- **Do** draw finished data in sage (#6E8F7C) and in-progress data in amber (#C98A2B) on the track (#EFE5D6).
- **Do** drop disabled buttons to track with muted text.
- **Do** set page h1 and the today heading in Nunito 800, card headings in Nunito 700.
- **Do** summarise with one 34px extra-bold numeral and one 13px muted sentence.
- **Do** give every tappable element the soft press and a 44px minimum target.
- **Do** use Amiri, right-to-left, at 1.8 line height for all Arabic text.
- **Do** use the one-weight stroke icon set (24px grid, 2px stroke, round caps).

### Don't:
- **Don't** use forest for bars, rings, finished juz, streak days or any non-pressable decoration.
- **Don't** build rows of equal stat tiles, dark hero slabs or progress rings as the main summary device.
- **Don't** put eyebrow or kicker labels above headings, and don't uppercase or letter-space labels.
- **Don't** use emoji or text glyphs as icons.
- **Don't** use any font other than Nunito for Latin text or Amiri for Arabic.
- **Don't** use neutral-black or hard-offset shadows.
- **Don't** present streaks or member status as a ranking, score or leaderboard.
