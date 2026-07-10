import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const logoPath = "C:/Users/Admin/Projects/codeX/public/discord/codex-logo-source.png";
const logo = await loadImage(logoPath);

function makeDivider(W, H, outPath) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Pure black
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Soft radial vignette (very subtle navy)
  const vg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.55);
  vg.addColorStop(0, "rgba(8,14,28,0.55)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // White stars
  const count = Math.floor((W * H) / 900);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.6 + 0.3;
    const a = Math.random() * 0.55 + 0.35;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few brighter stars
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.arc(x, y, Math.random() * 2 + 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw logo centered, keep aspect, leave side starfield visible
  const maxH = H * 0.92;
  const maxW = W * 0.42;
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  const dw = logo.width * scale;
  const dh = logo.height * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  // Soft glow behind logo
  const glow = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, dw * 0.55);
  glow.addColorStop(0, "rgba(0,89,219,0.22)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.drawImage(logo, dx, dy, dw, dh);

  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log("wrote", outPath, fs.statSync(outPath).size, `${W}x${H}`);
}

// Ultra-wide Discord divider
makeDivider(1920, 160, "C:/Users/Admin/Projects/codeX/public/discord/codex-divider-stars.png");
// Slightly taller banner version
makeDivider(1920, 320, "C:/Users/Admin/Projects/codeX/public/discord/codex-banner-stars.png");
// Square icon-friendly version
makeDivider(1024, 1024, "C:/Users/Admin/Projects/codeX/public/discord/codex-icon-stars.png");