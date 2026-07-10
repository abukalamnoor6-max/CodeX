import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/store/design", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);
const areas = page.locator("textarea");
const count = await areas.count();
const vals = [];
for (let i = 0; i < count; i++) {
  const v = await areas.nth(i).inputValue();
  vals.push({ i, len: v.length, hasStar: v.includes("codex-starfield"), hasAudio: v.includes("welcome-codex-v3"), head: v.slice(0, 60) });
}
console.log(JSON.stringify(vals, null, 2));

// Fix store color to #0059db if white
const colorInput = page.locator('input[type="color"], input[value="#FFFFFF"], input[value="#ffffff"]').first();
if (await colorInput.count()) {
  await colorInput.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "#0059db");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  console.log("color set to #0059db");
} else {
  // try text inputs near color
  const textColor = page.locator('input').filter({ hasText: /#/ }).first();
  const allInputs = await page.locator('input').evaluateAll(els => els.map(e => ({type:e.type, value:e.value, name:e.name, id:e.id})).filter(x => /#|color|لون/i.test(JSON.stringify(x))));
  console.log("colorInputs", JSON.stringify(allInputs.slice(0,10)));
  for (const el of await page.locator('input').all()) {
    const v = await el.inputValue().catch(()=>"");
    if (/^#fff(fff)?$/i.test(v) || v === "#FFFFFF") {
      await el.fill("#0059db");
      await el.evaluate((node) => {
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      });
      console.log("fixed white color input");
    }
  }
}
await page.waitForTimeout(2000);
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-verify.png", fullPage: true });
await browser.close();
console.log("DONE");