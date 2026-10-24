import { NextResponse } from "next/server";
import { fetchFrequentlyBoughtTogether } from "@/lib/products";

// پیشنهاد محصول بر اساس همه‌ی آیتم‌های فعلی سبد (نه فقط یک محصول) -- سبد فقط
// سمت کلاینت (localStorage) نگه داشته می‌شه، پس این fetch از خودِ صفحه‌ی سبد میاد
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const productIds: string[] = Array.isArray(body.productIds)
    ? body.productIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const excludeIds = new Set<string>(
    Array.isArray(body.excludeIds) ? body.excludeIds.filter((x: unknown): x is string => typeof x === "string") : []
  );

  if (productIds.length === 0) {
    return NextResponse.json({ products: [] });
  }

  // موازی واکشی، ولی ادغام به همون ترتیبِ آیتم‌های سبد (قبلاً تا ۱۰ واکشیِ پشت‌سرِهم بود)
  const recsPerItem = await Promise.all(
    productIds.slice(0, 10).map((id) => fetchFrequentlyBoughtTogether(id, 6))
  );
  const seen = new Map<string, Awaited<ReturnType<typeof fetchFrequentlyBoughtTogether>>[number]>();
  for (const recs of recsPerItem) {
    for (const p of recs) {
      if (excludeIds.has(p.id) || seen.has(p.id)) continue;
      seen.set(p.id, p);
    }
  }

  return NextResponse.json({ products: Array.from(seen.values()).slice(0, 8) });
}
