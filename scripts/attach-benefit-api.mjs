import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  // get all product ids
  const prodRes = await fetch("https://app.rmz.gg/kebab/products?page=1", { credentials: "include" });
  const prodJson = await prodRes.json();
  let products = prodJson.products?.data || prodJson.data || [];
  // page 2 if needed
  if (prodJson.products?.last_page > 1) {
    const p2 = await fetch("https://app.rmz.gg/kebab/products?page=2", { credentials: "include" });
    const j2 = await p2.json();
    products = products.concat(j2.products?.data || []);
  }
  const ids = products.map(p => p.id);
  const benefitId = 634;

  // Probe endpoints
  const probes = [];
  const attempts = [
    { method: "PUT", url: `https://app.rmz.gg/kebab/benefits/${benefitId}`, body: { product_ids: ids } },
    { method: "PATCH", url: `https://app.rmz.gg/kebab/benefits/${benefitId}`, body: { product_ids: ids } },
    { method: "POST", url: `https://app.rmz.gg/kebab/benefits/${benefitId}/products`, body: { product_ids: ids } },
    { method: "POST", url: `https://app.rmz.gg/kebab/benefits/${benefitId}/attach-products`, body: { products: ids } },
    { method: "PUT", url: `https://app.rmz.gg/kebab/benefits/${benefitId}`, body: { products: ids } },
    { method: "GET", url: `https://app.rmz.gg/kebab/benefits/${benefitId}` },
  ];

  for (const a of attempts) {
    try {
      const res = await fetch(a.url, {
        method: a.method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-CSRF-TOKEN": csrf || "",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      const text = await res.text();
      probes.push({ method: a.method, url: a.url, status: res.status, text: text.slice(0, 500) });
    } catch (e) {
      probes.push({ method: a.method, url: a.url, err: e.message });
    }
  }

  // Also open product edit page HTML for benefit fields
  const firstId = ids[0];
  const editUrls = [
    `https://app.rmz.gg/products/${firstId}/edit`,
    `https://app.rmz.gg/products/edit/${firstId}`,
    `https://app.rmz.gg/kebab/products/${firstId}`,
  ];
  const edits = [];
  for (const u of editUrls) {
    const res = await fetch(u, { credentials: "include", headers: { Accept: "application/json" } });
    const text = await res.text();
    edits.push({ u, status: res.status, text: text.slice(0, 800) });
  }

  return { ids, csrf: !!csrf, probes, edits };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();