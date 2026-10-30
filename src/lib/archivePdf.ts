"use client";
// PDF export of archive records, built in the browser with pdf-lib. Noto Sans (public/fonts, OFL)
// is embedded as a subset so Azerbaijani letters (ə, ğ, ı, İ, ş, ç, ö, ü) print correctly.
// On phones the file goes to the share sheet (Save to Files, Telegram, ...), elsewhere it downloads.
import type { PDFFont, PDFPage } from "pdf-lib";
import type { ArchiveEntry } from "./archive.ts";
import { entrySummary, entryTables, entryTitle, type ArchiveTable } from "./archiveFormat.ts";
import { formatGregorianAz } from "./dates.ts";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 44;
const ROW = 17;

export async function exportArchivePdf(entries: ArchiveEntry[], heading: string, fileName: string): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetch("/fonts/NotoSans-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/NotoSans-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  const bytes = await buildArchivePdf(entries, heading, { regular, bold });
  await deliver(new Blob([bytes as BlobPart], { type: "application/pdf" }), fileName);
}

// The PDF itself; fonts are passed in so this also runs outside the browser (tests)
export async function buildArchivePdf(entries: ArchiveEntry[], heading: string, fonts: { regular: ArrayBuffer; bold: ArrayBuffer }): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit").then((m) => m.default),
  ]);
  const regularBytes = fonts.regular;
  const boldBytes = fonts.bold;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(heading);
  pdf.setCreator("Xətm");
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });

  const ink = rgb(0.17, 0.14, 0.12);
  const muted = rgb(0.44, 0.38, 0.35);
  const forest = rgb(0.06, 0.36, 0.27);
  const line = rgb(0.92, 0.87, 0.81);
  const band = rgb(0.96, 0.92, 0.87);
  const width = A4[0] - MARGIN * 2;

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN + 20) newPage();
  };
  const fit = (text: string, font: PDFFont, size: number, max: number) => {
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > max) t = t.slice(0, -1);
    return `${t}…`;
  };
  const text = (s: string, x: number, size: number, font: PDFFont, color = ink, max = width) => {
    page.drawText(fit(s, font, size, max), { x, y, size, font, color });
  };

  const drawTable = (t: ArchiveTable) => {
    const xs = t.columns.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? MARGIN : acc[i - 1] + t.columns[i - 1].width * width], []);
    const cell = (value: string, i: number, font: PDFFont, color = ink) => {
      const c = t.columns[i];
      const w = c.width * width - 8;
      const s = fit(value, font, 9, w);
      const x = c.align === "right" ? xs[i] + w - font.widthOfTextAtSize(s, 9) : xs[i] + 4;
      page.drawText(s, { x, y, size: 9, font, color });
    };
    const header = () => {
      page.drawRectangle({ x: MARGIN, y: y - 5, width, height: ROW, color: band });
      t.columns.forEach((c, i) => cell(c.label, i, bold, muted));
      y -= ROW;
    };

    ensure(ROW * 3 + 14);
    text(t.title, MARGIN, 10.5, bold);
    y -= 16;
    header();
    t.rows.forEach((row) => {
      if (y - ROW < MARGIN + 20) {
        newPage();
        header();
      }
      row.forEach((v, i) => cell(v, i, regular));
      page.drawLine({ start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + width, y: y - 5 }, thickness: 0.5, color: line });
      y -= ROW;
    });
    y -= 10;
  };

  // Document heading
  const groupName = entries[0]?.groupName || "";
  text(heading, MARGIN, 18, bold, forest);
  y -= 20;
  text(`${groupName ? `${groupName} · ` : ""}Hazırlanıb: ${formatGregorianAz(new Date())}`, MARGIN, 10, regular, muted);
  y -= 26;

  if (entries.length === 0) {
    text("Arxivdə qeyd yoxdur.", MARGIN, 11, regular, muted);
  }

  entries.forEach((e, i) => {
    if (i > 0) {
      ensure(80);
      page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: MARGIN + width, y: y + 8 }, thickness: 1, color: line });
      y -= 12;
    }
    ensure(70);
    text(entryTitle(e), MARGIN, 14, bold);
    y -= 18;
    entrySummary(e).forEach((s) => {
      text(s, MARGIN, 10, regular, muted);
      y -= 14;
    });
    y -= 8;
    entryTables(e).forEach(drawTable);
  });

  // Page numbers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: MARGIN - 18, size: 8, font: regular, color: muted });
    p.drawText("Xətm", { x: MARGIN, y: MARGIN - 18, size: 8, font: regular, color: muted });
  });

  return pdf.save();
}

async function deliver(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (err) {
      // The person closed the share sheet: nothing to do
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// "Xetm-arxiv-xetmler-2026-10-30.pdf": ASCII only, so every phone and app keeps the name
export function pdfFileName(...parts: string[]): string {
  const ascii = (s: string) => s
    .replace(/[əƏ]/g, "e").replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g").replace(/[öÖ]/g, "o").replace(/[üÜ]/g, "u")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${["Xetm", ...parts].map(ascii).filter(Boolean).join("-")}.pdf`;
}
