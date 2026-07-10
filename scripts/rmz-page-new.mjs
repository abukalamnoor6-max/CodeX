import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://app.rmz.gg/pages", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /صفحة جديدة/ }).click();
await page.waitForTimeout(2500);
console.log("URL", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2500));
const fields = await page.evaluate(() => {
  return {
    inputs: [...document.querySelectorAll("input,textarea,select")].map(el => ({
      tag: el.tagName, type: el.type, name: el.name, id: el.id,
      ph: el.placeholder, role: el.getAttribute("role"),
      aria: el.getAttribute("aria-label"),
      cls: (el.className||"").toString().slice(0,60),
      val: (el.value||"").slice(0,40),
    })),
    labels: [...document.querySelectorAll("label,.ant-form-item-label,h1,h2,h3")].map(el => (el.innerText||"").trim()).filter(Boolean).slice(0,40),
    contentEditable: [...document.querySelectorAll("[contenteditable=true],.ql-editor,.ProseMirror,.tiptap")].map(el => ({
      cls: (el.className||"").toString().slice(0,80),
      role: el.getAttribute("role"),
    })),
  };
});
console.log(JSON.stringify(fields, null, 2));
await page.screenshot({ path: "C:/Users/Admin/Projects/codeX/public/rmz-page-new.png", fullPage: true });
await browser.close();