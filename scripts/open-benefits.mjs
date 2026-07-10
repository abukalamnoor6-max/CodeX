import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

// Get full sidebar text
const side = await page.evaluate(() => {
  const texts = [...document.querySelectorAll("aside a, nav a, [class*=sider] a, [class*=menu] a, .ant-menu-item, .ant-menu-submenu-title")]
    .map(el => ({
      text: (el.innerText||"").replace(/\s+/g," ").trim(),
      href: el.href || el.querySelector?.("a")?.href || ""
    }))
    .filter(x => x.text);
  return texts;
});
console.log("MENU", JSON.stringify(side, null, 2));

await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);
const b = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText.slice(0, 2500),
  buttons: [...document.querySelectorAll("button,a")].map(e => (e.innerText||"").replace(/\s+/g," ").trim()).filter(t => t && t.length < 60).slice(0,40)
}));
console.log("BENEFITS", JSON.stringify(b, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-benefits.png", fullPage: true });

// Also try clicking المزايا in sidebar if present
await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll("a,span,div")].find(e => (e.innerText||"").trim() === "المزايا");
  if (el) { (el.closest("a") || el).click(); return true; }
  return false;
});
console.log("clicked المزايا", clicked);
await page.waitForTimeout(2500);
console.log("after click", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0,1500));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-benefits2.png", fullPage: true });
await browser.close();