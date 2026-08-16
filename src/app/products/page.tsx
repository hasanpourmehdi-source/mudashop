import Link from "next/link";
import { fetchMazonProducts, fetchPopularityMap, fetchRatingMap } from "@/lib/products";
import { auth } from "@/lib/auth";
import { fetchWishlistedProductIds } from "@/lib/wishlist";
import { fetchCategoryTree, expandSelectedSlugs, findNodeBySlug } from "@/lib/categories";
import { fetchProductFacets, buildAvailableFacets } from "@/lib/facets";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "@/components/ProductFilters";
import { fuzzyTextMatch } from "@/lib/fuzzySearch";

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
  attrs?: string; // comma-separated "نام‌ویژگی~مقدار" (مثلا "جنسیت~زنانه,رنگ~قرمز")
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
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

  if (params.q) {
    // جست‌وجوی فازی -- غلط تایپی کوچیک رو هم تحمل می‌کنه (مثلا "کفش" به‌جای "کقش")
    filtered = filtered.filter((p) => {
      const haystack = [p.title, p.brand, p.categoryName, p.description]
        .filter(Boolean)
        .join(" ");
      return fuzzyTextMatch(params.q!, haystack);
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

  // مرتب‌سازی
  const sort = params.sort ?? "recommended";
  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isWishlisted={wishlistedIds.has(p.id)}
                activeAttrsQuery={params.attrs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
