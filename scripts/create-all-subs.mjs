import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = "C:/Users/Admin/Projects/codeX";
const IMG_DIR = path.join(ROOT, "public/products/subs");

const PRODUCTS = [
  {
    key: "boost-month",
    name: "بوستات شهر",
    cat: "discord",
    price: 13,
    cost: 8,
    fields: [
      {
        type: "select",
        name: "عدد البوستات",
        required: true,
        options: [
          { name: "8 بوستات شهر", price: 0 },
          { name: "10 بوستات شهر", price: 3 },
          { name: "12 بوست شهر", price: 5 },
          { name: "14 بوست شهر", price: 8 },
          { name: "20 بوست شهر", price: 16 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>🚀 بوستات ديسكورد شهرية لسيرفرك</p><p>ترفع مستوى السيرفر وتفعّل المزايا</p><p>اختر عدد البوستات المناسب من القائمة</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p><p>✅ دعم عبر تذاكر codeX</p>`,
  },
  {
    key: "boost-3m",
    name: "بوستات 3 شهور",
    cat: "discord",
    price: 52,
    cost: 35,
    fields: [
      {
        type: "select",
        name: "بوست ثلاث شهور",
        required: true,
        options: [
          { name: "14 بوست", price: 0 },
          { name: "20 بوست", price: 22 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>💎 بوستات ديسكورد لمدة 3 أشهر</p><p>ثبات أطول لسيرفرك مع مزايا البوست</p><p>باقات 14 أو 20 بوست حسب احتياجك</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "tokens",
    name: "توكنات دسكورد",
    cat: "discord",
    price: 8,
    cost: 4,
    fields: [
      {
        type: "select",
        name: "التوكنات",
        required: true,
        options: [
          { name: "2 توكنات شهر", price: 0 },
          { name: "7 توكنات شهر", price: 14 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>🎭 توكن دسكورد = حساب وهمي عليه نيترو شهر</p><p>الحساب يكون لك بعد الشراء (حساب وهمي مخصص)</p><p>⚠️ التوكن حساب وهمي — مو حسابك الشخصي</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "dc-accounts",
    name: "حسابات دسكورد قديمة",
    cat: "discord",
    price: 6,
    cost: 3,
    fields: [
      {
        type: "select",
        name: "سنة الإنشاء",
        required: true,
        options: [
          { name: "حساب 2026", price: 0 },
          { name: "حساب 2025", price: 1 },
          { name: "حساب 2024", price: 2 },
          { name: "حساب 2023", price: 3 },
          { name: "حساب 2022", price: 4 },
          { name: "حساب 2021", price: 6 },
          { name: "حساب 2020", price: 9 },
          { name: "حساب 2019", price: 11 },
          { name: "حساب 2018", price: 14 },
          { name: "حساب 2017", price: 19 },
          { name: "حساب 2016", price: 36 },
          { name: "حساب 2015", price: 243 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>👑 حسابات إنشاء قديم بجودة عالية وبدون مشاكل</p><p>✅ ضمان ذهبي وقانوني من قبل ديسكورد</p><p>✅ أسعار ترضيك وتخليك تثق</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "nitro-year",
    name: "نيترو سنة شحن",
    cat: "subs",
    price: 189,
    cost: 165,
    fields: [{ type: "text", name: "يوزرك في الديسكورد", required: true }],
    description: `<p>🔥 نيترو سنة شحن — تجربة كاملة</p><p>💯 ضمان قانوني وسحب</p><p>⚠️ الحساب لازم ما يكون عليه نيترو نشط وما يكون مفعّل من قبل</p><p>✨ بوستين، رفع 100MB، إيموجي متحرك، بث 1080p، وتغيير التاق</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "nitro-3m",
    name: "نيترو قيمنق 3 شهور — للحسابات الجديدة",
    cat: "subs",
    price: 55,
    cost: 35,
    fields: [{ type: "text", name: "يوزر الديسكورد (إجباري)", required: true }],
    description: `<p>✨ نيترو قيمنق 3 شهور — للحسابات الجديدة فقط</p><p>للحسابات اللي ما فعّلت نيترو قبل</p><p>النيترو شرعي وغير مفعّل وانت أول واحد بتفعّله</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "fivem-acc",
    name: "حساب لعبة FiveM",
    cat: "fivem",
    price: 20,
    cost: 12,
    fields: [{ type: "text", name: "يوزر الدسكورد (إجباري)", required: true }],
    description: `<p>🎮 حساب مخصص لفايف إم فقط من روكستار</p><p>Full Access — تقدر تغيّر الإيميل والباسورد فوراً</p><p>لا يدعم تحميل GTA V الأساسية — لفايف إم فقط</p><p>يفك باند السيرفرات السابقة</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "snap",
    name: "سناب بلس",
    cat: "subs",
    price: 29,
    cost: 18,
    fields: [
      {
        type: "select",
        name: "اشتراك سناب بلس",
        required: true,
        options: [
          { name: "باقة 3 شهور بلس", price: 0 },
          { name: "باقة 6 شهور بلس", price: 26 },
          { name: "باقة سنة بلس", price: 80 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>👻 سناب بلس اشتراك رسمي 100%</p><p>شارة +Snapchat وتثبيت دردشات وسمات مخصصة</p><p>ضمان ذهبي كامل المدة حسب الاشتراك</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "netflix",
    name: "نتفلكس",
    cat: "subs",
    price: 22,
    cost: 12,
    fields: [
      {
        type: "select",
        name: "نوع الاشتراك",
        required: true,
        options: [
          { name: "اشتراك شهر - حساب كامل", price: 0 },
          { name: "اشتراك شهر - حساب كامل برو", price: 33 },
          { name: "اشتراك 3 شهور - حساب كامل", price: 123 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>🎬 نتفلكس بجودة 4K بدون تقطيع</p><p>بروفايل خاص — مو مشاركة عشوائية</p><p>ممنوع تغيير الإعدادات أو مشاركة الحساب</p><p>ضمان ذهبي كامل المدة</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "shahid",
    name: "شاهد",
    cat: "subs",
    price: 18,
    cost: 10,
    fields: [
      {
        type: "select",
        name: "نوع الاشتراك",
        required: true,
        options: [
          { name: "اشتراك شهر - خاص", price: 0 },
          { name: "اشتراك شهر - حساب كامل", price: 17 },
          { name: "اشتراك سنة - حساب كامل", price: 167 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
    ],
    description: `<p>📺 شاهد — مسلسلات وأفلام بسهولة</p><p>بدون إعلانات، تحميل أوفلاين، ودعم أجهزة متعددة</p><p>لا يشمل الباقة الرياضية</p><p>ضمان ذهبي كامل المدة</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "gemini",
    name: "جيمناي",
    cat: "subs",
    price: 14,
    cost: 8,
    fields: [
      {
        type: "select",
        name: "نوع الاشتراك",
        required: true,
        options: [
          { name: "باقة شهر - خاص", price: 0 },
          { name: "باقة 3 شهور - خاص", price: 11 },
          { name: "باقة 6 شهور - خاص", price: 45 },
          { name: "باقة سنة - خاص", price: 65 },
        ],
      },
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
      { type: "text", name: "البريد لإرسال الدعوة (إجباري)", required: true },
    ],
    description: `<p>🤖 جيمناي — مساعد ذكي لكتابة المحتوى</p><p>قصص، مقالات، سيناريو، وإيميلات رسمية</p><p>تفعيل عبر دعوة على بريدك الشخصي</p><p>🛡️ ضمان ذهبي 30 يوم</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
  {
    key: "yt-prem",
    name: "يوتيوب بريميوم 3 شهور",
    cat: "subs",
    price: 35,
    cost: 22,
    fields: [
      { type: "text", name: "يوزر الدسكورد (إجباري)", required: true },
      {
        type: "text",
        name: "بريدك الإلكتروني لإرسال الدعوة (إجباري)",
        required: true,
      },
    ],
    description: `<p>▶️ يوتيوب بريميوم 3 شهور + YouTube Music على حسابك</p><p>بدون إعلانات، تشغيل بالخلفية، وتحميل أوفلاين</p><p>يشترط عدم وجود اشتراك نشط وقبول دعوة Google Family</p><p>⏱ مدة التسليم: من 10 دقائق إلى 32 ساعة</p>`,
  },
];

const browser = await chromium.launchPersistentContext(
  path.join(ROOT, ".rmz-browser-profile"),
  { channel: "chrome", headless: true },
);
const page = browser.pages()[0] || (await browser.newPage());
await page.goto("https://app.rmz.gg/products", {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.waitForTimeout(2500);

const imagesB64 = Object.fromEntries(
  PRODUCTS.map((p) => [
    p.key,
    fs.readFileSync(path.join(IMG_DIR, `${p.key}.jpg`)).toString("base64"),
  ]),
);

const result = await page.evaluate(
  async ({ PRODUCTS, imagesB64 }) => {
    await fetch("https://app.rmz.gg/sanctum/csrf-cookie", {
      credentials: "include",
    });
    const csrf = decodeURIComponent(
      document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] || "",
    );
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-XSRF-TOKEN": csrf,
    };

    const cats = (
      await (
        await fetch("https://app.rmz.gg/kebab/categories?per_page=50", {
          credentials: "include",
          headers,
        })
      ).json()
    ).data;

    // cleanup TMP leftovers
    const list = await (
      await fetch("https://app.rmz.gg/kebab/products?per_page=100", {
        credentials: "include",
        headers,
      })
    ).json();
    for (const p of list.products?.data || []) {
      if (/^TMP\d|^TMP /.test(p.name) || p.name.includes("PROBE")) {
        await fetch("https://app.rmz.gg/kebab/products/" + p.id, {
          method: "DELETE",
          credentials: "include",
          headers,
        });
      }
    }
    for (const c of cats.filter((x) => String(x.title).includes("TMP"))) {
      await fetch("https://app.rmz.gg/kebab/categories/" + c.id, {
        method: "DELETE",
        credentials: "include",
        headers,
      });
    }

    let subs = cats.find((c) => c.title === "اشتراكات");
    if (!subs) {
      await fetch("https://app.rmz.gg/kebab/categories", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          title: "اشتراكات",
          description: "اشتراكات رقمية وخدمات ترفيه",
          is_active: true,
        }),
      });
      const cats2 = (
        await (
          await fetch("https://app.rmz.gg/kebab/categories?per_page=50", {
            credentials: "include",
            headers,
          })
        ).json()
      ).data;
      subs = cats2.find((c) => c.title === "اشتراكات");
    }

    const catMap = {
      discord: cats.find((c) => c.title.includes("دسكورد"))?.id || 25377,
      fivem: cats.find((c) => c.title.includes("فايف"))?.id || 25376,
      subs: subs?.id,
    };

    const existingNames = new Set(
      (list.products?.data || []).map((p) => p.name),
    );

    async function upload(b64, name) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("file", blob, name);
      const r = await fetch(
        "https://app.rmz.gg/kebab/products/upload?type=image",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": csrf,
          },
          body: fd,
        },
      );
      return await r.json();
    }

    const created = [];
    for (const p of PRODUCTS) {
      if (existingNames.has(p.name)) {
        created.push({ name: p.name, skipped: true });
        continue;
      }
      const up = await upload(imagesB64[p.key], p.key + ".jpg");
      const payload = {
        name: p.name,
        slug:
          "codex-" +
          p.key +
          "-" +
          Math.random().toString(36).slice(2, 6),
        description: p.description,
        type: "service",
        price: p.price,
        cost_price: p.cost,
        status: 1,
        show_reviews: 1,
        fields: p.fields,
        categories: [catMap[p.cat]],
        image: {
          file: {
            uid: "rc-upload-" + Date.now(),
            name: up.name,
            status: "done",
            response: up,
            xhr: {},
            originFileObj: {},
          },
          fileList: [
            {
              uid: "rc-upload-" + Date.now(),
              name: up.name,
              status: "done",
              response: up,
            },
          ],
        },
      };

      const r = await fetch("https://app.rmz.gg/kebab/products", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });
      const t = await r.text();
      let j = null;
      try {
        j = JSON.parse(t);
      } catch {}
      created.push({
        name: p.name,
        status: r.status,
        id: j?.id || j?.product?.id || j?.data?.id,
        price: p.price,
        cat: catMap[p.cat],
        err: r.status >= 400 ? t.slice(0, 220) : null,
        emptyOk: r.status < 400 && !t,
      });
    }

    // homepage section for اشتراكات
    if (catMap.subs) {
      await fetch("https://app.rmz.gg/kebab/store/design/component/products", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          component_type: "products",
          title: "اشتراكات",
          type: "category",
          categories: catMap.subs,
          show_type: "slider",
        }),
      });
    }

    const finalList = await (
      await fetch("https://app.rmz.gg/kebab/products?per_page=100", {
        credentials: "include",
        headers,
      })
    ).json();

    return {
      catMap,
      created,
      names: (finalList.products?.data || [])
        .filter((p) => p.status === 1)
        .map((p) => ({ id: p.id, name: p.name, price: p.price })),
    };
  },
  { PRODUCTS, imagesB64 },
);

fs.writeFileSync(
  path.join(ROOT, ".tmp-products-created.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
