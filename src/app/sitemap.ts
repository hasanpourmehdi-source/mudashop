import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { fetchMazonProducts } from "@/lib/products";
import { siteUrl } from "@/lib/seo";

// نقشه‌ی سایت: صفحات ثابت + محصولات مزون + دسته‌بندی‌ها + بازارگاه‌ها +
// محصولات ترندیولی که آدرس کاملشان در کش موجود است (best-effort)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [mazonProducts, categories, externalSites, trendyolCache] = await Promise.all([
    fetchMazonProducts(),
    prisma.category.findMany({ select: { slug: true, createdAt: true } }),
    prisma.externalSite.findMany({ where: { isActive: true }, select: { slug: true, createdAt: true } }),
    prisma.trendyolProductUrlCache.findMany({
      select: { url: true, updatedAt: true },
      take: 2000,
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/marketplaces"), changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/compare"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/about"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/faq"), changeFrequency: "monthly", priority: 0.3 },
    { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const productUrls: MetadataRoute.Sitemap = mazonProducts.map((p) => ({
    url: siteUrl(`/products/mazon/${p.slugOrId}`),
    lastModified: p.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = categories.map((c) => ({
    url: siteUrl(`/products?categories=${encodeURIComponent(c.slug)}`),
    lastModified: c.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const marketplaceUrls: MetadataRoute.Sitemap = externalSites.map((s) => ({
    url: siteUrl(`/marketplaces/${s.slug}`),
    lastModified: s.createdAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // اسلاگ داخلی از آخرین بخش مسیر آدرس کامل ترندیول ساخته می‌شود
  // (مثلاً ".../prodcut/896710400-cep-detayli-..." → "896710400-cep-detayli-...")
  const trendyolUrls: MetadataRoute.Sitemap = [];
  for (const row of trendyolCache) {
    try {
      const slug = new URL(row.url).pathname.split("/").filter(Boolean).pop();
      if (slug) {
        trendyolUrls.push({
          url: siteUrl(`/products/trendyol/${encodeURIComponent(slug)}`),
          lastModified: row.updatedAt,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    } catch {
      // URL خراب -- رد شو
    }
  }

  return [...staticPages, ...productUrls, ...categoryUrls, ...marketplaceUrls, ...trendyolUrls];
}