import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/products", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);

// Click first product name/link
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("tr")].map(tr => ({
    text: tr.innerText.replace(/\s+/g," ").trim().slice(0,120),
    hrefs: [...tr.querySelectorAll("a")].map(a => a.href),
    buttons: [...tr.querySelectorAll("button,[role=button],.anticon")].map(b => b.className)
  }));
  return rows.slice(0,15);
});
console.log(JSON.stringify(info, null, 2));

// Try clicking product title cell
await page.locator("table tbody tr").first().locator("td").nth(1).click().catch(()=>{});
await page.waitForTimeout(2000);
console.log("after row click", page.url());

// Try dropdown actions
const more = page.locator("table tbody tr").first().locator("button").last();
if (await more.count()) {
  await more.click();
  await page.waitForTimeout(800);
  const menu = await page.evaluate(() => document.body.innerText.slice(0,1500));
  console.log("menu\n", menu);
  await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-product-menu.png" });
}

// intercept network for product ids
const products = await page.evaluate(async () => {
  // try common API endpoints from window
  return {
    location: location.href,
    htmlHasId: !!document.body.innerHTML.match(/products\/\d+/),
    matches: [...document.body.innerHTML.matchAll(/\/products\/(\d+)/g)].map(m=>m[1]).slice(0,20)
  };
});
console.log("ids", products);

// Capture XHR
const apis = [];
page.on("response", async (res) => {
  if (/product|benefit/i.test(res.url()) && res.status() === 200) {
    apis.push(res.url());
  }
});
await page.reload({ waitUntil: "networkidle" }).catch(()=>{});
await page.waitForTimeout(3000);
console.log("apis", [...new Set(apis)].slice(0,30));

await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
// click edit icon on benefit
await page.locator("table tbody tr").first().locator("button, a, .anticon-edit, .anticon-more").first().click().catch(()=>{});
await page.waitForTimeout(1500);
console.log("benefit after", page.url());
console.log(await page.evaluate(() => document.body.innerText.slice(0,2000)));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-benefit-row.png", fullPage: true });
await browser.close();