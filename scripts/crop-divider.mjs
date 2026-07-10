import fs from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const src = await loadImage("C:/Users/Admin/.cursor/projects/c-Users-Admin-Projects-codeX/assets/codex-divider-stars-ai.png");
const W = 1920, H = 180;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
// cover crop center band
const scale = Math.max(W / src.width, H / src.height);
const sw = W / scale, sh = H / scale;
const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
ctx.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
const out = "C:/Users/Admin/Projects/codeX/public/discord/codex-divider-stars-wide.png";
fs.writeFileSync(out, canvas.toBuffer("image/png"));
console.log("wide", out, fs.statSync(out).size);