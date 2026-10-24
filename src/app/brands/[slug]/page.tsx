import { notFound } from "next/navigation";
import { ProductGrid, GridViewToggle } from "@/components/GridView";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fetchMazonProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import type { Metadata } from "next";

function slugToBrandName(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, " ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = slugToBrandName(slug);
  return {
    title: `محصولات برند ${name} | مُداشاپ`,
    description: `خرید محصولات برند ${name} با ضمانت اصالت و ارسال سریع در مُداشاپ.`,
    alternates: { canonical: `/brands/${slug}` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brandName = slugToBrandName(slug);

  // برند را با تطبیقِ case-insensitive پیدا کن (SQLite از mode پشتیبانی نمی‌کند)
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brand = allBrands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
  if (!brand) notFound();

  const allProducts = await fetchMazonProducts();
  const filtered = allProducts.filter((p) => p.brand?.toLowerCase() === brand.name.toLowerCase());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `برند ${brand.name}`,
    description: `محصولات برند ${brand.name} در مُداشاپ`,
    url: `/brands/${slug}`,
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-xs text-[var(--color-muted)] mb-4">
        <Link href="/" className="hover:underline">خانه</Link> <span className="mx-1">/</span>
        <Link href="/brands" className="hover:underline">برندها</Link> <span className="mx-1">/</span>
        <span className="font-bold text-[var(--color-ink)]">{brand.name}</span>
      </nav>

      <h1 className="text-2xl font-extrabold mb-2">{brand.name}</h1>
      <p className="text-sm text-[var(--color-muted)] mb-4">{filtered.length} محصول یافت شد</p>

      {filtered.length === 0 ? (
        <p className="text-[var(--color-muted)]">محصولی برای این برند یافت نشد.</p>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <GridViewToggle />
          </div>
          <ProductGrid className="sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductGrid>
        </>
      )}
    </div>
  );
}
