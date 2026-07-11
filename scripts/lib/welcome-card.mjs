import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const W = 1100;
const H = 400;

const AR_REG = "CodeXAr";
const AR_BOLD = "CodeXArBold";
const LAT_REG = "CodeXLat";
const LAT_BOLD = "CodeXLatBold";
let fontsReady = false;

function tryRegister(file, name, got) {
  if (got.has(name)) return;
  try {
    if (!fs.existsSync(file)) return;
    GlobalFonts.registerFromPath(file, name);
    got.add(name);
  } catch (e) {
    console.warn("font register failed", file, e.message);
  }
}

function registerFonts() {
  if (fontsReady) return true;
  const got = new Set();
  const fontsDir = path.join(ROOT, "public", "fonts");

  tryRegister(path.join(fontsDir, "NotoSansArabic-Regular.ttf"), AR_REG, got);
  tryRegister(path.join(fontsDir, "NotoSansArabic-Bold.ttf"), AR_BOLD, got);
  tryRegister(path.join(fontsDir, "NotoSans-Regular.ttf"), LAT_REG, got);
  tryRegister(path.join(fontsDir, "NotoSans-Bold.ttf"), LAT_BOLD, got);

  // Linux fallbacks
  tryRegister("/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf", AR_REG, got);
  tryRegister("/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf", AR_BOLD, got);
  tryRegister("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", LAT_REG, got);
  tryRegister("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", LAT_BOLD, got);
  tryRegister("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", LAT_REG, got);
  tryRegister("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", LAT_BOLD, got);
  tryRegister("/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf", AR_REG, got);
  tryRegister("/usr/share/fonts/truetype/amiri/Amiri-Bold.ttf", AR_BOLD, got);

  if (!got.has(AR_BOLD) && got.has(AR_REG)) {
    tryRegister(path.join(fontsDir, "NotoSansArabic-Regular.ttf"), AR_BOLD, got);
  }
  if (!got.has(LAT_BOLD) && got.has(LAT_REG)) {
    tryRegister(path.join(fontsDir, "NotoSans-Regular.ttf"), LAT_BOLD, got);
  }
  if (!got.has(LAT_REG) && got.has(AR_REG)) {
    // last resort: reuse arabic family name slot with same file (may still miss fancy glyphs)
    got.add(LAT_REG);
  }

  fontsReady = got.has(AR_REG) || got.has(LAT_REG);
  if (!fontsReady) console.warn("No fonts registered for welcome card");
  return fontsReady;
}

/** Convert Mathematical Alphanumeric + fancy separators to plain text */
export function normalizeFancyText(input) {
  let out = "";
  for (const ch of String(input || "")) {
    const c = ch.codePointAt(0);
    const mapRange = (start, latin) => {
      if (c >= start && c < start + 26) return String.fromCharCode(latin + (c - start));
      return null;
    };
    let mapped =
      mapRange(0x1d400, 65) || // bold A
      mapRange(0x1d41a, 97) || // bold a
      mapRange(0x1d434, 65) || // italic A
      mapRange(0x1d44e, 97) ||
      mapRange(0x1d468, 65) || // bold italic A
      mapRange(0x1d482, 97) ||
      mapRange(0x1d4d0, 65) || // bold script
      mapRange(0x1d4ea, 97) ||
      mapRange(0x1d56c, 65) || // bold fraktur
      mapRange(0x1d586, 97) ||
      mapRange(0x1d5a0, 65) || // sans
      mapRange(0x1d5ba, 97) ||
      mapRange(0x1d5d4, 65) || // sans bold
      mapRange(0x1d5ee, 97) ||
      mapRange(0x1d608, 65) || // sans italic
      mapRange(0x1d622, 97) ||
      mapRange(0x1d63c, 65) || // sans bold italic
      mapRange(0x1d656, 97) ||
      mapRange(0x1d670, 65) || // monospace
      mapRange(0x1d68a, 97);

    if (mapped) {
      out += mapped;
      continue;
    }
    if (ch === "〢" || ch === "│" || ch === "丨") {
      out += "|";
      continue;
    }
    if (ch === "—" || ch === "–" || ch === "−") {
      out += "-";
      continue;
    }
    if (ch === "…" ) {
      out += "...";
      continue;
    }
    out += ch;
  }
  return out.normalize("NFC");
}

function isArabicChar(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x0600 && c <= 0x06ff) ||
    (c >= 0x0750 && c <= 0x077f) ||
    (c >= 0x08a0 && c <= 0x08ff) ||
    (c >= 0xfb50 && c <= 0xfdff) ||
    (c >= 0xfe70 && c <= 0xfeff)
  );
}

function isLatinOrDigit(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x30 && c <= 0x39) ||
    (c >= 0x41 && c <= 0x5a) ||
    (c >= 0x61 && c <= 0x7a) ||
    ch === "@" ||
    ch === "#" ||
    ch === "_" ||
    ch === "." ||
    ch === "-" ||
    ch === "|" ||
    ch === ":" ||
    ch === "/" ||
    ch === "\\"
  );
}

function splitRuns(text) {
  const runs = [];
  let buf = "";
  let kind = null; // "ar" | "lat" | "other"
  const kindOf = (ch) => {
    if (isArabicChar(ch)) return "ar";
    if (isLatinOrDigit(ch)) return "lat";
    if (/\s/.test(ch)) return kind || "other";
    return "other";
  };
  for (const ch of text) {
    const k = kindOf(ch);
    const use = k === "other" && kind ? kind : k;
    if (kind === null) {
      kind = use;
      buf = ch;
    } else if (use === kind || (k === "other" && kind)) {
      buf += ch;
    } else {
      runs.push({ kind, text: buf });
      kind = use;
      buf = ch;
    }
  }
  if (buf) runs.push({ kind: kind || "other", text: buf });
  return runs;
}

function fontFor(kind, weight, size) {
  registerFonts();
  const bold = weight === "bold";
  if (kind === "ar") {
    const fam = bold ? AR_BOLD : AR_REG;
    return `${size}px "${fam}"`;
  }
  const fam = bold ? LAT_BOLD : LAT_REG;
  // if latin missing, fall back to arabic family
  return `${size}px "${fam}", "${bold ? AR_BOLD : AR_REG}"`;
}

function measureMixed(ctx, text, weight, size) {
  let w = 0;
  for (const run of splitRuns(text)) {
    ctx.font = fontFor(run.kind === "ar" ? "ar" : "lat", weight, size);
    w += ctx.measureText(run.text).width;
  }
  return w;
}

/** Draw RTL-aligned mixed Arabic/Latin text without missing-glyph boxes */
function fillMixedRight(ctx, text, rightX, y, weight, size, maxWidth) {
  let t = normalizeFancyText(text);
  // fit
  while (t.length > 1 && measureMixed(ctx, t, weight, size) > maxWidth) {
    t = `${t.slice(0, -2)}…`;
  }

  const runs = splitRuns(t);
  // For right-aligned line: draw from right to left in visual order
  let x = rightX;
  ctx.textAlign = "right";
  ctx.direction = "ltr"; // we position manually
  for (const run of runs) {
    const kind = run.kind === "ar" ? "ar" : "lat";
    ctx.font = fontFor(kind, weight, size);
    ctx.fillText(run.text, x, y);
    x -= ctx.measureText(run.text).width;
  }
}

function drawStar(ctx, x, y, outerR, innerR, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / 2) * 3 + (i * Math.PI) / 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Black starfield welcome card — avatar + name + Arabic welcome.
 */
export async function renderWelcomeCard({
  displayName,
  username,
  avatarUrl,
  memberCount,
}) {
  registerFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const vg = ctx.createRadialGradient(
    W * 0.35,
    H * 0.5,
    40,
    W * 0.5,
    H * 0.5,
    Math.max(W, H) * 0.7,
  );
  vg.addColorStop(0, "rgba(10,16,32,0.55)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const count = Math.floor((W * H) / 700);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.5 + 0.25;
    const a = Math.random() * 0.55 + 0.25;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.arc(x, y, Math.random() * 2 + 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, r] of [
    [90, 50, 6],
    [180, 30, 4],
    [980, 40, 5],
    [1040, 90, 4],
    [70, 340, 5],
    [1020, 350, 6],
    [520, 28, 3],
    [760, 370, 4],
  ]) {
    drawStar(ctx, x, y, r, r * 0.42, "rgba(255,255,255,0.85)");
  }

  roundRectPath(ctx, 18, 18, W - 36, H - 36, 22);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const ax = 160;
  const ay = H / 2;
  const ar = 92;

  ctx.beginPath();
  ctx.arc(ax, ay, ar + 12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ax, ay, ar + 6, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  try {
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.restore();
  } catch {
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }

  try {
    const logo = await loadImage(
      path.join(ROOT, "public", "discord", "codex-logo-source.png"),
    );
    const lw = 48;
    const lh = (logo.height / logo.width) * lw;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, W - 100, 42, lw, lh);
    ctx.globalAlpha = 1;
  } catch {
    // optional
  }

  const right = W - 64;
  const cleanName = normalizeFancyText(
    displayName || username || "عضو جديد",
  );
  const cleanUser = normalizeFancyText(username || "");

  ctx.fillStyle = "#f5f5f5";
  fillMixedRight(ctx, "أهلاً بك في codeX", right, 120, "bold", 40, 720);

  ctx.fillStyle = "#ffffff";
  fillMixedRight(ctx, cleanName, right, 175, "bold", 34, 680);

  ctx.fillStyle = "rgba(210,210,220,0.9)";
  fillMixedRight(ctx, `@${cleanUser}`, right, 215, "normal", 22, 560);

  ctx.fillStyle = "rgba(230,230,235,0.95)";
  const lines = [
    "نورت السيرفر",
    "سعداء بانضمامك - فريق codeX معك",
    memberCount ? `أنت العضو رقم ${memberCount}` : null,
  ].filter(Boolean);
  let ly = 270;
  for (const line of lines) {
    fillMixedRight(ctx, line, right, ly, "normal", 24, 720);
    ly += 34;
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(32, 56, 3, H - 112);

  return canvas.toBuffer("image/png");
}
