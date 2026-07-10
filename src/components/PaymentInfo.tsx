export function PaymentInfo() {
  return (
    <section id="payment" className="scroll-mt-20 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-2xl border border-[#3b82f6]/20 bg-[#0c1220]/70 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">طرق الدفع</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[#60a5fa]">فوري</p>
            <h3 className="mt-1 font-semibold text-white">PayPal</h3>
          </div>
          <div>
            <p className="text-xs text-[#60a5fa]">آبل</p>
            <h3 className="mt-1 font-semibold text-white">Apple Pay</h3>
          </div>
          <div>
            <p className="text-xs text-[#60a5fa]">تحويل</p>
            <h3 className="mt-1 font-semibold text-white">الراجحي عبر دسكورد</h3>
          </div>
        </div>
      </div>
    </section>
  );
}
