import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/pages", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3500);
console.log("URL", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));
const btns = await page.locator("a,button").evaluateAll(els =>
  els.map(e => ({ tag: e.tagName, text: (e.innerText||"").replace(/\s+/g," ").trim().slice(0,80), href: e.href||"" }))
    .filter(x => x.text && /إضافة|انشاء|إنشاء|صفحة|جديد|Create|Add|policy|سياسة|شروط|استرجاع/i.test(x.text))
    .slice(0, 30)
);
console.log("btns", JSON.stringify(btns, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-pages.png", fullPage: true });
await browser.close();