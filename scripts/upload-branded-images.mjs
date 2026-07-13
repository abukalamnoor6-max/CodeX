import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = "C:/Users/Admin/Projects/codeX";
const IMG_DIR = path.join(ROOT, "public/products/subs");

const MAP = [
  { id: 89923, key: "boost-month" },
  { id: 89924, key: "boost-3m" },
  { id: 89925, key: "tokens" },
  { id: 89926, key: "dc-accounts" },
  { id: 89927, key: "nitro-year" },
  { id: 89928, key: "nitro-3m" },
  { id: 89929, key: "fivem-acc" },
  { id: 89930, key: "snap" },
  { id: 89931, key: "netflix" },
  { id: 89932, key: "shahid" },
  { id: 89933, key: "gemini" },
  { id: 89934, key: "yt-prem" },
];

const browser = await chromium.launchPersistentContext(
  path.join(ROOT, ".rmz-browser-profile"),
  { channel: "chrome", headless: true },
);
const page = browser.pages()[0] || (await browser.newPage());
await page.goto("https://app.rmz.gg/products", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForTimeout(2500);

const imagesB64 = Object.fromEntries(
  MAP.map((m) => [
    m.key,
    fs.readFileSync(path.join(IMG_DIR, m.key + ".jpg")).toString("base64"),
  ]),
);

const result = await page.evaluate(
  async ({ MAP, imagesB64 }) => {
    await fetch("https://app.rmz.gg/sanctum/csrf-cookie", {
      credentials: "include",
    });
    const csrf = decodeURIComponent(
      document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] || "",
    );
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": csrf,
    };

    async function upload(b64, filename) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("file", blob, filename);
      const r = await fetch(
        "https://app.rmz.gg/kebab/products/upload?type=image",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": csrf,
          },
          body: fd,
        },
      );
      return await r.json();
    }

    const out = [];
    for (const item of MAP) {
      const full = await (
        await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
          credentials: "include",
          headers,
        })
      ).json();
      const p = full.product || full;
      const up = await upload(imagesB64[item.key], item.key + ".jpg");

      const payload = {
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        type: p.type,
        price: p.price,
        cost_price: p.cost_price ?? 0,
        status: p.status ?? 1,
        show_reviews: p.show_reviews ?? 1,
        fields: p.fields || [],
        categories: (p.categories || []).map((c) => c.id),
        category_ids: (p.categories || []).map((c) => c.id),
        image: {
          file: {
            uid: "rc-upload-" + Date.now(),
            name: up.name,
            status: "done",
            response: up,
            xhr: {},
            originFileObj: {},
          },
          fileList: [
            {
              uid: "rc-upload-" + Date.now(),
              name: up.name,
              status: "done",
              response: up,
            },
          ],
        },
      };

      const r = await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });
      const t = await r.text();
      const check = await (
        await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
          credentials: "include",
          headers,
        })
      ).json();
      const prod = check.product || check;
      out.push({
        id: item.id,
        name: p.name,
        status: r.status,
        image: prod.image?.full_link || prod.image?.name,
        err: r.status >= 400 ? t.slice(0, 180) : null,
      });
    }
    return out;
  },
  { MAP, imagesB64 },
);

console.log(JSON.stringify(result, null, 2));
await browser.close();
