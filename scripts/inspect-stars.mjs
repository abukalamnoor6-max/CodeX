import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const browser = await chromium.launchPersistentContext(userData, {
  headless: true,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto("https://codex112.rmz.gg/?v=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const canvas = document.getElementById("codex-starfield");
  const bodyKids = [...document.body.children].slice(0, 12).map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      id: el.id,
      cls: (el.className || "").toString().slice(0, 80),
      z: cs.zIndex,
      pos: cs.position,
      bg: cs.backgroundColor,
      bgImg: cs.backgroundImage?.slice(0, 40),
    };
  });
  const main = document.querySelector("main, [class*='main'], [class*='Main'], #__next, #root, .app");
  let mainInfo = null;
  if (main) {
    const cs = getComputedStyle(main);
    mainInfo = { tag: main.tagName, cls: (main.className||"").toString().slice(0,100), bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position };
  }
  // find opaque full-bleed wrappers
  const big = [...document.querySelectorAll("body *")].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 1000 && r.height > 500;
  }).slice(0, 8).map(el => {
    const cs = getComputedStyle(el);
    return { tag: el.tagName, cls: (el.className||"").toString().slice(0,80), bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position };
  });
  return {
    canvas: canvas ? { z: getComputedStyle(canvas).zIndex, bg: getComputedStyle(canvas).backgroundColor } : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyKids,
    mainInfo,
    big,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();