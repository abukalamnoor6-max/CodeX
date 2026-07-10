import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/products/89437/edit", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3500);
console.log("URL", page.url());
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 3500));
const hasBenefit = /مزاي|benefit|دسكورد|Discord/i.test(text);
console.log("hasBenefitMention", hasBenefit);
const labels = await page.evaluate(() =>
  [...document.querySelectorAll("label,h2,h3,.ant-form-item-label, .ant-tabs-tab")].map(e => (e.innerText||"").trim()).filter(Boolean).slice(0,80)
);
console.log("labels", labels);
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-product-89437.png", fullPage: true });

// Also GET benefit products endpoint and product full json keys
const api = await page.evaluate(async () => {
  const p = await (await fetch("https://app.rmz.gg/kebab/products/89437", { credentials:"include" })).json();
  const bp = await (await fetch("https://app.rmz.gg/kebab/benefits/634/products", { credentials:"include" })).text();
  return { productKeys: Object.keys(p), benefitRelated: Object.keys(p).filter(k=>/benefit|discord|grant/i.test(k)), pBenefits: p.benefits || p.benefit_ids || p.product_benefits, bp: bp.slice(0,1000) };
});
console.log(JSON.stringify(api, null, 2));
await browser.close();