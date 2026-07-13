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
  { channel: "chrome", headless: true, viewport: { width: 1400, height: 900 } },
);
const page = browser.pages()[0] || (await browser.newPage());
await page.goto("https://app.rmz.gg/products", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForTimeout(2000);

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
      const before = p.image?.id;
      const up = await upload(imagesB64[item.key], "codex-" + item.key + ".jpg");

      // full product update with image like create payload
      const payload = {
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        type: p.type || "service",
        price: Number(p.price),
        cost_price: Number(p.cost_price ?? 0),
        status: p.status ?? 1,
        show_reviews: p.show_reviews ?? 1,
        min_qty: p.min_qty ?? 1,
        fields: p.fields || [],
        categories: (p.categories || []).map((c) => c.id),
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

      let r = await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });
      let t = await r.text();

      // fallback: attach media id endpoints
      if (r.status >= 400 || true) {
        const alts = [
          {
            url: `/kebab/products/${item.id}`,
            body: {
              ...payload,
              image: {
                file: {
                  uid: "x",
                  name: up.name,
                  status: "done",
                  response: up,
                },
              },
            },
          },
        ];
        // also try syncing media
        const sync = await fetch(
          `https://app.rmz.gg/kebab/products/${item.id}/sync-media`,
          {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ image_id: up.id, media_id: up.id }),
          },
        );
        const syncT = await sync.text();

        // try POST image only with required fields
        const r2 = await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            name: p.name,
            slug: p.slug,
            description: p.description || "<p></p>",
            type: p.type || "service",
            price: Number(p.price),
            cost_price: Number(p.cost_price ?? 0),
            status: p.status ?? 1,
            show_reviews: 1,
            fields: p.fields || [],
            categories: (p.categories || []).map((c) => c.id),
            image: {
              file: {
                uid: "rc-upload-1",
                name: up.name,
                status: "done",
                response: up,
                xhr: {},
                originFileObj: {},
              },
              fileList: [
                {
                  uid: "rc-upload-1",
                  name: up.name,
                  status: "done",
                  response: up,
                },
              ],
            },
          }),
        });
        t = await r2.text();
        r = r2;

        out.push({
          id: item.id,
          name: p.name,
          upId: up.id,
          before,
          status: r.status,
          sync: { status: sync.status, t: syncT.slice(0, 80) },
          t: t.slice(0, 100),
        });
      }

      const check = await (
        await fetch("https://app.rmz.gg/kebab/products/" + item.id, {
          credentials: "include",
          headers,
        })
      ).json();
      const prod = check.product || check;
      out[out.length - 1].after = prod.image?.id;
      out[out.length - 1].link = prod.image?.full_link;
      out[out.length - 1].changed = prod.image?.id !== before;
    }
    return out;
  },
  { MAP, imagesB64 },
);

console.log(JSON.stringify(result, null, 2));

// If API failed to change, use UI file inputs
const needUi = result.filter((r) => !r.changed);
console.log("needUi", needUi.length);

for (const item of needUi) {
  const filePath = path.join(IMG_DIR, item.key ? MAP.find((m) => m.id === item.id).key + ".jpg" : "");
}
// rebuild need list with keys
for (const m of MAP) {
  const row = result.find((r) => r.id === m.id);
  if (row?.changed) continue;

  await page.goto(`https://app.rmz.gg/products/${m.id}/edit`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2500);

  const fileInput = page.locator("#CreateForm_image, input[type='file']").first();
  await fileInput.setInputFiles(path.join(IMG_DIR, m.key + ".jpg"));
  await page.waitForTimeout(2500);

  // trigger react update if needed
  await page.evaluate(() => {
    const input = document.querySelector("#CreateForm_image, input[type='file']");
    if (!input) return;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  const btn = page.locator("button.ant-btn-primary").filter({ hasText: /حفظ|تحديث|تعديل/ });
  if (await btn.count()) await btn.first().click();
  else await page.getByRole("button", { name: /حفظ|تحديث/ }).first().click();
  await page.waitForTimeout(3500);
  console.log("UI saved", m.id, m.key, page.url());
}

// final verify
const verify = await page.evaluate(async (ids) => {
  const csrf = decodeURIComponent(
    document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] || "",
  );
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-XSRF-TOKEN": csrf,
  };
  const rows = [];
  for (const id of ids) {
    const j = await (
      await fetch("https://app.rmz.gg/kebab/products/" + id, {
        credentials: "include",
        headers,
      })
    ).json();
    const p = j.product || j;
    rows.push({
      id,
      name: p.name,
      image: p.image?.name,
      link: p.image?.full_link,
    });
  }
  return rows;
}, MAP.map((m) => m.id));

console.log("VERIFY", JSON.stringify(verify, null, 2));
await browser.close();
