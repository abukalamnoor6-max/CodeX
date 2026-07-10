import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "discord", "codex-ticket-banner.png");
const LOGO = path.join(ROOT, "public", "discord", "codex-logo-source.png");

const W = 960;
const H = 320;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Black base
ctx.fillStyle = "#000000";
ctx.fillRect(0, 0, W, H);

// Soft navy vignette
const vg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.55);
vg.addColorStop(0, "rgba(8,18,40,0.65)");
vg.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = vg;
ctx.fillRect(0, 0, W, H);

// Stars
const count = Math.floor((W * H) / 650);
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
for (let i = 0; i < 22; i++) {
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2 + 0.7, 0, Math.PI * 2);
  ctx.fill();
}

// Logo centered
const logo = await loadImage(LOGO);
const maxH = H * 0.55;
const maxW = W * 0.28;
const scale = Math.min(maxW / logo.width, maxH / logo.height);
const dw = logo.width * scale;
const dh = logo.height * scale;
const dx = (W - dw) / 2;
const dy = (H - dh) / 2 - 8;

ctx.shadowColor = "rgba(0,120,255,0.25)";
ctx.shadowBlur = 28;
ctx.drawImage(logo, dx, dy, dw, dh);
ctx.shadowBlur = 0;

// Small codeX label under logo
ctx.fillStyle = "rgba(230,230,235,0.9)";
ctx.font = "bold 28px Segoe UI, Tahoma, Arial";
ctx.textAlign = "center";
ctx.fillText("codeX", W / 2, dy + dh + 36);

fs.writeFileSync(OUT, canvas.toBuffer("image/png"));
console.log("wrote", OUT, fs.statSync(OUT).size);
