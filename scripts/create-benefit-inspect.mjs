import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /إنشاء ميزة|إنشاء أول ميزة/ }).first().click();
await page.waitForTimeout(2500);
console.log("URL", page.url());
console.log("TEXT\n", await page.evaluate(() => document.body.innerText.slice(0, 3000)));
const fields = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll("input,textarea,select")].map(el => ({
    tag: el.tagName, type: el.type, id: el.id, name: el.name,
    ph: el.placeholder, role: el.getAttribute("role"),
    val: (el.value||"").slice(0,40),
    aria: el.getAttribute("aria-label"),
  })),
  labels: [...document.querySelectorAll("label,h1,h2,h3,.ant-form-item-label")].map(e => (e.innerText||"").trim()).filter(Boolean).slice(0,50),
  options: [...document.querySelectorAll(".ant-select-item-option,.ant-radio-wrapper")].map(e => (e.innerText||"").trim()).filter(Boolean),
}));
console.log(JSON.stringify(fields, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-create-benefit.png", fullPage: true });

// Try open type dropdown if exists
const typeInput = page.locator("#createBenefit_type, [id*=type], .ant-select-selector").first();
if (await typeInput.count()) {
  await typeInput.click().catch(()=>{});
  await page.waitForTimeout(800);
  const opts = await page.locator(".ant-select-item-option").allTextContents();
  console.log("type opts", opts);
}
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-create-benefit2.png", fullPage: true });
await browser.close();