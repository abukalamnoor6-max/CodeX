import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
const nav = await page.evaluate(() => {
  const links = [...document.querySelectorAll("a,button")].map(e => ({
    text: (e.innerText||"").replace(/\s+/g," ").trim(),
    href: e.href || ""
  })).filter(x => x.text && /مزاي|discord|دسكورد|رتب|تكامل|integrations|اشتراك|عملاء/i.test(x.text)).slice(0,40);
  return { url: location.href, links, bodyHas: /المزايا|ربط Discord|Discord/.test(document.body.innerText) };
});
console.log(JSON.stringify(nav, null, 2));

// Try storefront account/benefits pages
for (const url of [
  "https://codexshop112.rmz.gg/",
  "https://codexshop112.rmz.gg/account",
  "https://codexshop112.rmz.gg/benefits",
  "https://codexshop112.rmz.gg/me",
  "https://app.rmz.gg/benefits",
  "https://app.rmz.gg/store/settings",
]) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const t = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      hasBenefits: /مزايا|benefits|ربط Discord/i.test(document.body.innerText),
      snippet: document.body.innerText.slice(0, 400).replace(/\s+/g," ")
    }));
    console.log("---", JSON.stringify(t));
  } catch (e) {
    console.log("fail", url, e.message);
  }
}
await browser.close();