import { storeConfig } from "@/data/products";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#05070f] px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3b82f6]/50 bg-[#3b82f6]/15 text-xs font-bold">
              cX
            </span>
            <span className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
              {storeConfig.name}
            </span>
          </div>
          <p className="text-sm leading-6 text-white/45">
            متجر إلكتروني لخدمات برمجة فايف إم وبوتات الدسكورد — من الفكرة للتنفيذ.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-white">المتجر</p>
          <ul className="space-y-2 text-sm text-white/45">
            <li>
              <a href="#home" className="hover:text-white">
                الرئيسية
              </a>
            </li>
            <li>
              <a href="#products" className="hover:text-white">
                المنتجات
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white">
                الأسئلة الشائعة
              </a>
            </li>
            <li>
              <a href="#payment" className="hover:text-white">
                طرق الدفع
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-white">حسابي</p>
          <ul className="space-y-2 text-sm text-white/45">
            <li>
              <a href="/account" className="hover:text-white">
                حسابي
              </a>
            </li>
            <li>
              <a href="/orders" className="hover:text-white">
                طلباتي
              </a>
            </li>
            <li>
              <a href="/checkout" className="hover:text-white">
                السلة
              </a>
            </li>
            <li>
              <a href="/login" className="hover:text-white">
                تسجيل الدخول
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center gap-4 border-t border-white/5 pt-6">
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-wider text-white/40">
          <span className="rounded border border-white/15 px-2 py-1">Apple Pay</span>
          <span className="rounded border border-white/15 px-2 py-1">PayPal</span>
          <span className="rounded border border-white/15 px-2 py-1">mada</span>
          <span className="rounded border border-white/15 px-2 py-1">Visa</span>
          <span className="rounded border border-white/15 px-2 py-1">Mastercard</span>
        </div>
        <p className="text-xs text-white/30">
          جميع الحقوق محفوظة © {new Date().getFullYear()} {storeConfig.name}
        </p>
      </div>
    </footer>
  );
}
