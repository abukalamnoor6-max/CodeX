/**
 * Animated codeX logo — real transparent GIF (alpha=0 background).
 * Usage: node scripts/make-animated-logo.mjs
 */
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import GIFEncoder from "gif-encoder-2";

const ROOT = path.resolve("C:/Users/Admin/Projects/codeX");
const SRC = path.join(ROOT, "public/discord/codex-logo-source.png");
const OUT_GIF = path.join(ROOT, "public/discord/codex-logo-animated.gif");

const SIZE = 400;
const FRAMES = 24;
const DELAY_MS = 80;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prepareLogo(img) {
  const w = img.width;
  const h = img.height;
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const visited = new Uint8Array(w * h);

  const isBg = (i) => {
    const o = i * 4;
    return d[o] <= 18 && d[o + 1] <= 18 && d[o + 2] <= 18 && d[o + 3] > 0;
  };

  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i] || !isBg(i)) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    d[o] = 0;
    d[o + 1] = 0;
    d[o + 2] = 0;
    d[o + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  ctx.putImageData(data, 0, 0);
  return c;
}

async function main() {
  const raw = await loadImage(SRC);
  const logo = prepareLogo(raw);

  const encoder = new GIFEncoder(SIZE, SIZE, "neuquant", false, FRAMES);
  encoder.setDelay(DELAY_MS);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  // gif-encoder-2: pixels with alpha === 0 become transparent
  encoder.setTransparent(0x000000);
  encoder.setDispose(2);
  encoder.start();

  const max = SIZE * 0.92;
  const scale = Math.min(max / logo.width, max / logo.height);
  const dw = logo.width * scale;
  const dh = logo.height * scale;
  const baseX = (SIZE - dw) / 2;
  const baseY = (SIZE - dh) / 2;

  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    const rng = mulberry32(9000 + f * 77);
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext("2d");

    // REAL transparency — do NOT fill any background color
    ctx.clearRect(0, 0, SIZE, SIZE);

    const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2;
    const isGlitch = f % 5 === 0 || f % 7 === 3;
    const shakeX = isGlitch ? (rng() - 0.5) * 22 : Math.sin(t * Math.PI * 4) * 2;
    const shakeY = isGlitch ? (rng() - 0.5) * 8 : 0;

    ctx.drawImage(logo, baseX + shakeX, baseY + shakeY, dw, dh);
    if (pulse > 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = (pulse - 0.35) * 0.25;
      ctx.drawImage(logo, baseX + shakeX, baseY + shakeY, dw, dh);
      ctx.restore();
    }

    if (isGlitch) {
      const slices = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < slices; i++) {
        const sy = baseY + rng() * dh;
        const sh = 4 + rng() * 18;
        const shift = (rng() - 0.5) * 40;
        const srcY = ((sy - baseY) / dh) * logo.height;
        const srcH = Math.max(1, (sh / dh) * logo.height);
        ctx.drawImage(logo, 0, srcY, logo.width, srcH, baseX + shift, sy, dw, sh);
      }
    }

    // Mask flicker — only on logo area
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 14; i++) {
      const px = SIZE * 0.38 + rng() * SIZE * 0.24;
      const py = SIZE * 0.22 + rng() * SIZE * 0.14;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`;
      ctx.fillRect(px, py, 2 + rng() * 4, 2 + rng() * 4);
    }
    ctx.restore();

    // Force soft edges: any nearly-invisible pixel → fully transparent
    const frame = ctx.getImageData(0, 0, SIZE, SIZE);
    const p = frame.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 20) {
        p[i] = 0;
        p[i + 1] = 0;
        p[i + 2] = 0;
        p[i + 3] = 0;
      }
    }
    ctx.putImageData(frame, 0, 0);

    encoder.addFrame(ctx);
    process.stdout.write(`frame ${f + 1}/${FRAMES}\n`);
  }

  encoder.finish();
  fs.writeFileSync(OUT_GIF, encoder.out.getData());
  console.log("wrote", OUT_GIF, `${(fs.statSync(OUT_GIF).size / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
