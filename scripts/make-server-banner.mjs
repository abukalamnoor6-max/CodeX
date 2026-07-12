/**
 * Premium Discord server banner — server name only.
 * Logo palette only: black / silver / white (no blue).
 *
 * Usage: node scripts/make-server-banner.mjs
 */
import fs from "fs";
import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

const ROOT = path.resolve("C:/Users/Admin/Projects/codeX");
const OUT_DIR = path.join(ROOT, "public/discord");

const TITLE = "𝐂𝐨𝐝𝐞𝐗";
const SUB = "Store";

const FONT_BOLD = [
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/seguisb.ttf",
  "C:/Windows/Fonts/tahomabd.ttf",
];
const FONT_LIGHT = [
  "C:/Windows/Fonts/segoeuil.ttf",
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/calibri.ttf",
];

let boldFamily = "sans-serif";
let lightFamily = "sans-serif";
for (const fp of FONT_BOLD) {
  if (fs.existsSync(fp)) {
    GlobalFonts.registerFromPath(fp, "CodeXBold");
    boldFamily = "CodeXBold";
    break;
  }
}
for (const fp of FONT_LIGHT) {
  if (fs.existsSync(fp)) {
    GlobalFonts.registerFromPath(fp, "CodeXLight");
    lightFamily = "CodeXLight";
    break;
  }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLuxuryStars(ctx, W, H, seed) {
  const rng = mulberry32(seed);
  const dust = Math.floor((W * H) / 1000);
  for (let i = 0; i < dust; i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.35 + 0.12})`;
    ctx.arc(x, y, rng() * 1.15 + 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 50; i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.beginPath();
    ctx.fillStyle = `rgba(245,247,255,${0.5 + rng() * 0.45})`;
    ctx.arc(x, y, rng() * 1.9 + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 16; i++) {
    const x = rng() * W;
    const y = rng() * H;
    if (Math.abs(x - W / 2) < W * 0.2 && Math.abs(y - H / 2) < H * 0.18) continue;
    const r = rng() * 2 + 1;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r * 3.2, y);
    ctx.lineTo(x + r * 3.2, y);
    ctx.moveTo(x, y - r * 3.2);
    ctx.lineTo(x, y + r * 3.2);
    ctx.stroke();
  }
}

function drawMetallicText(ctx, text, x, y, fontSize, family) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px ${family}`;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillText(text, x + fontSize * 0.02, y + fontSize * 0.035);
  ctx.restore();

  // Soft silver bloom (logo-like)
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.4)";
  ctx.shadowBlur = fontSize * 0.25;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  ctx.restore();

  // Chrome / metallic face — same vibe as logo letters
  const grad = ctx.createLinearGradient(x, y - fontSize * 0.55, x, y + fontSize * 0.55);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.28, "#f0f0f0");
  grad.addColorStop(0.48, "#8a8a8a");
  grad.addColorStop(0.62, "#d8d8d8");
  grad.addColorStop(0.82, "#6e6e6e");
  grad.addColorStop(1, "#c8c8c8");
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);

  ctx.lineWidth = Math.max(1.5, fontSize * 0.018);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeText(text, x, y);
}

function makeBanner(W, H, outPath) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Soft charcoal lift behind name (no color)
  const depth = ctx.createRadialGradient(
    W * 0.5,
    H * 0.48,
    H * 0.04,
    W * 0.5,
    H * 0.5,
    Math.max(W, H) * 0.55,
  );
  depth.addColorStop(0, "rgba(28,28,30,0.85)");
  depth.addColorStop(0.55, "rgba(8,8,10,0.4)");
  depth.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, W, H);

  drawLuxuryStars(ctx, W, H, 91);

  const stage = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.7);
  stage.addColorStop(0, "rgba(255,255,255,0)");
  stage.addColorStop(0.5, "rgba(255,255,255,0.03)");
  stage.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = stage;
  ctx.fillRect(0, 0, W, H);

  const titleSize = Math.round(H * 0.32);
  const cx = W / 2;
  const cy = H * 0.46;

  drawMetallicText(ctx, TITLE, cx, cy, titleSize, boldFamily);

  // Slightly stronger metallic punch on X (still grayscale, like logo)
  ctx.font = `700 ${titleSize}px ${boldFamily}`;
  const codeW = ctx.measureText("code").width;
  const fullW = ctx.measureText(TITLE).width;
  const xPos = cx - fullW / 2 + codeW + (fullW - codeW) / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${titleSize}px ${boldFamily}`;
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = titleSize * 0.2;
  const xGrad = ctx.createLinearGradient(xPos, cy - titleSize * 0.5, xPos, cy + titleSize * 0.5);
  xGrad.addColorStop(0, "#ffffff");
  xGrad.addColorStop(0.35, "#eaeaea");
  xGrad.addColorStop(0.55, "#9a9a9a");
  xGrad.addColorStop(0.75, "#f5f5f5");
  xGrad.addColorStop(1, "#7a7a7a");
  ctx.fillStyle = xGrad;
  ctx.fillText("X", xPos, cy);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.5, titleSize * 0.02);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.strokeText("X", xPos, cy);
  ctx.restore();

  const ruleY = cy + titleSize * 0.52;
  const ruleW = W * 0.14;
  const ruleGrad = ctx.createLinearGradient(cx - ruleW, ruleY, cx + ruleW, ruleY);
  ruleGrad.addColorStop(0, "rgba(255,255,255,0)");
  ruleGrad.addColorStop(0.5, "rgba(255,255,255,0.4)");
  ruleGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = ruleGrad;
  ctx.lineWidth = Math.max(1, H * 0.0025);
  ctx.beginPath();
  ctx.moveTo(cx - ruleW, ruleY);
  ctx.lineTo(cx + ruleW, ruleY);
  ctx.stroke();

  const subSize = Math.round(H * 0.055);
  ctx.font = `400 ${subSize}px ${lightFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(200,200,200,0.55)";
  try {
    ctx.letterSpacing = `${Math.round(subSize * 0.35)}px`;
  } catch {
    /* ignore */
  }
  ctx.fillText(SUB.toUpperCase(), cx, ruleY + H * 0.03);

  const vig = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.18,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.7,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log("wrote", outPath, `${W}x${H}`, `${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

makeBanner(960, 540, path.join(OUT_DIR, "codex-server-banner.png"));
makeBanner(1920, 1080, path.join(OUT_DIR, "codex-server-banner-2k.png"));
