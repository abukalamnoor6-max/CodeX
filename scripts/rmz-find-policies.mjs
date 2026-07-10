import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);
console.log("URL", page.url());
const text = await page.evaluate(() => document.body.innerText.slice(0, 2500));
console.log(text);
// click the return policy card if visible
const links = await page.locator("a,button,[role=button],div").evaluateAll(els =>
  els.filter(e => /استرجاع|شروط|أحكام|سياسة/i.test(e.innerText||"") && (e.innerText||"").length < 120)
    .slice(0, 20)
    .map(e => ({ tag: e.tagName, text: (e.innerText||"").replace(/\s+/g," ").trim().slice(0,100), href: e.href || "" }))
);
console.log("candidates", JSON.stringify(links, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-setup.png" });
await browser.close();