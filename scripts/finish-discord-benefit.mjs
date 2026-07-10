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

// If already connected from previous attempt, create new benefit again
await page.getByRole("button", { name: /إنشاء ميزة|إنشاء أول ميزة/ }).first().click();
await page.waitForTimeout(1200);
await fill("#name", "codeX Discord");
await fill("#description", "انضم لسيرفر الدسكورد عشان تحصل على رتبة دخول للقنوات الخاصة، تنبيهات، والسحوبات");
await page.locator("#type").click({ force: true });
await page.waitForTimeout(400);
await page.locator(".ant-select-item-option").filter({ hasText: "دعوة لسيرفر دسكورد مع رولات" }).click();
await page.waitForTimeout(2000);

// If connect button still there, click it (should already be connected)
const connectBtn = page.getByRole("button", { name: /اختر سيرفر Discord وإضافة البوت/ });
if (await connectBtn.count()) {
  console.log("still needs connect - unexpected");
}

// Refresh roles
const refresh = page.getByRole("button", { name: /تحديث الرولات/ });
if (await refresh.count()) {
  await refresh.click();
  await page.waitForTimeout(2000);
  console.log("refreshed roles");
}

// Open roles select - find the one near الرولات الممنوحة
const roleSelect = page.locator(".ant-select").filter({ hasText: /اختر الرولات|الرولات/ }).first();
// fallback: third select / any select with multiple
let opened = false;
const selectors = page.locator(".ant-select-selector");
const count = await selectors.count();
console.log("selectors", count);
for (let i = 0; i < count; i++) {
  const txt = await selectors.nth(i).innerText().catch(()=>"");
  console.log("sel", i, txt.slice(0,60));
  if (/اختر الرولات|الرولات الممنوحة|Select/i.test(txt) || i === count - 2) {
    await selectors.nth(i).click();
    opened = true;
    await page.waitForTimeout(800);
    break;
  }
}
if (!opened && count > 0) {
  // try clicking near label
  await page.getByText("الرولات الممنوحة").click().catch(()=>{});
  await page.waitForTimeout(500);
  await selectors.nth(Math.min(1, count-1)).click();
  await page.waitForTimeout(800);
}

const opts = await page.locator(".ant-select-item-option").allTextContents();
console.log("role options", opts);

// Prefer Customer role
const prefer = opts.find(o => /Customer|زبون|عميل/i.test(o)) || opts.find(o => /Member|عضو/i.test(o)) || opts[0];
if (prefer) {
  await page.locator(".ant-select-item-option").filter({ hasText: prefer }).first().click();
  console.log("selected role", prefer);
  await page.waitForTimeout(500);
} else {
  console.log("NO_ROLES");
}

// Close dropdown by clicking name field
await page.locator("#name").click().catch(()=>{});
await page.waitForTimeout(400);

// Duration: leave empty / permanent if possible
const dur = page.locator("#expires_after_days");
if (await dur.count()) {
  await dur.click({ force: true }).catch(()=>{});
  await page.waitForTimeout(400);
  const dopts = await page.locator(".ant-select-item-option").allTextContents();
  console.log("duration opts", dopts);
  const forever = dopts.find(o => /بدون|دائم|لا يوجد|Never|permanent|∞|غير محدد/i.test(o));
  if (forever) {
    await page.locator(".ant-select-item-option").filter({ hasText: forever }).click();
    console.log("duration", forever);
  } else {
    await page.keyboard.press("Escape");
  }
}

await page.getByRole("button", { name: /^إنشاء$/ }).click();
await page.waitForTimeout(3000);
console.log("AFTER CREATE", page.url());
console.log(await page.evaluate(() => document.body.innerText.slice(0, 2000)));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-benefit-created.png", fullPage: true });

// List benefits
await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
console.log("LIST\n", await page.evaluate(() => document.body.innerText.slice(0, 2000)));
await browser.close();