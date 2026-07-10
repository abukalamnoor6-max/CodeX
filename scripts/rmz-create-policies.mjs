import { chromium } from "playwright";

const userData = "C:/Users/Admin/Projects/codeX/.rmz-browser-profile";

const pagesToCreate = [
  {
    title: "سياسة الإسترجاع والاستبدال",
    description: "سياسة الإسترجاع والاستبدال لمتجر codeX",
    slug: "refund-policy",
    type: "سياسة الإسترجاع والاستبدال",
    html: `
<p>مرحباً بك في متجر <strong>codeX</strong>. توضّح هذه السياسة شروط الإسترجاع والاستبدال لخدماتنا الرقمية.</p>
<h3>طبيعة المنتجات</h3>
<p>جميع منتجاتنا خدمات رقمية مخصّصة (برمجة فايف إم، بوتات دسكورد، تصاميم، وخدمات المتجر). وبسبب طبيعتها الرقمية، تختلف سياسة الإسترجاع عن المنتجات المادية.</p>
<h3>حالات يمكن فيها طلب الإسترجاع</h3>
<ul>
  <li>إذا لم يبدأ تنفيذ الخدمة بعد الدفع، خلال <strong>24 ساعة</strong> من إتمام الطلب.</li>
  <li>إذا تعذّر علينا تنفيذ الخدمة لأسباب من طرفنا، ولم نقدّم بديلاً مناسباً.</li>
  <li>إذا كان هناك خطأ واضح في وصف المنتج أو السعر من طرف المتجر.</li>
</ul>
<h3>حالات لا يشملها الإسترجاع</h3>
<ul>
  <li>بعد بدء تنفيذ الخدمة أو تسليم أي جزء منها.</li>
  <li>بعد تسليم الملفات، السكربتات، البوتات، أو أي مخرجات رقمية.</li>
  <li>إذا تغيّر رأي العميل بعد بدء العمل.</li>
  <li>الطلبات التي اكتملت وتم تسليمها حسب المتفق عليه.</li>
</ul>
<h3>الاستبدال</h3>
<p>يمكن طلب تعديل أو استبدال ضمن نطاق الخدمة المتفق عليها إذا وُجد خلل تقني من طرفنا، ويتم ذلك بالتواصل معنا عبر دسكورد أو تذكرة الدعم.</p>
<h3>طريقة طلب الإسترجاع</h3>
<ol>
  <li>تواصل معنا عبر دسكورد أو من خلال تذكرة الطلب.</li>
  <li>أرفق رقم الطلب وسبب الطلب.</li>
  <li>نراجع الطلب خلال 1–3 أيام عمل ونبلغك بالنتيجة.</li>
</ol>
<h3>طريقة إعادة المبلغ</h3>
<p>في حال الموافقة، يُعاد المبلغ بنفس طريقة الدفع الأصلية قدر الإمكان، وقد يستغرق ظهوره حسب مزوّد الدفع.</p>
<p>للاستفسار: تواصل مع فريق <strong>codeX</strong> عبر قنوات الدعم الرسمية في المتجر.</p>
`.trim(),
  },
  {
    title: "الشروط والأحكام",
    description: "شروط وأحكام استخدام متجر codeX",
    slug: "terms",
    type: "سياسة المتجر (الشروط والأحكام)",
    html: `
<p>باستخدامك متجر <strong>codeX</strong> أو الشراء منه، فإنك توافق على الشروط التالية.</p>
<h3>1) تعريف الخدمة</h3>
<p>يقدّم codeX خدمات رقمية مثل برمجة سيرفرات فايف إم، بوتات دسكورد، تصاميم، وخدمات مخصّصة حسب وصف كل منتج.</p>
<h3>2) الحساب والطلبات</h3>
<ul>
  <li>يجب تزويدنا ببيانات صحيحة (مثل دسكورد / البريد) لإتمام التسليم.</li>
  <li>يُعد الطلب مؤكداً بعد إتمام الدفع بنجاح.</li>
  <li>أوقات التنفيذ تقديرية وقد تختلف حسب حجم الطلب والضغط.</li>
</ul>
<h3>3) الدفع</h3>
<p>يتم الدفع عبر الوسائل المتاحة في المتجر. لا نتحمل تأخيراً ناتجاً عن مزوّد الدفع أو بيانات غير صحيحة من العميل.</p>
<h3>4) التسليم والملكية</h3>
<ul>
  <li>يتم التسليم عبر القنوات المتفق عليها (دسكورد / التذكرة / الملفات).</li>
  <li>بعد التسليم، يحصل العميل على حق استخدام المخرجات حسب الاتفاق، مع احتفاظ codeX بحقوق الملكية الفكرية للأدوات والقوالب العامة ما لم يُنص على غير ذلك.</li>
</ul>
<h3>5) الاستخدام المقبول</h3>
<p>يُمنع استخدام خدماتنا لأي غرض مخالف للأنظمة، أو لإيذاء الغير، أو لانتهاك حقوق الآخرين. نحتفظ بحق رفض أو إيقاف أي طلب يخالف ذلك.</p>
<h3>6) التعديلات والدعم</h3>
<p>التعديلات ضمن نطاق المنتج المتفق عليه مشمولة حسب وصف المنتج. أي طلب خارج النطاق قد يُسعَّر بشكل منفصل.</p>
<h3>7) المسؤولية</h3>
<p>نبذل جهدنا لتقديم خدمة عالية الجودة، لكننا غير مسؤولين عن خسائر غير مباشرة ناتجة عن سوء استخدام الخدمة أو تعديلات من طرف ثالث بعد التسليم.</p>
<h3>8) سياسة الإسترجاع</h3>
<p>تخضع طلبات الإسترجاع لصفحة <strong>سياسة الإسترجاع والاستبدال</strong> المنشورة في المتجر.</p>
<h3>9) تعديل الشروط</h3>
<p>قد نحدّث هذه الشروط من وقت لآخر، ويُعد استمرار استخدام المتجر موافقة على النسخة المحدّثة.</p>
<p>لأي استفسار تواصل مع فريق <strong>codeX</strong> عبر قنوات الدعم الرسمية.</p>
`.trim(),
  },
];

async function fillField(page, selector, value) {
  const el = page.locator(selector);
  await el.click({ clickCount: 3 });
  await el.fill(value);
  await el.evaluate((node, v) => {
    const proto =
      node.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(node, v);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function createPage(browser, data) {
  const page = await browser.newPage();
  await page.goto("https://app.rmz.gg/pages", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /صفحة جديدة/ }).click();
  await page.waitForTimeout(1500);

  await fillField(page, "#createCategory_title", data.title);
  await fillField(page, "#createCategory_description", data.description);
  await fillField(page, "#createCategory_slug", data.slug);

  // Select page type
  await page.locator("#createCategory_type").click({ force: true });
  await page.waitForTimeout(500);
  await page
    .locator(".ant-select-item-option")
    .filter({ hasText: data.type })
    .first()
    .click();
  await page.waitForTimeout(400);

  // Fill Quill editor
  const editor = page.locator(".ql-editor").first();
  await editor.click();
  await editor.evaluate((node, html) => {
    node.innerHTML = html;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    // Quill listens to text-change via MutationObserver usually; also try paste event
    const evt = new InputEvent("textInput", { bubbles: true, data: " " });
    node.dispatchEvent(evt);
  }, data.html);
  await page.waitForTimeout(500);

  // Ensure status is enabled
  const sw = page.locator(".ant-switch").first();
  if (await sw.count()) {
    const checked = await sw.getAttribute("aria-checked");
    if (checked !== "true") await sw.click();
  }

  await page.getByRole("button", { name: /^إضافة$/ }).click();
  await page.waitForTimeout(3000);

  const body = await page.evaluate(() => document.body.innerText);
  const ok =
    /تم|نجاح|نجاح|أضيف|أُضيف|saved|success/i.test(body) ||
    body.includes(data.title);
  console.log("created?", data.title, "okHint=", ok);
  console.log("url after", page.url());
  await page.screenshot({
    path: `C:/Users/Admin/Projects/codeX/public/rmz-created-${data.slug}.png`,
  });
  await page.close();
  return ok;
}

const browser = await chromium.launchPersistentContext(userData, {
  headless: false,
  channel: "chrome",
  viewport: { width: 1400, height: 900 },
});

for (const p of pagesToCreate) {
  await createPage(browser, p);
}

// Verify pages list + dashboard progress
const verify = await browser.newPage();
await verify.goto("https://app.rmz.gg/pages", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await verify.waitForTimeout(2500);
const listText = await verify.evaluate(() => document.body.innerText);
console.log(
  "pages list has refund?",
  listText.includes("إسترجاع") || listText.includes("استرجاع"),
);
console.log("pages list has terms?", listText.includes("الشروط"));
console.log("list snippet:\n", listText.slice(0, 1500));

await verify.goto("https://app.rmz.gg/", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await verify.waitForTimeout(3000);
const home = await verify.evaluate(() => document.body.innerText);
const stillRefund = home.includes("أضف سياسة الإسترجاع");
const stillTerms = home.includes("أضف الشروط والأحكام");
console.log({ stillRefund, stillTerms, progress: home.match(/\d+%/)?.[0] });
await verify.screenshot({
  path: "C:/Users/Admin/Projects/codeX/public/rmz-setup-after.png",
});
await browser.close();
console.log("DONE");
