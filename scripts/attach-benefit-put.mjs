import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const PRODUCT_IDS = [89437,89436,89434,89433,89432,89431,89430,89429,89428,89427,89426];
const BENEFIT_ID = 634;

const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/products", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);

const out = await page.evaluate(async ({ PRODUCT_IDS, BENEFIT_ID }) => {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const results = [];

  for (const id of PRODUCT_IDS) {
    const getRes = await fetch(`https://app.rmz.gg/kebab/products/${id}`, { credentials: "include" });
    const product = await getRes.json();

    // Try several payload shapes
    const payloads = [
      { ...product, benefit_ids: [BENEFIT_ID], benefits: [BENEFIT_ID] },
      {
        name: product.name,
        price: product.price,
        type: product.type,
        status: product.status,
        description: product.description,
        benefit_ids: [BENEFIT_ID],
      },
      {
        name: product.name,
        price: product.price,
        type: product.type,
        status: product.status,
        description: product.description,
        benefits: [{ id: BENEFIT_ID }],
      },
      {
        name: product.name,
        price: product.price,
        type: product.type,
        status: product.status,
        description: product.description,
        benefits: [BENEFIT_ID],
      },
    ];

    let done = false;
    for (const body of payloads) {
      // strip heavy nested objects that break updates
      const clean = { ...body };
      delete clean.image;
      delete clean.product;
      delete clean.product_files;
      delete clean.extra_images;
      delete clean.codes;
      delete clean.course;
      delete clean.subscription_variants;
      delete clean.seo_meta;
      delete clean.seo;
      delete clean.categories;

      const res = await fetch(`https://app.rmz.gg/kebab/products/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-TOKEN": csrf || "",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(clean),
      });
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        // verify
        const again = await (await fetch(`https://app.rmz.gg/kebab/products/${id}`, { credentials: "include" })).json();
        const attached = Array.isArray(again.benefits) && again.benefits.some(b => (b.id || b) === BENEFIT_ID || b.name?.includes?.("codeX"));
        results.push({ id, status: res.status, attached, benefits: again.benefits, preview: text.slice(0, 120) });
        done = true;
        break;
      } else {
        results.push({ id, status: res.status, preview: text.slice(0, 180), tried: Object.keys(clean).includes("benefit_ids") ? "benefit_ids" : "benefits" });
      }
    }
    if (!done) results.push({ id, failed: true });
  }

  const benefit = await (await fetch("https://app.rmz.gg/kebab/benefits", { credentials: "include" })).json();
  return { results, benefit: benefit.data?.[0] };
}, { PRODUCT_IDS, BENEFIT_ID });

console.log(JSON.stringify(out, null, 2));
await browser.close();