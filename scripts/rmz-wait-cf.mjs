import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
console.log("Waiting for Cloudflare/login... solve in the opened Chrome if needed");
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    cf: /just a moment|security verification|cloudflare/i.test(document.title + document.body.innerText),
    logged: /الرئيسية|المنتجات|إعدادات المتجر|codeX/.test(document.body.innerText),
  }));
  console.log("state", state);
  if (state.logged && !state.cf) break;
  await page.waitForTimeout(4000);
}
const sidebar = await page.evaluate(() =>
  [...document.querySelectorAll("a")].map(a => ({
    text: (a.innerText||"").replace(/\s+/g," ").trim(),
    href: a.href
  })).filter(x => x.href.includes("app.rmz.gg") && x.text).slice(0,100)
);
console.log("SIDEBAR", JSON.stringify(sidebar, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-after-cf.png", fullPage: true });
await browser.close();