// Draws an encouragement (ayah, hadith or kind word) as a 1080x1920 story image, ready to be
// shared to a WhatsApp status through the phone's share sheet. The card is the whole image:
// the words are set as large as the frame allows, centred, with nothing else on it.
import type { Encouragement } from "./dailyContent";

const W = 1080;
const H = 1920;
const SIDE = 110;            // left/right margin
const MAX_BLOCK = H * 0.74;  // the text block may take up to this much height

const COLORS = {
  ground: "#FFFFFF",
  edge: "#F6F1E8",
  ink: "#2B241F",
  muted: "#6F625A",
  gold: "#7A5718",
  rule: "#E2B85C",
};

const KIND_TITLE: Record<Encouragement["kind"], string> = {
  ayah: "Ayə",
  hadith: "Hədis",
  word: "Allah qəbul etsin",
};

// The real family names next/font generated for Nunito and Amiri
function fontFamily(variable: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Layout {
  arSize: number;
  trSize: number;
  arLines: string[];
  trLines: string[];
  height: number;
}

export async function renderShareImage(item: Encouragement): Promise<Blob> {
  const sans = fontFamily("--font-nunito", "system-ui, sans-serif");
  const arabic = fontFamily("--font-amiri", "serif");
  // Make sure the faces are ready before measuring
  await Promise.all([
    document.fonts.load(`800 44px ${sans}`, "Ayə Hədis"),
    document.fonts.load(`700 60px ${sans}`, "Əə"),
    item.text ? document.fonts.load(`400 80px ${arabic}`, item.text) : Promise.resolve([]),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const inner = W - SIDE * 2;

  const TITLE = 44;
  const GAP = 56;
  const SOURCE = 40;

  // Largest type that still fits: short texts are set big, long ones shrink to fit the frame
  const measure = (scale: number): Layout => {
    const arSize = Math.round(92 * scale);
    const trSize = Math.round((item.text ? 64 : 80) * scale);
    ctx.font = `400 ${arSize}px ${arabic}`;
    ctx.direction = "rtl";
    const arLines = item.text ? wrap(ctx, item.text, inner) : [];
    ctx.direction = "ltr";
    ctx.font = `700 ${trSize}px ${sans}`;
    const trLines = wrap(ctx, item.translation, inner);
    const height =
      TITLE + GAP +
      (arLines.length ? arLines.length * arSize * 1.75 + GAP : 0) +
      trLines.length * trSize * 1.42 +
      (item.source ? GAP + SOURCE : 0);
    return { arSize, trSize, arLines, trLines, height };
  };
  let layout = measure(1.5);
  for (let scale = 1.45; scale >= 0.55 && layout.height > MAX_BLOCK; scale -= 0.05) {
    layout = measure(scale);
  }

  // Ground: white card filling the frame, a soft warm edge so it reads as a card in the status viewer
  ctx.fillStyle = COLORS.edge;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.ground;
  ctx.beginPath();
  const inset = 28;
  const r = 64;
  ctx.moveTo(inset + r, inset);
  ctx.arcTo(W - inset, inset, W - inset, H - inset, r);
  ctx.arcTo(W - inset, H - inset, inset, H - inset, r);
  ctx.arcTo(inset, H - inset, inset, inset, r);
  ctx.arcTo(inset, inset, W - inset, inset, r);
  ctx.closePath();
  ctx.fill();

  let y = Math.round((H - layout.height) / 2);
  ctx.textBaseline = "top";

  // Kind label with a short gold rule
  ctx.fillStyle = COLORS.rule;
  ctx.fillRect(SIDE, y + TITLE / 2 - 3, 56, 6);
  ctx.fillStyle = COLORS.gold;
  ctx.font = `800 ${TITLE}px ${sans}`;
  ctx.textAlign = "left";
  ctx.fillText(KIND_TITLE[item.kind], SIDE + 80, y - 4);
  y += TITLE + GAP;

  if (layout.arLines.length) {
    ctx.fillStyle = COLORS.ink;
    ctx.font = `400 ${layout.arSize}px ${arabic}`;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    for (const line of layout.arLines) {
      ctx.fillText(line, W - SIDE, y + layout.arSize * 0.2);
      y += layout.arSize * 1.75;
    }
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    y += GAP;
  }

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${layout.trSize}px ${sans}`;
  for (const line of layout.trLines) {
    ctx.fillText(line, SIDE, y);
    y += layout.trSize * 1.42;
  }

  if (item.source) {
    y += GAP;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 ${SOURCE}px ${sans}`;
    ctx.fillText(item.source, SIDE, y);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image was not created"))), "image/png")
  );
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

// Opens the share sheet with the image only (WhatsApp -> My status on phones), so the status
// caption stays empty; downloads it where sharing files is not supported.
export async function shareImage(blob: Blob): Promise<ShareResult> {
  const file = new File([blob], "xetm-status.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xetm-status.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
