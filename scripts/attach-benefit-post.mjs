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
await page.goto("https://app.rmz.gg/products/89437/edit", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

// Discover request payload by hooking fetch/XHR then clicking save after selecting benefit via DOM
const discover = await page.evaluate(async ({ BENEFIT_ID }) => {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  // Try POST update shapes
  const product = await (await fetch("https://app.rmz.gg/kebab/products/89437", { credentials: "include" })).json();
  const attempts = [];
  const bodies = [
    { id: product.id, name: product.name, price: product.price, type: product.type, status: product.status, description: product.description, benefits: [BENEFIT_ID] },
    { id: product.id, name: product.name, price: product.price, type: product.type, status: product.status, description: product.description, benefit_ids: [BENEFIT_ID] },
    { id: product.id, name: product.name, price: product.price, type: product.type, status: product.status, description: product.description, benefits: [{ id: BENEFIT_ID }] },
    // form-like
  ];
  for (const body of bodies) {
    const res = await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, {
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
    const again = await (await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, { credentials: "include" })).json();
    attempts.push({ status: res.status, preview: text.slice(0, 250), benefits: again.benefits });
  }

  // Also try _method PUT via POST
  for (const key of ["benefits", "benefit_ids"]) {
    const body = {
      _method: "PUT",
      id: product.id,
      name: product.name,
      price: product.price,
      type: product.type,
      status: product.status,
      description: product.description,
      [key]: [BENEFIT_ID],
    };
    const res = await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, {
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
    const again = await (await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, { credentials: "include" })).json();
    attempts.push({ status: res.status, method: "_method PUT "+key, preview: text.slice(0, 250), benefits: again.benefits });
  }

  // form-urlencoded style
  const form = new URLSearchParams();
  form.set("_method", "PUT");
  form.set("name", product.name);
  form.set("price", product.price);
  form.set("type", product.type);
  form.set("status", String(product.status));
  form.set("description", product.description || "");
  form.append("benefits[]", String(BENEFIT_ID));
  form.append("benefit_ids[]", String(BENEFIT_ID));
  const res2 = await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-CSRF-TOKEN": csrf || "",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: form.toString(),
  });
  const text2 = await res2.text();
  const again2 = await (await fetch(`https://app.rmz.gg/kebab/products/${product.id}`, { credentials: "include" })).json();
  attempts.push({ status: res2.status, method: "form", preview: text2.slice(0, 250), benefits: again2.benefits });

  return attempts;
}, { BENEFIT_ID });

console.log(JSON.stringify(discover, null, 2));

// UI approach with force click + network sniffer
page.on("request", (req) => {
  if (/kebab\/products|benefits/i.test(req.url()) && req.method() !== "GET") {
    console.log("REQ", req.method(), req.url(), (req.postData() || "").slice(0, 500));
  }
});

await page.goto("https://app.rmz.gg/products/89437/edit", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);
await page.getByText("اختر المزايا").first().click({ force: true }).catch(async () => {
  await page.locator("text=المزايا").last().click({ force: true });
});
await page.waitForTimeout(1000);
const opts = await page.locator(".ant-select-item-option, .ant-select-item").allTextContents();
console.log("UI opts", opts);
if (opts.some(o => o.includes("codeX Discord"))) {
  await page.locator(".ant-select-item-option, .ant-select-item").filter({ hasText: "codeX Discord" }).first().click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /تحديث المنتج/ }).click({ force: true });
  await page.waitForTimeout(3000);
}
const verify = await page.evaluate(async () => {
  const p = await (await fetch("https://app.rmz.gg/kebab/products/89437", { credentials: "include" })).json();
  const b = await (await fetch("https://app.rmz.gg/kebab/benefits", { credentials: "include" })).json();
  return { benefits: p.benefits, products_count: b.data?.[0]?.products_count };
});
console.log("VERIFY one", verify);
await browser.close();