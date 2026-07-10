import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();

async function dump(label) {
  const info = await page.evaluate(() => {
    const links = [...document.querySelectorAll("a")].map(a => ({
      text: (a.innerText||"").replace(/\s+/g," ").trim().slice(0,80),
      href: a.href
    })).filter(x => x.text || x.href.includes("rmz.gg"));
    const unique = [];
    const seen = new Set();
    for (const l of links) {
      const k = l.href + "|" + l.text;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(l);
    }
    return {
      url: location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 2000),
      nav: unique.filter(l => /مزاي|benefit|discord|تكامل|integration|اشتراك|عملاء|إعداد|store|feature|رتب|webhook|ربط/i.test(l.text+" "+l.href)).slice(0,50),
      allSidebar: unique.filter(l => l.href.includes("app.rmz.gg")).slice(0,80),
    };
  });
  console.log("\n====", label, "====");
  console.log("URL", info.url);
  console.log("NAV", JSON.stringify(info.nav, null, 2));
  console.log("TEXT\n", info.text.slice(0,1200));
  return info;
}

await page.goto("https://app.rmz.gg/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(4000);
await dump("home");

// click sidebar items that might relate
const candidates = [
  "https://app.rmz.gg/benefits",
  "https://app.rmz.gg/features",
  "https://app.rmz.gg/subscriptions",
  "https://app.rmz.gg/customers",
  "https://app.rmz.gg/store/settings",
  "https://app.rmz.gg/store/integrations",
  "https://app.rmz.gg/integrations",
  "https://app.rmz.gg/discord",
  "https://app.rmz.gg/settings",
  "https://app.rmz.gg/store/discord",
];
for (const url of candidates) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const t = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    has: /مزاي|benefit|Discord|ربط|تكامل/i.test(document.body.innerText),
    h1: document.querySelector("h1,h2")?.innerText,
    snippet: document.body.innerText.slice(0,500).replace(/\s+/g," "),
  }));
  console.log("TRY", JSON.stringify(t));
}

await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-home-nav.png", fullPage: true });
await browser.close();