import Link from "next/link";
import { ProductGrid, GridViewToggle } from "@/components/GridView";
import { fetchMazonProducts, fetchPopularityMap, fetchRatingMap } from "@/lib/products";
import { auth } from "@/lib/auth";
import { fetchWishlistedProductIds } from "@/lib/wishlist";
import { fetchCategoryTree, expandSelectedSlugs, findNodeBySlug } from "@/lib/categories";
import { fetchProductFacets, buildAvailableFacets } from "@/lib/facets";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "@/components/ProductFilters";
import { scoreRelevance } from "@/lib/fuzzySearch";
import { toMetaDescription } from "@/lib/seo";
import { getFeatureFlags } from "@/lib/featureFlags";
import { SITE_SETTING_KEYS } from "@/lib/siteSettings";
import type { Metadata } from "next";

// متادیتای صفحه‌ی لیست محصولات -- عنوان پویا بر اساس جستجو/دسته‌بندی انتخابی
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const parts = [params.q && `جستجو: ${params.q}`, params.flashSaleOnly === "true" && "حراج فلش", params.fastShipping === "true" && "ارسال فوری"]
    .filter(Boolean);
  const title = parts.length > 0 ? parts.join(" — ") : "محصولات";
  const description = toMetaDescription(`لیست کامل محصولات مُداشاپ${parts.length > 0 ? ` — ${parts.join("، ")}` : ""} با قیمت به‌روز، تخفیف و ارسال به سراسر کشور`);

  return {
    title,
    description,
    alternates: { canonical: "/products" },
    openGraph: { type: "website", title, description },
  };
}

type SearchParams = {
  q?: string;
  categories?: string; // comma-separated slugs
  brands?: string; // comma-separated
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  minDiscount?: string; // فقط محصولاتی که این درصد تخفیف یا بیشتر رو دارن
  sort?: string;
  fastShipping?: string; // "true" یعنی فقط محصولات ارسال فوری
  flashSaleOnly?: string; // "true" یعنی فقط محصولات در حراج فلش فعال
  defectiveOnly?: string; // "true" یعنی فقط محصولاتِ ایراد دار
  attrs?: string; // comma-separated "نام‌ویژگی~مقدار" (مثلا "جنسیت~زنانه,رنگ~قرمز")
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  const flags = await getFeatureFlags();
  const [allProducts, categoryTree, popularity, ratings, wishlistedIds] = await Promise.all([
    fetchMazonProducts(),
    fetchCategoryTree(),
    fetchPopularityMap(),
    fetchRatingMap(),
    fetchWishlistedProductIds(session?.user?.id),
  ]);

  const priceBounds = {
    min: allProducts.length ? Math.min(...allProducts.map((p) => p.price)) : 0,
    max: allProducts.length ? Math.max(...allProducts.map((p) => p.price)) : 1000000,
  };

  const categoryList = expandSelectedSlugs(
    categoryTree,
    params.categories?.split(",").filter(Boolean) ?? []
  );

  // فیلترها (جنس/الگو/برند/...) فقط باید از بین محصولات همین دسته‌بندی ساخته بشن، نه
  // کل فروشگاه -- وگرنه توی «لوازم برقی» هم فیلتر «الگو»ی پوشاک نشون داده می‌شه که
  // هیچ محصولی توی این دسته اون مقدار رو نداره
  const categoryScopedProducts =
    categoryList.length > 0
      ? allProducts.filter((p) => p.categorySlug && categoryList.includes(p.categorySlug))
      : allProducts;

  const productFacets = await fetchProductFacets(categoryScopedProducts);
  const availableFacets = buildAvailableFacets(productFacets);

  const brandList = params.brands?.split(",").filter(Boolean) ?? [];
  const minPrice = params.minPrice ? Number(params.minPrice) : priceBounds.min;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : priceBounds.max;
  const minRating = params.minRating ? Number(params.minRating) : 0;
  const minDiscount = params.minDiscount ? Number(params.minDiscount) : 0;

  // "جنسیت~زنانه,رنگ~قرمز" -> { جنسیت: ["زنانه"], رنگ: ["قرمز"] }
  const selectedAttrTokens = params.attrs?.split(",").filter(Boolean) ?? [];
  const selectedAttrsByName = new Map<string, string[]>();
  for (const token of selectedAttrTokens) {
    const [name, value] = token.split("~");
    if (!name || !value) continue;
    if (!selectedAttrsByName.has(name)) selectedAttrsByName.set(name, []);
    selectedAttrsByName.get(name)!.push(value);
  }

  let filtered = allProducts;

  // عنوان مهم‌ترینه، بعد برند و دسته‌بندی، بعد توضیحات -- امتیازها بعداً برای
  // مرتب‌سازی بر اساس ربط استفاده می‌شن (نه فقط فیلتر دودویی)
  const relevanceByProductId = new Map<string, number>();
  if (params.q) {
    filtered = filtered.filter((p) => {
      const score = scoreRelevance(params.q!, [
        { text: p.title, weight: 3 },
        { text: p.brand, weight: 2 },
        { text: p.categoryName, weight: 1 },
        // فقط برای امتیازدهیِ جست‌وجو -- تگ‌های احتمالیِ HTML (از RichTextEditor)
        // نویزن، نه محتوای واقعی؛ اینجا نیازی به sanitizerِ کامل نیست، فقط حذفِ
        // ساده‌ی تگ‌ها کافیه (نه رندر می‌شه نه ذخیره)
        { text: p.description?.replace(/<[^>]+>/g, " "), weight: 0.5 },
      ]);
      if (score > 0) relevanceByProductId.set(p.id, score);
      return score > 0;
    });
  }
  // فیلترهای چندانتخابی: داخل هر گروه OR ، بین گروه‌ها AND
  if (categoryList.length > 0) {
    filtered = filtered.filter((p) => p.categorySlug && categoryList.includes(p.categorySlug));
  }
  if (brandList.length > 0) {
    filtered = filtered.filter((p) => p.brand && brandList.includes(p.brand));
  }
  if (minRating > 0) {
    filtered = filtered.filter((p) => (ratings[p.id] ?? 0) >= minRating);
  }
  if (params.fastShipping === "true") {
    filtered = filtered.filter((p) => p.fastShipping);
  }
  if (params.flashSaleOnly === "true") {
    filtered = filtered.filter((p) => !!p.flashSale);
  }
  if (flags[SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS] && params.defectiveOnly === "true") {
    filtered = filtered.filter((p) => !!p.defectNote);
  }
  if (minDiscount > 0) {
    filtered = filtered.filter((p) => p.discount >= minDiscount);
  }
  // فیلتر ویژگی‌های عمومی (جنسیت، رنگ، ...): داخل هر ویژگی OR، بین ویژگی‌های مختلف AND
  for (const [attrName, wantedValues] of selectedAttrsByName) {
    filtered = filtered.filter((p) => {
      const productValues = productFacets[p.id]?.[attrName] ?? [];
      return wantedValues.some((v) => productValues.includes(v));
    });
  }
  filtered = filtered.filter((p) => p.price >= minPrice && p.price <= maxPrice);

  // مرتب‌سازی -- وقتی جست‌وجوی متنی داریم و کاربر خودش صراحتاً مرتب‌سازی‌ای
  // انتخاب نکرده (یعنی params.sort ست نشده)، ربط به عبارت جست‌وجو باید معیار
  // اصلی باشه، نه پرفروش‌بودن؛ وگرنه محصولی که دقیقاً همون کلمه رو توی عنوانش
  // داره ممکنه پایین‌تر از یه محصول پرفروش‌تر ولی کم‌ربط‌تر بیفته
  const sort = params.sort ?? "recommended";
  const useRelevanceSort = !!params.q && !params.sort;
  filtered = [...filtered].sort((a, b) => {
    if (useRelevanceSort) {
      const relevanceDiff = (relevanceByProductId.get(b.id) ?? 0) - (relevanceByProductId.get(a.id) ?? 0);
      if (relevanceDiff !== 0) return relevanceDiff;
    }
    switch (sort) {
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      case "discount":
        return b.discount - a.discount;
      case "popular":
        return (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0);
      case "most_viewed":
        return (b.viewCount24h ?? 0) - (a.viewCount24h ?? 0);
      case "favorited":
        return (b.wishlistCount ?? 0) - (a.wishlistCount ?? 0);
      case "most_reviewed":
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "recommended":
      default: {
        // ترکیبی از پرفروش‌بودن و امتیاز -- محصولاتی که هم پرفروش‌ترن هم امتیاز بهتری دارن جلوترن
        const scoreA = (popularity[a.id] ?? 0) * 2 + (ratings[a.id] ?? 0);
        const scoreB = (popularity[b.id] ?? 0) * 2 + (ratings[b.id] ?? 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    }
  });

  const brands = Array.from(
    new Set(categoryScopedProducts.map((p) => p.brand).filter(Boolean))
  ) as string[];

  // خلاصه‌ی فیلترهای فعال -- چه از کلیک روی منوی افقی/دسته‌بندی‌ها اومده باشن
  // چه از تیک‌زدن دستی توی سایدبار، هر دو دقیقاً همین پارامترهای URL رو
  // می‌سازن؛ پس یه خلاصه‌ی واحد از دسته‌بندی + ویژگی‌ها (جنسیت/رنگ/...) + برند
  // بالای لیست نشون می‌دیم تا مشتری دقیقاً بفهمه رو چی فیلتر شده
  const selectedCategorySlugs = params.categories?.split(",").filter(Boolean) ?? [];
  const activeFilterLabels = [
    ...selectedCategorySlugs.map((slug) => findNodeBySlug(categoryTree, slug)?.name).filter((n): n is string => !!n),
    ...selectedAttrTokens.map((token) => token.split("~")[1]).filter((v): v is string => !!v),
    ...brandList,
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 grid md:grid-cols-[240px_1fr] gap-8">
      <ProductFilters
        categories={categoryTree}
        brands={brands}
        priceBounds={priceBounds}
        availableFacets={availableFacets}
        defectiveItemsEnabled={!!flags[SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS]}
      />

      <div>
        {activeFilterLabels.length > 0 && (
          <p className="text-base font-bold mb-1">{activeFilterLabels.join(" ")}</p>
        )}
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm text-[var(--color-muted)]">
            {filtered.length} محصول یافت شد
          </p>
          {params.fastShipping === "true" && (
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full hover:bg-emerald-100"
            >
              🚚 فقط ارسال فوری ✕
            </Link>
          )}
          {params.flashSaleOnly === "true" && (
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-wine)] bg-[var(--color-wine)]/10 px-2.5 py-1 rounded-full hover:bg-[var(--color-wine)]/20"
            >
              ⚡ فقط حراج فلش ✕
            </Link>
          )}
          {flags[SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS] && params.defectiveOnly === "true" && (
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-ochre)] bg-[var(--color-ochre)]/10 px-2.5 py-1 rounded-full hover:bg-[var(--color-ochre)]/20"
            >
              ⚠️ فقط ایراد دار ✕
            </Link>
          )}
          {minDiscount > 0 && (
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-wine)] bg-[var(--color-wine)]/10 px-2.5 py-1 rounded-full hover:bg-[var(--color-wine)]/20"
            >
              {minDiscount}% و بالاتر تخفیف ✕
            </Link>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="text-[var(--color-muted)]">محصولی با این فیلتر پیدا نشد.</p>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <GridViewToggle />
            </div>
            <ProductGrid className="sm:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isWishlisted={wishlistedIds.has(p.id)}
                  activeAttrsQuery={params.attrs}
                />
              ))}
            </ProductGrid>
          </>
        )}
      </div>
    </div>
  );
}
