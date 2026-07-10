import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const W = 1100;
const H = 400;

const FONT_REGULAR = "CodeXArabic";
const FONT_BOLD = "CodeXArabicBold";
let fontsReady = false;

function registerArabicFonts() {
  if (fontsReady) return true;

  const files = [
    {
      path: path.join(ROOT, "public", "fonts", "NotoSansArabic-Regular.ttf"),
      name: FONT_REGULAR,
    },
    {
      path: path.join(ROOT, "public", "fonts", "NotoSansArabic-Bold.ttf"),
      name: FONT_BOLD,
    },
    {
      path: "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
      name: FONT_REGULAR,
    },
    {
      path: "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
      name: FONT_BOLD,
    },
    {
      path: "/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf",
      name: FONT_REGULAR,
    },
    {
      path: "/usr/share/fonts/truetype/amiri/Amiri-Bold.ttf",
      name: FONT_BOLD,
    },
  ];

  const got = new Set();
  for (const f of files) {
    if (got.has(f.name)) continue;
    try {
      if (!fs.existsSync(f.path)) continue;
      GlobalFonts.registerFromPath(f.path, f.name);
      got.add(f.name);
    } catch (e) {
      console.warn("font register failed", f.path, e.message);
    }
  }

  if (!got.has(FONT_REGULAR)) {
    console.warn(
      "No Arabic font found — welcome card text may render as boxes",
    );
    return false;
  }

  // If bold missing, reuse regular for bold requests
  if (!got.has(FONT_BOLD) && got.has(FONT_REGULAR)) {
    try {
      const reg = files.find(
        (x) => x.name === FONT_REGULAR && fs.existsSync(x.path),
      );
      if (reg) GlobalFonts.registerFromPath(reg.path, FONT_BOLD);
    } catch {}
  }

  fontsReady = true;
  return true;
}

function font(weight, size) {
  registerArabicFonts();
  const family = weight === "bold" ? FONT_BOLD : FONT_REGULAR;
  return `${size}px "${family}", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`;
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

function fitText(ctx, text, maxWidth) {
  let t = String(text || "");
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
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
  registerArabicFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Solid black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Soft navy vignette (very subtle depth)
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

  // White starfield
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
  // Brighter stars
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.arc(x, y, Math.random() * 2 + 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few pointed stars
  const pointed = [
    [90, 50, 6],
    [180, 30, 4],
    [980, 40, 5],
    [1040, 90, 4],
    [70, 340, 5],
    [1020, 350, 6],
    [520, 28, 3],
    [760, 370, 4],
  ];
  for (const [x, y, r] of pointed) {
    drawStar(ctx, x, y, r, r * 0.42, "rgba(255,255,255,0.85)");
  }

  // Soft panel edge (subtle)
  roundRectPath(ctx, 18, 18, W - 36, H - 36, 22);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Avatar
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

  // Logo
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

  // Text — Arabic font registered for Railway/Linux
  ctx.textAlign = "right";
  ctx.direction = "rtl";

  ctx.fillStyle = "#f5f5f5";
  ctx.font = font("bold", 40);
  ctx.fillText("أهلاً بك في codeX", W - 64, 120);

  const name = displayName || username || "عضو جديد";
  ctx.fillStyle = "#ffffff";
  ctx.font = font("bold", 34);
  ctx.fillText(fitText(ctx, name, 680), W - 64, 175);

  ctx.fillStyle = "rgba(210,210,220,0.9)";
  ctx.font = font("normal", 22);
  ctx.fillText(`@${fitText(ctx, username || "", 560)}`, W - 64, 215);

  ctx.font = font("normal", 24);
  ctx.fillStyle = "rgba(230,230,235,0.95)";
  const lines = [
    "نورت السيرفر",
    "سعداء بانضمامك — فريق codeX معك",
    memberCount ? `أنت العضو رقم ${memberCount}` : null,
  ].filter(Boolean);
  let ly = 270;
  for (const line of lines) {
    ctx.fillText(line, W - 64, ly);
    ly += 34;
  }

  // Accent bar
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(32, 56, 3, H - 112);

  return canvas.toBuffer("image/png");
}
