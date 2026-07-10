export type ProductCategory = "fivem" | "bots" | "vip";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  image: string;
  badge?: string;
  options?: { id: string; label: string; price: number }[];
};

export const products: Product[] = [
  {
    id: "fivem-dev",
    name: "برمجة فايف إم",
    description: "برمجة سكربتات وموارد مخصصة لسيرفرك — من الفكرة للتنفيذ.",
    price: 800,
    category: "fivem",
    image: "/products/brand/codex-fivem-dev.jpg",
    badge: "الأكثر طلباً",
  },
  {
    id: "fivem-map",
    name: "مابات فايف إم بشعار سيرفرك",
    description: "خريطة مخصصة بشعار وهوية سيرفرك.",
    price: 80,
    category: "fivem",
    image: "/products/brand/codex-fivem-map.jpg",
  },
  {
    id: "fivem-car",
    name: "سيارة خاصة",
    description: "إضافة سيارة خاصة لسيرفر فايف إم.",
    price: 375,
    category: "fivem",
    image: "/products/brand/codex-fivem-car.jpg",
  },
  {
    id: "discord-bot",
    name: "برمجة بوت دسكورد خاص",
    description: "بوت مخصص لسيرفرك — اختر الباقة المناسبة.",
    price: 125,
    category: "bots",
    image: "/products/brand/codex-discord-bot.jpg",
    options: [
      { id: "bot-pro", label: "بوت متقدم", price: 125 },
      { id: "bot-mid", label: "بوت متوسط", price: 75 },
      { id: "bot-basic", label: "بوت أساسي", price: 30 },
    ],
  },
  {
    id: "discord-server-full",
    name: "برمجة سيرفر دسكورد بشكل كامل",
    description: "إعداد وبرمجة سيرفر دسكورد كامل من الصفر حسب طلبك.",
    price: 200,
    category: "bots",
    image: "/products/brand/codex-discord-full.jpg",
    badge: "جديد",
  },
  {
    id: "store-vip-100",
    name: "خاص في المتجر",
    description: "باقة خاصة داخل المتجر بقيمة 100 ريال.",
    price: 100,
    category: "vip",
    image: "/products/brand/codex-store-vip.jpg",
  },
  {
    id: "store-vip-250",
    name: "خاص في المتجر",
    description: "باقة خاصة داخل المتجر بقيمة 250 ريال.",
    price: 250,
    category: "vip",
    image: "/products/brand/codex-store-vip.jpg",
  },
  {
    id: "store-vip-500",
    name: "خاص في المتجر",
    description: "باقة خاصة داخل المتجر بقيمة 500 ريال.",
    price: 500,
    category: "vip",
    image: "/products/brand/codex-store-vip.jpg",
    badge: "مميز",
  },
  {
    id: "store-vip-1000",
    name: "خاص في المتجر",
    description: "باقة خاصة داخل المتجر بقيمة 1000 ريال.",
    price: 1000,
    category: "vip",
    image: "/products/brand/codex-store-vip.jpg",
    badge: "VIP",
  },
];

export const categoryLabels: Record<ProductCategory, string> = {
  fivem: "فايف إم",
  bots: "بوتات دسكورد",
  vip: "خاص المتجر",
};

export const storeConfig = {
  name: "codeX",
  tagline: "متجر موثوق لبرمجة فايف إم وبوتات الدسكورد",
  paypalEmail: "noorabukalam29@gmail.com",
  bank: {
    name: "مصرف الراجحي",
    iban: "SA5280204406341222121014",
    accountName: "codeX",
  },
  discordTicketUrl:
    process.env.NEXT_PUBLIC_DISCORD_TICKET_URL ||
    "https://discord.gg/YOUR_INVITE",
  currency: "SAR" as const,
  currencyLabel: "ر.س",
};
