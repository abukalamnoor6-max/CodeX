import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const W = 1600;
const H = 140;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Background gradient black -> navy -> black
const g = ctx.createLinearGradient(0, 0, W, 0);
g.addColorStop(0, "#02040a");
g.addColorStop(0.25, "#04102a");
g.addColorStop(0.5, "#0a1f4d");
g.addColorStop(0.75, "#04102a");
g.addColorStop(1, "#02040a");
ctx.fillStyle = g;
ctx.fillRect(0, 0, W, H);

// Soft silk waves
for (let i = 0; i < 8; i++) {
  ctx.beginPath();
  const y = 20 + i * 14;
  ctx.moveTo(0, y);
  for (let x = 0; x <= W; x += 20) {
    const yy = y + Math.sin(x / 90 + i) * (6 + i * 0.4) + Math.cos(x / 160) * 3;
    ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = `rgba(0, 89, 219, ${0.08 + i * 0.02})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Center glow
const rg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 220);
rg.addColorStop(0, "rgba(0,89,219,0.35)");
rg.addColorStop(1, "rgba(0,89,219,0)");
ctx.fillStyle = rg;
ctx.fillRect(0, 0, W, H);

// Thin horizontal lines
ctx.strokeStyle = "rgba(255,255,255,0.18)";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(80, H / 2);
ctx.lineTo(W / 2 - 70, H / 2);
ctx.moveTo(W / 2 + 70, H / 2);
ctx.lineTo(W - 80, H / 2);
ctx.stroke();

// Center circle badge
ctx.beginPath();
ctx.arc(W / 2, H / 2, 34, 0, Math.PI * 2);
ctx.fillStyle = "rgba(5,10,20,0.85)";
ctx.fill();
ctx.strokeStyle = "rgba(255,255,255,0.85)";
ctx.lineWidth = 2;
ctx.stroke();

ctx.beginPath();
ctx.arc(W / 2, H / 2, 28, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(0,89,219,0.9)";
ctx.lineWidth = 1.5;
ctx.stroke();

// CX monogram
ctx.fillStyle = "#ffffff";
ctx.font = "bold 22px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("CX", W / 2, H / 2 + 1);

// Tiny side diamonds
function diamond(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}
diamond(W / 2 - 55, H / 2, 3);
diamond(W / 2 + 55, H / 2, 3);

const out = "C:/Users/Admin/Projects/codeX/public/discord/codex-divider.png";
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log("wrote", out, fs.statSync(out).size);

// Also try blend source image if available
try {
  const src = await loadImage("C:/Users/Admin/Projects/codeX/public/discord/divider-source.png");
  const c2 = createCanvas(W, H);
  const x = c2.getContext("2d");
  // cover crop center band
  const scale = Math.max(W / src.width, H / src.height);
  const sw = W / scale;
  const sh = H / scale;
  const sx = (src.width - sw) / 2;
  const sy = (src.height - sh) / 2;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  // darken sides + overlay monogram plate
  const overlay = x.createLinearGradient(0, 0, W, 0);
  overlay.addColorStop(0, "rgba(0,0,0,0.55)");
  overlay.addColorStop(0.5, "rgba(0,0,0,0.15)");
  overlay.addColorStop(1, "rgba(0,0,0,0.55)");
  x.fillStyle = overlay;
  x.fillRect(0, 0, W, H);
  // center badge
  x.beginPath();
  x.arc(W / 2, H / 2, 32, 0, Math.PI * 2);
  x.fillStyle = "rgba(0,0,0,0.55)";
  x.fill();
  x.strokeStyle = "rgba(255,255,255,0.9)";
  x.lineWidth = 2;
  x.stroke();
  x.fillStyle = "#fff";
  x.font = "bold 20px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("CX", W / 2, H / 2 + 1);
  const out2 = "C:/Users/Admin/Projects/codeX/public/discord/codex-divider-v2.png";
  fs.writeFileSync(out2, c2.toBuffer("image/png"));
  console.log("wrote", out2, fs.statSync(out2).size);
} catch (e) {
  console.log("blend skip", e.message);
}