"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  products,
  categoryLabels,
  type Product,
  type ProductCategory,
} from "@/data/products";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [optionId, setOptionId] = useState(product.options?.[0]?.id);
  const [added, setAdded] = useState(false);

  const price =
    product.options?.find((o) => o.id === optionId)?.price ?? product.price;

  const handleAdd = () => {
    addItem(product, optionId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="product-card flex w-[260px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] sm:w-auto">
      <div className="relative h-44 overflow-hidden bg-[#070b14]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 260px, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] via-transparent to-transparent" />
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-md bg-[#3b82f6] px-2 py-0.5 text-[10px] font-semibold text-white">
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-[11px] text-[#60a5fa]/80">
          {categoryLabels[product.category]}
        </p>
        <h3 className="text-sm font-semibold leading-6 text-white">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
          {product.description}
        </p>

        {product.options && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOptionId(opt.id)}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${
                  optionId === opt.id
                    ? "border-[#3b82f6] bg-[#3b82f6]/15 text-[#93c5fd]"
                    : "border-white/10 text-white/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-lg font-bold text-[#60a5fa]">
          {formatPrice(price)}
        </p>

        <button
          type="button"
          onClick={handleAdd}
          className={`mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
            added
              ? "border-white bg-white text-[#05070f]"
              : "border-[#3b82f6]/60 text-[#93c5fd] hover:bg-[#3b82f6]/15"
          }`}
        >
          {added ? "تمت الإضافة ✓" : "أضف للسلة"}
        </button>
      </div>
    </article>
  );
}

export function ProductCatalog() {
  const [filter, setFilter] = useState<ProductCategory | "all">("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? products
        : products.filter((p) => p.category === filter),
    [filter],
  );

  const categories: Array<ProductCategory | "all"> = [
    "all",
    "fivem",
    "bots",
    "vip",
  ];

  return (
    <section id="products" className="scroll-mt-20 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">الأكثر مبيعاً</h2>
            <p className="mt-1 text-sm text-white/45">خدمات برمجة جاهزة للطلب</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  filter === cat
                    ? "bg-[#3b82f6] text-white"
                    : "bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                {cat === "all" ? "الكل" : categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-white/30 sm:hidden">
          اسحب لليمين لمعاينة المزيد
        </p>
      </div>
    </section>
  );
}
