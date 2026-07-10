import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();

async function fill(sel, val) {
  const el = page.locator(sel);
  await el.click({ clickCount: 3 });
  await el.fill(val);
  await el.evaluate((node, v) => {
    const proto = node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(node, v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, val);
}

await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /إنشاء ميزة|إنشاء أول ميزة/ }).first().click();
await page.waitForTimeout(1200);
await fill("#name", "codeX Discord");
await fill("#description", "انضم لسيرفر الدسكورد عشان تحصل على رتبة دخول للقنوات الخاصة، تنبيهات، والسحوبات");
await page.locator("#type").click({ force: true });
await page.waitForTimeout(400);
await page.locator(".ant-select-item-option").filter({ hasText: "دعوة لسيرفر دسكورد مع رولات" }).click();
await page.waitForTimeout(1000);

// Click connect Discord - may open popup
const popupPromise = browser.waitForEvent("page", { timeout: 15000 }).catch(() => null);
await page.getByRole("button", { name: /اختر سيرفر Discord وإضافة البوت/ }).click();
const popup = await popupPromise;
console.log("popup?", !!popup, popup?.url?.());

if (popup) {
  console.log("POPUP URL", popup.url());
  await popup.waitForLoadState("domcontentloaded").catch(()=>{});
  await popup.waitForTimeout(3000);
  console.log("POPUP TEXT", await popup.evaluate(() => document.body.innerText.slice(0,1500)).catch(()=> "no"));
  await popup.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-discord-oauth.png" }).catch(()=>{});
  console.log("WAITING_USER_OAUTH — authorize Discord in the opened window (up to 3 min)");
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    if (popup.isClosed()) { console.log("popup closed"); break; }
    const u = popup.url();
    console.log("oauth url", u);
    if (/app\.rmz\.gg|success|callback/i.test(u) && !/discord\.com|discordapp/i.test(u)) break;
    await popup.waitForTimeout(4000).catch(()=>{});
  }
}

await page.waitForTimeout(3000);
console.log("MAIN URL", page.url());
console.log("MAIN TEXT\n", await page.evaluate(() => document.body.innerText.slice(0, 3500)));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-after-oauth.png", fullPage: true });

// If server/role selectors appeared, fill them
const selects = await page.locator(".ant-select-selector").all();
console.log("selects count", selects.length);
for (let i = 0; i < selects.length; i++) {
  const near = await selects[i].evaluate(el => {
    let p = el;
    for (let k=0;k<6&&p;k++){ const t=(p.innerText||"").slice(0,120); if (/سيرفر|رول|role|server|Discord/i.test(t)) return t; p=p.parentElement; }
    return "";
  });
  console.log("select", i, near.replace(/\s+/g," ").slice(0,80));
}

await browser.close();