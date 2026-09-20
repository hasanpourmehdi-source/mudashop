import { notFound } from "next/navigation";
import Link from "next/link";
import { SEO_LANDINGS, getLandingBySlug } from "@/data/seoLandings";
import { fetchMazonProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { scoreRelevance } from "@/lib/fuzzySearch";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return SEO_LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = getLandingBySlug(slug);
  if (!landing) return {};
  return {
    title: landing.title,
    description: landing.description,
    keywords: landing.keywords,
    alternates: { canonical: `/landings/${slug}` },
    openGraph: { title: landing.title, description: landing.description, type: "website" },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = getLandingBySlug(slug);
  if (!landing) notFound();

  const allProducts = await fetchMazonProducts();

  // فیلترِ از پیش‌تعریف‌شده‌ی لندینگ -- همون منطقِ /products ولی با فیلترِ ثابت
  let filtered = allProducts;
  if (landing.filter.q) {
    filtered = filtered.filter((p) => {
      const score = scoreRelevance(landing.filter.q!, [
        { text: p.title, weight: 3 },
        { text: p.brand, weight: 2 },
        { text: p.categoryName, weight: 1 },
        { text: p.description?.replace(/<[^>]+>/g, " "), weight: 0.5 },
      ]);
      return score > 0;
    });
  }
  if (landing.filter.categories?.length) {
    filtered = filtered.filter((p) => p.categorySlug && landing.filter.categories!.includes(p.categorySlug));
  }
  if (landing.filter.brands?.length) {
    filtered = filtered.filter((p) => p.brand && landing.filter.brands!.includes(p.brand));
  }
  if (landing.filter.minPrice != null) {
    filtered = filtered.filter((p) => p.price >= landing.filter.minPrice!);
  }
  if (landing.filter.maxPrice != null) {
    filtered = filtered.filter((p) => p.price <= landing.filter.maxPrice!);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: landing.h1,
    description: landing.description,
    url: `/landings/${slug}`,
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* بریدکرامپ */}
      <nav className="text-xs text-[var(--color-muted)] mb-4">
        <Link href="/" className="hover:underline">خانه</Link> <span className="mx-1">/</span>
        <Link href="/landings" className="hover:underline">کالکشن‌ها</Link> <span className="mx-1">/</span>
        <span className="font-bold text-[var(--color-ink)]">{landing.h1}</span>
      </nav>

      <h1 className="text-2xl font-extrabold mb-2">{landing.h1}</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6 max-w-3xl leading-relaxed">{landing.intro}</p>

      <p className="text-sm text-[var(--color-muted)] mb-4">{filtered.length} محصول یافت شد</p>

      {filtered.length === 0 ? (
        <p className="text-[var(--color-muted)]">محصولی با این فیلتر پیدا نشد.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* متن سئو -- زیرِ محصولات مثل تگموند */}
      <section className="max-w-3xl border-t cut-line pt-8">
        <h2 className="font-bold mb-3">راهنمای خرید {landing.h1}</h2>
        <div className="text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-line">{landing.seoText}</div>
        <div className="mt-6 flex flex-wrap gap-2">
          {landing.keywords.map((kw) => (
            <span key={kw} className="text-xs bg-[var(--color-linen-dim)] rounded-full px-3 py-1">
              {kw}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
