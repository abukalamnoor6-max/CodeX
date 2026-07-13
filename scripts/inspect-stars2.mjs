import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("https://codex112.rmz.gg/?fixstars=" + Date.now(), { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  return {
    title: document.title,
    hasFx: !!window.__CODEX_FX__,
    hasCanvas: !!document.getElementById("codex-starfield"),
    hasWelcome: html.includes("welcome-codex"),
    hasStarCss: html.includes("codex-starfield"),
    hasCodeXFx: html.includes("__CODEX_FX__"),
    customStyleCount: document.querySelectorAll("style").length,
    scriptsInline: [...document.scripts].filter(s => !s.src && s.textContent.includes("CODEX")).length,
    bodyTextStart: document.body.innerText.slice(0, 200),
  };
});
console.log(JSON.stringify(info, null, 2));
// dump style tags that mention codex
const styles = await page.evaluate(() => [...document.querySelectorAll("style")].map(s => s.textContent).filter(t => /codex|starfield|#000/i.test(t)).map(t => t.slice(0, 400)));
console.log("styles", JSON.stringify(styles, null, 2));
await browser.close();