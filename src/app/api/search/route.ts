import { NextResponse } from "next/server";
import { fetchAllProducts } from "@/lib/products";
import { fuzzyTextMatch } from "@/lib/fuzzySearch";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const products = await fetchAllProducts();

  const matches = products
    .filter((p) => {
      const haystack = [p.title, p.brand, p.categoryName].filter(Boolean).join(" ");
      return fuzzyTextMatch(q, haystack);
    })
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      title: p.title,
      image: p.image,
      price: p.price,
      href:
        p.source === "MAZON"
          ? `/products/mazon/${p.slugOrId}`
          : `/products/trendyol/${p.slugOrId}`,
    }));

  return NextResponse.json(matches);
}
