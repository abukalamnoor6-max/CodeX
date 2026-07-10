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

// Click the benefit row / edit
const clicked = await page.evaluate(() => {
  const row = [...document.querySelectorAll("tr,a,div")].find(e => (e.innerText||"").includes("codeX Discord") && (e.innerText||"").length < 300);
  if (!row) return false;
  (row.querySelector("a") || row).click();
  return true;
});
console.log("clicked benefit", clicked);
await page.waitForTimeout(2500);
console.log("URL", page.url());
console.log(await page.evaluate(() => document.body.innerText.slice(0, 2500)));

// Look for edit / products attach UI
const actions = await page.evaluate(() =>
  [...document.querySelectorAll("button,a")].map(e => (e.innerText||"").replace(/\s+/g," ").trim())
    .filter(t => t && /تعديل|منتج|ربط|حفظ|Edit|product|attach/i.test(t)).slice(0,30)
);
console.log("actions", actions);
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-benefit-detail.png", fullPage: true });

// Try products page attach from product edit
await page.goto("https://app.rmz.gg/products", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
console.log("PRODUCTS\n", await page.evaluate(() => document.body.innerText.slice(0, 2000)));
const productLinks = await page.evaluate(() =>
  [...document.querySelectorAll("a")].map(a => ({text:(a.innerText||"").trim(), href:a.href}))
    .filter(x => /products\/\d+|\/products\/edit|تعديل/.test(x.href+" "+x.text)).slice(0,20)
);
console.log("productLinks", productLinks);

// Open first product edit if possible
const editBtns = page.locator("a,button").filter({ hasText: /تعديل/ });
const n = await editBtns.count();
console.log("edit buttons", n);
if (n > 0) {
  await editBtns.first().click();
  await page.waitForTimeout(2500);
  console.log("edit url", page.url());
  console.log(await page.evaluate(() => document.body.innerText.slice(0, 2500)));
  await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-product-edit-benefit.png", fullPage: true });
}
await browser.close();