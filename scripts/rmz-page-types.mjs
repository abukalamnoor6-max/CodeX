import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/pages", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /صفحة جديدة/ }).click();
await page.waitForTimeout(1500);

// open type dropdown
await page.locator("#createCategory_type").click({ force: true });
await page.waitForTimeout(800);
const options = await page.locator(".ant-select-item-option, .ant-select-item").evaluateAll(els =>
  els.map(e => (e.innerText||"").trim()).filter(Boolean)
);
console.log("type options", options);

// also check status switch
const switches = await page.locator(".ant-switch, input[type=checkbox]").evaluateAll(els =>
  els.map(e => ({ cls: e.className, checked: e.getAttribute("aria-checked") || e.checked, role: e.getAttribute("role") }))
);
console.log("switches", switches);
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-page-types.png" });
await browser.close();