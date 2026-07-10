import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/products", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const data = await page.evaluate(async () => {
  const res = await fetch("https://app.rmz.gg/kebab/products?page=1", { credentials: "include" });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
});
console.log("products api", JSON.stringify(data, null, 2).slice(0, 5000));

const benefits = await page.evaluate(async () => {
  const urls = [
    "https://app.rmz.gg/kebab/benefits",
    "https://app.rmz.gg/kebab/benefits?page=1",
    "https://app.rmz.gg/api/benefits",
  ];
  const out = [];
  for (const u of urls) {
    try {
      const res = await fetch(u, { credentials: "include" });
      const text = await res.text();
      out.push({ u, status: res.status, text: text.slice(0, 2000) });
    } catch (e) {
      out.push({ u, err: e.message });
    }
  }
  return out;
});
console.log("benefits api", JSON.stringify(benefits, null, 2));
await browser.close();