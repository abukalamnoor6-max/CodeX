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
    const product = await (await fetch(`https://app.rmz.gg/kebab/products/${id}`, { credentials: "include" })).json();
    const categoryIds = (product.categories || []).map(c => c.id);
    const body = {
      name: product.name,
      slug: product.slug,
      price: product.price,
      cost_price: product.cost_price,
      type: product.type,
      status: product.status,
      description: product.description,
      show_reviews: product.show_reviews,
      is_noticeable: product.is_noticeable,
      marketing_title: product.marketing_title,
      min_qty: product.min_qty,
      max_purchase_count: product.max_purchase_count,
      stock: product.stock,
      discount_price: product.discount_price,
      discount_expiry: product.discount_expiry,
      categories: categoryIds,
      category_ids: categoryIds,
      benefits: [BENEFIT_ID],
      benefit_ids: [BENEFIT_ID],
    };
    const res = await fetch(`https://app.rmz.gg/kebab/products/${id}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-TOKEN": csrf || "",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const again = await (await fetch(`https://app.rmz.gg/kebab/products/${id}`, { credentials: "include" })).json();
    results.push({
      id,
      name: product.name,
      status: res.status,
      preview: text.slice(0, 200),
      benefits: again.benefits,
    });
  }
  const benefit = await (await fetch("https://app.rmz.gg/kebab/benefits", { credentials: "include" })).json();
  return { results, products_count: benefit.data?.[0]?.products_count };
}, { PRODUCT_IDS, BENEFIT_ID });

console.log(JSON.stringify(out, null, 2));
await browser.close();