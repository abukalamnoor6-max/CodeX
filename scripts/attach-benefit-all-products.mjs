import { chromium } from "playwright";
const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";
const PRODUCT_IDS = [89437,89436,89434,89433,89432,89431,89430,89429,89428,89427,89426];
const BENEFIT_NAME = "codeX Discord";

const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1500, height: 950 },
});
const page = browser.pages()[0] || await browser.newPage();

async function attachBenefit(productId) {
  await page.goto(`https://app.rmz.gg/products/${productId}/edit`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2500);

  // Find benefits select near label المزايا
  const selects = page.locator(".ant-select-selector");
  const count = await selects.count();
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const near = await selects.nth(i).evaluate((el) => {
      let p = el;
      for (let k = 0; k < 8 && p; k++) {
        const t = (p.innerText || "").slice(0, 80);
        if (/^المزايا|المزايا\s*:|اختر المزايا/m.test(t)) return t;
        p = p.parentElement;
      }
      return "";
    });
    if (/المزايا|اختر المزايا/.test(near)) {
      await selects.nth(i).click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // fallback: click placeholder text
    const ph = page.getByText("اختر المزايا");
    if (await ph.count()) {
      await ph.first().click();
      clicked = true;
    }
  }
  await page.waitForTimeout(700);
  const opts = await page.locator(".ant-select-item-option").allTextContents();
  console.log(productId, "opts", opts.filter(o => /codeX|Discord|دسكورد|مزاي/i.test(o) || o.length < 40).slice(0, 15));

  const opt = page.locator(".ant-select-item-option").filter({ hasText: BENEFIT_NAME }).first();
  if (await opt.count()) {
    // if already selected, option may have selected class; still click
    const selected = await opt.getAttribute("aria-selected");
    if (selected !== "true") {
      await opt.click();
      console.log(productId, "selected benefit");
    } else {
      console.log(productId, "already selected");
      await page.keyboard.press("Escape");
    }
  } else {
    console.log(productId, "NO BENEFIT OPTION");
    await page.keyboard.press("Escape");
    return false;
  }

  await page.waitForTimeout(400);
  // blur
  await page.locator("input").first().click().catch(()=>{});
  await page.getByRole("button", { name: /تحديث المنتج/ }).click();
  await page.waitForTimeout(2500);
  const body = await page.evaluate(() => document.body.innerText);
  const ok = /تم|نجاح|تحديث|updated|success/i.test(body);
  console.log(productId, "save", ok ? "ok" : "maybe");
  return true;
}

const results = [];
for (const id of PRODUCT_IDS) {
  try {
    results.push({ id, ok: await attachBenefit(id) });
  } catch (e) {
    console.log(id, "ERR", e.message);
    results.push({ id, ok: false, err: e.message });
  }
}

// verify via API
await page.goto("https://app.rmz.gg/benefits", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(1500);
const verify = await page.evaluate(async () => {
  const benefits = await (await fetch("https://app.rmz.gg/kebab/benefits", { credentials: "include" })).json();
  const sample = await (await fetch("https://app.rmz.gg/kebab/products/89437", { credentials: "include" })).json();
  return {
    benefit: benefits.data?.[0],
    sampleBenefits: sample.benefits,
  };
});
console.log("VERIFY", JSON.stringify(verify, null, 2));
console.log("RESULTS", results);
await browser.close();