import { chromium } from "playwright";
import fs from "fs";

const css = fs.readFileSync(
  "C:/Users/Admin/Projects/codeX/public/rmz-custom-css.css",
  "utf8",
);
const js = fs.readFileSync(
  "C:/Users/Admin/Projects/codeX/public/rmz-custom-js.js",
  "utf8",
);
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";

const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = browser.pages()[0] || (await browser.newPage());

await page.goto("https://app.rmz.gg/store/design", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});

const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  const url = page.url();
  const count = await page.locator("textarea").count();
  console.log("wait", url, "textareas", count);
  if (url.includes("/store/design") && count >= 2) break;
  if (
    url.includes("app.rmz.gg") &&
    !url.includes("login") &&
    !url.includes("/store/design")
  ) {
    await page.goto("https://app.rmz.gg/store/design", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
  }
  await page.waitForTimeout(2000);
}

const areas = page.locator("textarea");
const count = await areas.count();
let cssIdx = 1;
let jsIdx = 0;
for (let i = 0; i < count; i++) {
  const near = await areas.nth(i).evaluate((node) => {
    let p = node;
    for (let k = 0; k < 8 && p; k++) {
      const t = (p.innerText || p.textContent || "").slice(0, 300);
      if (/Custom CSS/i.test(t)) return "css";
      if (/Custom JS/i.test(t)) return "js";
      p = p.parentElement;
    }
    return "";
  });
  if (near === "css") cssIdx = i;
  if (near === "js") jsIdx = i;
}
console.log("indices", { cssIdx, jsIdx });

async function setArea(idx, value) {
  const el = areas.nth(idx);
  await el.scrollIntoViewIfNeeded();
  await el.click({ clickCount: 3 });
  await el.fill("");
  await el.fill(value);
  await el.evaluate((node, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    setter.call(node, v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

await setArea(cssIdx, css);
await setArea(jsIdx, js);
await page.keyboard.press("Tab");
await page.waitForTimeout(2500);

const cssVal = await areas.nth(cssIdx).inputValue();
const jsVal = await areas.nth(jsIdx).inputValue();
const ok =
  cssVal.includes("isolation: isolate") &&
  jsVal.includes("appendChild(canvas)") &&
  jsVal.includes('setProperty("z-index", "-1"');
console.log({
  cssOk: cssVal.includes("isolation: isolate"),
  jsOk: jsVal.includes("appendChild(canvas)"),
  jsZ: jsVal.includes('setProperty("z-index", "-1"'),
});
console.log(ok ? "SUCCESS" : "PARTIAL");

const store = await browser.newPage();
await store.goto("https://codexshop112.rmz.gg/?fixgap=" + Date.now(), {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await store.waitForTimeout(4500);
const info = await store.evaluate(() => {
  const canvas = document.getElementById("codex-starfield");
  const header =
    document.querySelector("header") ||
    document.querySelector("nav") ||
    document.querySelector('[class*="header"]') ||
    document.querySelector(".sticky");
  const headerTop = header ? header.getBoundingClientRect().top : null;
  const canvasBox = canvas ? canvas.getBoundingClientRect() : null;
  const cs = canvas ? getComputedStyle(canvas) : null;
  return {
    hasCanvas: !!canvas,
    canvasPos: cs?.position,
    canvasZ: cs?.zIndex,
    canvasTop: canvasBox?.top,
    canvasHeight: canvasBox?.height,
    headerTop,
    headerOk: headerTop !== null && headerTop < 80,
    products: document.body.innerText.includes("أحدث المنتجات"),
  };
});
console.log("store", JSON.stringify(info, null, 2));
await store.screenshot({
  path: "C:/Users/Admin/Projects/codeX/public/rmz-gap-fix.png",
});
await browser.close();
