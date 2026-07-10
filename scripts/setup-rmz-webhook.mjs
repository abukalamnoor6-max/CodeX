import { chromium } from "playwright";
import fs from "fs";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const webhook = fs.readFileSync("C:/Users/Admin/Projects/codeX/discord/orders-webhook.url", "utf8").trim();

const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();

const candidates = [
  "https://app.rmz.gg/store/settings",
  "https://app.rmz.gg/store/webhooks",
  "https://app.rmz.gg/webhooks",
  "https://app.rmz.gg/store/notifications",
];

for (const url of candidates) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => ({
    url: location.href,
    text: document.body.innerText.slice(0, 1200),
    hasWebhook: /webhook|ويب\s*هوك|إشعار/i.test(document.body.innerText),
  }));
  console.log("TRY", info.url, "hasWebhook=", info.hasWebhook);
  if (info.hasWebhook) {
    console.log(info.text.slice(0, 800));
    break;
  }
}

// Look in store settings sidebar for webhooks
await page.goto("https://app.rmz.gg/store/settings", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
const links = await page.evaluate(() =>
  [...document.querySelectorAll("a,button")].map(e => ({
    text: (e.innerText||"").replace(/\s+/g," ").trim(),
    href: e.href || ""
  })).filter(x => /ويب|webhook|إشعار|notification|تكامل/i.test(x.text+" "+x.href)).slice(0,30)
);
console.log("links", JSON.stringify(links, null, 2));

// Try API create webhook
const api = await page.evaluate(async (webhook) => {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const tries = [];
  const urls = [
    "https://app.rmz.gg/kebab/webhooks",
    "https://app.rmz.gg/kebab/store/webhooks",
    "https://app.rmz.gg/kebab/notifications/webhooks",
  ];
  for (const u of urls) {
    try {
      const get = await fetch(u, { credentials: "include", headers: { Accept: "application/json" } });
      tries.push({ u, method: "GET", status: get.status, text: (await get.text()).slice(0, 400) });
    } catch (e) {
      tries.push({ u, err: e.message });
    }
  }
  // create attempt
  for (const u of ["https://app.rmz.gg/kebab/webhooks"]) {
    const res = await fetch(u, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-TOKEN": csrf || "",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        name: "codeX Orders Discord",
        url: webhook,
        event: "order.created",
        events: ["order.created", "order.status_changed"],
        enabled: true,
        active: true,
      }),
    });
    tries.push({ u, method: "POST", status: res.status, text: (await res.text()).slice(0, 500) });
  }
  return tries;
}, webhook);
console.log("API", JSON.stringify(api, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-webhooks.png", fullPage: true });
await browser.close();