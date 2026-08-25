"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompare } from "@/hooks/useCompare";
import { buildComparisonTable, type CompareProduct, type CompareRow } from "@/lib/compare";

// جدول مقایسه: از لیست محلی (localStorage) شناسه‌ها را می‌خواند، محصولات را
// با /api/compare بار می‌کند و جدولِ برچسب/مقدارِ رو-به-روی می‌سازد.
export default function ComparePage() {
  const { ids } = useCompare();
  const [products, setProducts] = useState<CompareProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (ids.length === 0) {
        setProducts([]);
        return;
      }
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products as CompareProduct[]);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
      </div>
    );
  }

  if (ids.length === 0 || products === null || products.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-3">مقایسه محصولات</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          هنوز محصولی برای مقایسه انتخاب نکرده‌اید. از دکمه‌ی «مقایسه» در صفحه‌ی هر محصول استفاده کنید.
        </p>
        <Link
          href="/products"
          className="inline-block bg-[var(--color-wine)] text-white px-5 py-2.5 rounded-full text-sm font-medium"
        >
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  const rows: CompareRow[] = buildComparisonTable(products);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold">مقایسه محصولات</h1>
        <div className="flex gap-2">
          <Link
            href="/products"
            className="border cut-line rounded-full px-4 py-2 text-sm font-medium bg-white hover:bg-[var(--color-linen-dim)]"
          >
            + افزودن محصول
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border cut-line rounded-xl bg-white text-sm">
          <thead>
            <tr className="border-b cut-line">
              <th className="w-40 p-3 text-right text-[11px] text-[var(--color-muted)] align-top sticky right-0 bg-white">
                ویژگی
              </th>
              {products.map((p) => (
                <th key={p.id} className="p-3 text-right align-top min-w-[180px]">
                  <Link href={`/products/mazon/${p.slug}`} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-28 h-28 object-cover rounded-lg border cut-line mb-2"
                    />
                    <span className="text-[12px] leading-snug line-clamp-2">{p.title}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b cut-line align-top">
                <td className="w-40 p-3 text-[11px] font-medium text-[var(--color-muted)] sticky right-0 bg-white">
                  {row.label}
                </td>
                {row.values.map((value, i) => {
                  const product = products[i];
                  if (row.key === "image") {
                    return <td key={i} className="p-3" />;
                  }
                  if (row.key === "title") {
                    return (
                      <td key={i} className="p-3">
                        <Link
                          href={`/products/mazon/${product.slug}`}
                          className="font-medium text-[var(--color-wine)] hover:underline"
                        >
                          {value}
                        </Link>
                      </td>
                    );
                  }
                  if (row.key === "price") {
                    return (
                      <td key={i} className="p-3">
                        <span className="font-bold text-[var(--color-wine)]">{value}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={i} className="p-3 text-[12px]">
                      {value ?? <span className="text-[var(--color-muted)]">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}