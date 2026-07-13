/**
 * كتالوج طلبات /order — منتجات وأسعار وطرق دفع 𝐂𝐨𝐝𝐞𝐗
 * (Autocomplete لأن Discord يحدّ الخيارات الثابتة بـ 25)
 */

/** @type {{ name: string, amount: number, currency?: string }[]} */
export const ORDER_PRODUCTS = [
  // فايف إم
  { name: "برمجة فايف إم", amount: 800 },
  { name: "مابات فايف إم بشعار سيرفرك", amount: 80 },
  { name: "حساب لعبة FiveM", amount: 20 },

  // بوتات دسكورد
  { name: "بوت دسكورد متقدم", amount: 125 },
  { name: "بوت دسكورد متوسط", amount: 75 },
  { name: "بوت دسكورد أساسي", amount: 30 },
  { name: "برمجة سيرفر دسكورد بشكل كامل", amount: 200 },

  // بوستات
  { name: "بوستات شهر — 8 بوستات", amount: 13 },
  { name: "بوستات شهر — 10 بوستات", amount: 16 },
  { name: "بوستات شهر — 12 بوستات", amount: 18 },
  { name: "بوستات شهر — 14 بوستات", amount: 21 },
  { name: "بوستات شهر — 20 بوستات", amount: 29 },
  { name: "بوستات 3 شهور — 14 بوستات", amount: 52 },
  { name: "بوستات 3 شهور — 20 بوستات", amount: 74 },

  // توكنات وحسابات
  { name: "توكنات دسكورد — 2 توكن", amount: 8 },
  { name: "توكنات دسكورد — 7 توكنات", amount: 22 },
  { name: "حساب دسكورد — 2026", amount: 6 },
  { name: "حساب دسكورد — 2025", amount: 7 },
  { name: "حساب دسكورد — 2024", amount: 8 },
  { name: "حساب دسكورد — 2023", amount: 9 },
  { name: "حساب دسكورد — 2022", amount: 10 },
  { name: "حساب دسكورد — 2021", amount: 12 },

  // اشتراكات
  { name: "نيترو سنة شحن", amount: 189 },
  { name: "نيترو قيمنق 3 شهور", amount: 55 },
  { name: "يوتيوب بريميوم 3 شهور", amount: 35 },
  { name: "سناب بلس — 3 شهور", amount: 29 },
  { name: "سناب بلس — 6 شهور", amount: 55 },
  { name: "سناب بلس — سنة", amount: 109 },
  { name: "نتفلكس — شهر حساب كامل", amount: 22 },
  { name: "نتفلكس — شهر برو", amount: 55 },
  { name: "نتفلكس — 3 شهور", amount: 145 },
  { name: "شاهد — شهر خاص", amount: 18 },
  { name: "شاهد — شهر كامل", amount: 35 },
  { name: "شاهد — سنة كامل", amount: 185 },
  { name: "جيمناي — شهر", amount: 14 },
  { name: "جيمناي — 3 شهور", amount: 25 },
  { name: "جيمناي — 6 شهور", amount: 59 },
  { name: "جيمناي — سنة", amount: 79 },

  // خاص المتجر
  { name: "خاص المتجر — 5", amount: 5 },
  { name: "خاص المتجر — 50", amount: 50 },
  { name: "خاص المتجر — 100", amount: 100 },
  { name: "خاص المتجر — 250", amount: 250 },
  { name: "خاص المتجر — 500", amount: 500 },
  { name: "خاص المتجر — 1000", amount: 1000 },
];

export const ORDER_PAYMENTS = [
  { name: "PayPal", value: "PayPal" },
  { name: "تحويل بنكي — الراجحي", value: "تحويل بنكي — الراجحي" },
  { name: "بطاقة Visa / Mastercard", value: "بطاقة Visa/Mastercard" },
  { name: "Apple Pay", value: "Apple Pay" },
  { name: "مدى", value: "مدى" },
  { name: "يدوي / أخرى", value: "يدوي" },
];

/** كل المبالغ الفريدة من الكتالوج + تجربة */
export const ORDER_AMOUNTS = [
  ...[...new Set(ORDER_PRODUCTS.map((p) => p.amount))].sort((a, b) => a - b).map(
    (n) => ({
      name: `${n} ر.س`,
      value: String(n),
      amount: n,
      currency: "ر.س",
    }),
  ),
  { name: "0.10 USD (تجربة)", value: "0.10|USD", amount: 0.1, currency: "USD" },
];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} focused
 * @param {number} [limit]
 */
export function filterProductChoices(focused, limit = 25) {
  const q = norm(focused);
  const list = !q
    ? ORDER_PRODUCTS
    : ORDER_PRODUCTS.filter(
        (p) =>
          norm(p.name).includes(q) ||
          String(p.amount).includes(q) ||
          `${p.amount} ر.س`.includes(q),
      );
  return list.slice(0, limit).map((p) => {
    const label = `${p.name} — ${p.amount} ر.س`;
    return {
      name: label.length > 100 ? `${label.slice(0, 97)}...` : label,
      value: p.name.length > 100 ? p.name.slice(0, 100) : p.name,
    };
  });
}

/**
 * @param {string} focused
 * @param {number} [limit]
 */
export function filterAmountChoices(focused, limit = 25) {
  const q = norm(focused);
  const list = !q
    ? ORDER_AMOUNTS
    : ORDER_AMOUNTS.filter(
        (a) =>
          norm(a.name).includes(q) ||
          String(a.amount).includes(q) ||
          a.value.includes(q),
      );
  return list.slice(0, limit).map((a) => ({
    name: a.name.length > 100 ? a.name.slice(0, 100) : a.name,
    value: a.value,
  }));
}

/** مبلغ المنتج من الاسم إن وُجد */
export function amountForProduct(productName) {
  const hit = ORDER_PRODUCTS.find((p) => p.name === productName);
  return hit ? hit.amount : null;
}
