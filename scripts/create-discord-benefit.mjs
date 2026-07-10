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
await page.waitForTimeout(1500);

await fill("#name", "codeX Discord");
await fill("#description", "انضم لسيرفر الدسكورد عشان تحصل على رتبة دخول للقنوات الخاصة، تنبيهات، والسحوبات");

await page.locator("#type").click({ force: true });
await page.waitForTimeout(500);
await page.locator(".ant-select-item-option").filter({ hasText: "دعوة لسيرفر دسكورد مع رولات" }).click();
await page.waitForTimeout(1500);

console.log("AFTER TYPE URL", page.url());
console.log("AFTER TYPE TEXT\n", await page.evaluate(() => document.body.innerText.slice(0, 3500)));
const fields = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll("input,textarea,select,button")].map(el => ({
    tag: el.tagName, type: el.type, id: el.id, text: (el.innerText||"").slice(0,40),
    ph: el.placeholder, val: (el.value||"").slice(0,40), role: el.getAttribute("role"),
    cls: (el.className||"").toString().slice(0,50)
  })).filter(x => x.id || x.ph || /ربط|دسكورد|Discord|سيرفر|رول|إنشاء|حفظ|connect|authorize/i.test(x.text+x.ph+x.val)),
  allLabels: [...document.querySelectorAll("label,h3,h4,.ant-form-item-label")].map(e => (e.innerText||"").trim()).filter(Boolean),
}));
console.log(JSON.stringify(fields, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-discord-benefit.png", fullPage: true });
await browser.close();