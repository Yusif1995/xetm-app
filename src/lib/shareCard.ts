// Draws an encouragement (ayah, hadith or kind word) as a 1080x1920 story image, ready to be
// shared to a WhatsApp status through the phone's share sheet.
import type { Encouragement } from "./dailyContent";

const W = 1080;
const H = 1920;
const PAD = 96;

const COLORS = {
  ground: "#F6F1E8",
  card: "#FFFFFF",
  line: "#EADFCF",
  ink: "#2B241F",
  muted: "#6F625A",
  gold: "#7A5718",
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareImage(item: Encouragement): Promise<Blob> {
  const sans = fontFamily("--font-nunito", "system-ui, sans-serif");
  const arabic = fontFamily("--font-amiri", "serif");
  // Make sure the faces are ready before measuring
  await Promise.all([
    document.fonts.load(`800 40px ${sans}`, "Ayə Hədis"),
    document.fonts.load(`600 52px ${sans}`, "Əə"),
    item.text ? document.fonts.load(`400 72px ${arabic}`, item.text) : Promise.resolve([]),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, W, H);

  // Measure the content first so the card can sit in the middle of the frame
  const cardX = PAD - 24;
  const cardW = W - cardX * 2;
  const inner = cardW - 2 * 72;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.font = `400 72px ${arabic}`;
  ctx.direction = "rtl";
  const arLines = item.text ? wrap(ctx, item.text, inner) : [];
  ctx.direction = "ltr";
  ctx.font = `700 54px ${sans}`;
  const trLines = wrap(ctx, item.translation, inner);
  const arLH = 132;
  const trLH = 80;

  const blocks =
    60 /* kind title */ + 48 +
    (arLines.length ? arLines.length * arLH + 40 : 0) +
    trLines.length * trLH +
    (item.source ? 40 + 48 : 0);
  const cardH = blocks + 2 * 80;
  const cardY = Math.round((H - cardH) / 2);

  ctx.save();
  ctx.shadowColor = "rgba(43,36,31,0.12)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.fillStyle = COLORS.card;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cardX, cardY, cardW, cardH, 56);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 3;
  ctx.stroke();

  let y = cardY + 80 + 44;
  const left = cardX + 72;
  const right = cardX + cardW - 72;

  ctx.fillStyle = COLORS.gold;
  ctx.font = `800 40px ${sans}`;
  ctx.fillText(KIND_TITLE[item.kind], left, y);
  y += 48 + 16;

  if (arLines.length) {
    ctx.fillStyle = COLORS.ink;
    ctx.font = `400 72px ${arabic}`;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    for (const line of arLines) {
      y += arLH - 30;
      ctx.fillText(line, right, y);
      y += 30;
    }
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    y += 40;
  }

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 54px ${sans}`;
  for (const line of trLines) {
    y += trLH - 18;
    ctx.fillText(line, left, y);
    y += 18;
  }

  if (item.source) {
    y += 40 + 34;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 38px ${sans}`;
    ctx.fillText(item.source, left, y);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image was not created"))), "image/png")
  );
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

// Opens the share sheet with the image (WhatsApp -> My status on phones); downloads it where
// sharing files is not supported.
export async function shareImage(blob: Blob, item: Encouragement): Promise<ShareResult> {
  const file = new File([blob], "xetm-status.png", { type: "image/png" });
  const text = item.source ? `${item.translation} (${item.source})` : item.translation;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
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
