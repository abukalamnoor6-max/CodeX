/**
 * Creates remaining PayPal NCP option links via Cursor browser CDP helpers.
 * Run manually from agent; this file is the source list + USD converter.
 */
export const RATE = 3.75;
export const toUsd = (sar) => Math.round((sar / RATE) * 100) / 100;

/** Remaining products to create (name, SAR total) */
export const REMAINING = [
  ["سناب بلس — سنة", 109],
  ["نتفلكس — شهر حساب كامل", 22],
  ["نتفلكس — شهر برو", 55],
  ["نتفلكس — 3 شهور", 145],
  ["شاهد — شهر خاص", 18],
  ["شاهد — شهر كامل", 35],
  ["شاهد — سنة كامل", 185],
  ["جيمناي — شهر", 14],
  ["جيمناي — 3 شهور", 25],
  ["جيمناي — 6 شهور", 59],
  ["جيمناي — سنة", 79],
  ["حساب دسكورد — 2026", 6],
  ["حساب دسكورد — 2025", 7],
  ["حساب دسكورد — 2024", 8],
  ["حساب دسكورد — 2023", 9],
  ["حساب دسكورد — 2022", 10],
  ["حساب دسكورد — 2021", 12],
  ["حساب دسكورد — 2020", 15],
  ["حساب دسكورد — 2019", 17],
  ["حساب دسكورد — 2018", 20],
  ["حساب دسكورد — 2017", 25],
  ["حساب دسكورد — 2016", 42],
  ["حساب دسكورد — 2015", 249],
];

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  console.log(
    REMAINING.map(([n, s]) => `${n}\t${toUsd(s)} USD`).join("\n"),
  );
}
