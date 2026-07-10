import { chromium } from "playwright";
const userData = process.env.TEMP + "/codex-rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://codexshop112.rmz.gg/?v=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const canvas = document.getElementById("codex-starfield");
  const z = canvas ? getComputedStyle(canvas).zIndex : null;
  const products = document.querySelectorAll('[class*="product"], [class*="Product"], a[href*="/product"], img').length;
  const text = document.body.innerText.slice(0, 500);
  return { z, products, hasCanvas: !!canvas, text };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-storefront-check.png", fullPage: false });
await browser.close();