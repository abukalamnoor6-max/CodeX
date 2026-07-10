"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { products, storeConfig, categoryLabels } from "@/data/products";

export function Header() {
  const { count } = useCart();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const results = query.trim()
    ? products.filter(
        (p) =>
          p.name.includes(query.trim()) ||
          p.description.includes(query.trim()) ||
          categoryLabels[p.category].includes(query.trim()),
      )
    : [];

  const goHomeHash = (hash: string) => {
    setMobileOpen(false);
    setSearchOpen(false);
    if (pathname === "/") {
      document.getElementById(hash.replace("#", ""))?.scrollIntoView({
        behavior: "smooth",
      });
    } else {
      router.push(`/${hash}`);
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-white/[0.08]"
        style={{
          background: "rgba(10, 10, 15, 0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex shrink-0 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#3b82f6]/50 bg-[#3b82f6]/15 font-[family-name:var(--font-display)] text-sm font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                  cX
                </span>
                <span className="hidden font-[family-name:var(--font-display)] text-lg font-bold text-white xs:inline sm:inline">
                  {storeConfig.name}
                </span>
              </Link>

              <nav className="hidden items-center gap-1 lg:flex">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  الرئيسية
                </Link>
                <button
                  type="button"
                  onClick={() => goHomeHash("#products")}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  المنتجات
                </button>
                <div className="relative" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    المزيد
                    <ChevronDown open={moreOpen} />
                  </button>
                  {moreOpen && (
                    <div className="absolute right-0 top-full z-50 pt-2" style={{ minWidth: 200 }}>
                      <div
                        className="rounded-2xl p-2 shadow-2xl"
                        style={{
                          background: "#16161d",
                          border: "1px solid rgba(255,255,255,0.08)",
                          backdropFilter: "blur(20px)",
                        }}
                      >
                        <DropdownLink
                          onClick={() => {
                            setMoreOpen(false);
                            goHomeHash("#products");
                          }}
                        >
                          فايف إم
                        </DropdownLink>
                        <DropdownLink
                          onClick={() => {
                            setMoreOpen(false);
                            goHomeHash("#products");
                          }}
                        >
                          بوتات دسكورد
                        </DropdownLink>
                        <DropdownLink
                          onClick={() => {
                            setMoreOpen(false);
                            goHomeHash("#products");
                          }}
                        >
                          خاص المتجر
                        </DropdownLink>
                        <div className="my-1 border-t border-white/10" />
                        <DropdownLink
                          onClick={() => {
                            setMoreOpen(false);
                            goHomeHash("#payment");
                          }}
                        >
                          طرق الدفع
                        </DropdownLink>
                        <DropdownLink
                          onClick={() => {
                            setMoreOpen(false);
                            goHomeHash("#faq");
                          }}
                        >
                          الأسئلة الشائعة
                        </DropdownLink>
                        <Link
                          href="/orders"
                          onClick={() => setMoreOpen(false)}
                          className="block rounded-lg px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        >
                          طلباتي
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </nav>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="بحث"
              >
                <SearchIcon />
              </button>

              <Link
                href="/checkout"
                className="relative rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="السلة"
              >
                <CartIcon />
                <span
                  className="absolute -left-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "#3b82f6" }}
                >
                  {count}
                </span>
              </Link>

              <Link
                href="/account"
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label={user ? "الحساب" : "تسجيل الدخول"}
                title={user?.contact}
              >
                <UserIcon />
              </Link>

              {user && (
                <button
                  type="button"
                  onClick={logout}
                  className="hidden rounded-lg px-2 py-2 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-white sm:block"
                >
                  خروج
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white lg:hidden"
                aria-label="القائمة"
              >
                <MenuIcon open={mobileOpen} />
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div
            className="border-t border-white/[0.08] px-4 py-3 lg:hidden"
            style={{ background: "rgba(10, 10, 15, 0.95)" }}
          >
            <div className="flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                الرئيسية
              </Link>
              <button
                type="button"
                onClick={() => goHomeHash("#products")}
                className="rounded-lg px-3 py-2.5 text-right text-sm text-zinc-300 hover:bg-white/5"
              >
                المنتجات
              </button>
              <button
                type="button"
                onClick={() => goHomeHash("#payment")}
                className="rounded-lg px-3 py-2.5 text-right text-sm text-zinc-300 hover:bg-white/5"
              >
                طرق الدفع
              </button>
              <button
                type="button"
                onClick={() => goHomeHash("#faq")}
                className="rounded-lg px-3 py-2.5 text-right text-sm text-zinc-300 hover:bg-white/5"
              >
                الأسئلة الشائعة
              </button>
              <Link
                href="/orders"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                طلباتي
              </Link>
            </div>
          </div>
        )}
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-sm">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: "#12121a" }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <SearchIcon />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="h-14 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-white"
              >
                إغلاق
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">
                  اكتب اسم المنتج للبحث
                </p>
              )}
              {query.trim() && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">
                  ما لقينا نتائج
                </p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                    goHomeHash("#products");
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-right transition hover:bg-white/5"
                >
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="text-xs text-[#60a5fa]">{p.price} ر.س</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DropdownLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg px-4 py-2.5 text-right text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-2.5 w-2.5 opacity-50 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}
