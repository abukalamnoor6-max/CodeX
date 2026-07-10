import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false, channel: "chrome", viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/store/settings", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
// click التنبيهات
await page.getByText("التنبيهات", { exact: true }).first().click().catch(()=>{});
await page.waitForTimeout(2000);
console.log("URL", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2500));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-notifications.png", fullPage: true });
await browser.close();