import { storeConfig } from "@/data/products";

export function Hero() {
  return (
    <section id="home" className="px-4 pb-6 pt-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="neon-border relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1528] via-[#0a1020] to-[#05070f] px-6 py-16 text-center sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 40%, rgba(59,130,246,0.25), transparent 45%), radial-gradient(circle at 70% 60%, rgba(37,99,235,0.2), transparent 40%)",
            }}
          />
          <div className="relative z-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#3b82f6]/60 bg-[#3b82f6]/15 shadow-[0_0_40px_rgba(59,130,246,0.4)]">
              <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                cX
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {storeConfig.name}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/55 sm:text-base">
              {storeConfig.tagline}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
