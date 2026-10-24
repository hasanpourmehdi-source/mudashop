import {
  getSiteFilterOptions,
  buildExternalSiteUrl,
  resolveEffectiveFilters,
  resolveActiveFilterChips,
  decodeTrendyolCategoryParam,
  encodeTrendyolCategoryParam,
  parseSearchQueryToFilters,
  TRENDYOL_RAW_VARIANT_SENTINEL,
  TRENDYOL_RAW_CATEGORY_SENTINEL,
  TRENDYOL_RAW_COLOR_SENTINEL,
} from "@/lib/externalSites";
import { GridViewToggle } from "@/components/GridView";
import { prisma } from "@/lib/prisma";
import { fetchTrendyolProductsFromUrl, siteSlugToKind } from "@/lib/trendyol";
import { translateSearchQueryToTurkish } from "@/lib/trendyolTitleTranslation";
import { fetchDiscountSeed, type DiscountScanPlan } from "@/lib/trendyolTopDiscounts";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { auth } from "@/lib/auth";
import { fetchWishlistedTrendyolIds } from "@/lib/wishlist";
import { TrendyolLiveGrid } from "@/components/TrendyolLiveGrid";
import { ExternalSiteFilters } from "@/components/ExternalSiteFilters";
import { TrendyolSortDropdown } from "@/components/TrendyolSortDropdown";
import { ActiveFilterChipsBar } from "@/components/ActiveFilterChipsBar";
import { MobileFilterSheetProvider } from "@/components/MobileFilterSheetContext";
import { MobileFilterTriggerButton } from "@/components/MobileFilterTriggerButton";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { notFound, redirect } from "next/navigation";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// دقیقاً همون آیدی‌های واقعی مرتب‌سازی ترندیول (sst=) -- هر چیز دیگه‌ای رد می‌شه
const VALID_SORT_IDS = new Set([
  "SCORE",
  "PRICE_BY_ASC",
  "PRICE_BY_DESC",
  "MOST_RECENT",
  "BEST_SELLER",
  "MOST_FAVOURITE",
  "MOST_RATED",
]);

// مرتب‌سازیِ مجازی (نه sstِ واقعیِ ترندیول): «بیشترین تخفیف» -- ترندیول چنین
// مرتب‌سازی‌ای نداره، پس خودمون چند صفحه‌ی محصولاتِ تخفیف‌دار رو می‌گیریم و
// با درصدِ واقعی مرتب می‌کنیم (trendyolTopDiscounts.ts)
const DISCOUNT_SORT_ID = "DISCOUNT";

export default async function MarketplaceSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; attrs?: string; sst?: string; q?: string; section?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const options = await getSiteFilterOptions(slug);
  if (!options) return notFound();

  // برای نشون‌دادن قلب پرشده روی محصولاتی که از قبل توی علاقه‌مندی هستن --
  // اگه کاربر لاگین نباشه، fetchWishlistedTrendyolIds خودش Set خالی برمی‌گردونه
  const session = await auth();
  const wishlistedTrendyolIds = await fetchWishlistedTrendyolIds(session?.user?.id);
  const minDiscountPercentToShow =
    Number(await getSiteSetting(SITE_SETTING_KEYS.MIN_DISCOUNT_PERCENT_TO_SHOW)) || 2;

  // ============================================================================
  // حالت جستجوی متنی -- وقتی q توی URL باشه، کلاً به‌جای فیلتر دسته/ویژگی، یه
  // سرچ مستقیم روی endpoint سرچ ترندیول می‌زنیم. از fetchTrendyolProductsFromUrl
  // موجود استفاده می‌کنیم چون صفحه‌ی سرچ (/sr?q=...) هم دقیقاً همون
  // window["__single-search-result__PROPS"] و همون data._links.next رو داره که
  // صفحه‌ی category داره -- نیازی به parser جدا نیست.
  // ============================================================================
  if (query.q && query.q.trim().length > 0) {
    const rawQuery = query.q.trim();

    // عبارت سرچ ممکنه چندتا بعدِ متفاوت رو با هم توضیح بده («تیشرت دخترانه
    // قرمز» = دسته‌بندی + جنسیت + رنگ). هرکدوم که دقیقاً پیدا بشه، به‌جای یه
    // سرچ متنیِ خام (که سایدبار/فیلترها رو نشون نمی‌ده)، دقیقاً مثل تیک‌زدنِ
    // دستیِ همون فیلترها از سایدبار عمل می‌کنیم
    const parsedFilters = await parseSearchQueryToFilters(rawQuery, slug);
    // اگه بخشی از عبارتِ سرچ نه فیلتر (جنسیت/رنگ) بود نه اسمِ دقیقِ یه
    // دسته‌بندی، نباید میان‌بُرِ فیلتر رو بزنیم -- وگرنه همون بخش (که شاید توی
    // دیکشنریِ ترجمه معنی داشته باشه، مثلاً «فری‌سایز») کاملاً گم می‌شه و نتیجه
    // فقط بر اساسِ فیلترهای ناقص (مثلاً فقط رنگِ سبز، بدون دسته‌بندی) میاد --
    // در این حالت به سرچِ متنیِ کامل (پایین) برمی‌گردیم که همه‌ی کلمات رو از
    // دیکشنری رد می‌کنه
    if (
      !parsedFilters.hasLeftoverWords &&
      (parsedFilters.categoryParam || parsedFilters.gender || parsedFilters.colorValueId)
    ) {
      const tokens: string[] = [];
      if (parsedFilters.categoryParam) {
        tokens.push(`${TRENDYOL_RAW_CATEGORY_SENTINEL}~${encodeTrendyolCategoryParam(parsedFilters.categoryParam)}`);
      }
      if (parsedFilters.gender) tokens.push(`جنسیت~${parsedFilters.gender}`);
      if (parsedFilters.colorValueId) tokens.push(`${TRENDYOL_RAW_COLOR_SENTINEL}~${parsedFilters.colorValueId}`);
      const redirectParams = new URLSearchParams();
      redirectParams.set("attrs", tokens.join(","));
      if (query.sst) redirectParams.set("sst", query.sst);
      redirect(`/marketplaces/${slug}?${redirectParams.toString()}`);
    }

    const { translated: translatedQuery } = await translateSearchQueryToTurkish(rawQuery);
    const q = encodeURIComponent(translatedQuery);
    const sst = query.sst && VALID_SORT_IDS.has(query.sst) ? query.sst : null;
    // baseUrl همیشه با "?" تمام می‌شه (مثلاً "https://www.trendyol.com/sr?")
    const searchUrl = `${options.site.baseUrl}q=${q}&qt=${q}&st=${q}&os=1${sst ? `&sst=${sst}` : ""}`;

    let initialProducts: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
    let initialNextUrl: string | null = null;
    let initialTotal: number | null = null;
    let loadError = "";
    let staleSince: string | null = null;

    console.log(`[marketplaces/${slug}] searching:`, searchUrl);
    try {
      const result = await fetchTrendyolProductsFromUrl(searchUrl);
      initialProducts = result.products;
      initialNextUrl = result.nextUrl;
      initialTotal = result.total;
      staleSince = result.staleSince ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطا در دریافت نتایج جستجو";
      console.warn(`[marketplaces/${slug}] search failed:`, searchUrl, message);
      await logTrendyolFetchFailure({ url: searchUrl, error: message, source: "search", siteSlug: slug });
      loadError = `${message}\nURL: ${searchUrl}`;
    }

    return (
      <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-8 md:pt-8">
        {loadError ? (
          <p className="text-sm text-[var(--color-muted)]">
            مشکلی پیش اومد، لطفاً بعداً دوباره تلاش کنید.
          </p>
        ) : (
          <div className="grid md:grid-cols-[240px_1fr] gap-8">
            {/* عبارت سرچ دقیقاً اسمِ یه دسته نبود (وگرنه از بالا ریدایرکت شده
                بودیم) -- ولی همچنان سایدبار رو نشون می‌دیم تا کاربر بتونه از
                همینجا با یه دسته‌بندی/فیلتر واقعی نتیجه رو محدودتر کنه */}
            <ExternalSiteFilters
              siteSlug={slug}
              categories={options.categories}
              attributeFilters={options.attributeFilters}
              isAdmin={session?.user?.role === "ADMIN"}
            />
            <div>
              {/* طبقِ درخواستِ صریح، این ردیف (عنوان/تعداد + مرتب‌سازی) موقعِ
                  اسکرول ثابت می‌مونه، درست زیرِ هدرِ سایت. دو مقدارِ متفاوت
                  برای topِ چسبناک لازمه چون ارتفاعِ خودِ هدر بسته به breakpoint
                  فرق می‌کنه: زیرِ lg، ردیفِ جستجو/دسته‌بندیِ موبایل (MobileMenu)
                  هم جزوِ هدره و هیچ‌وقت جمع نمی‌شه (~۱۱۴px مجموعاً)؛ از lg به
                  بالا اون ردیف اصلاً رندر نمی‌شه (lg:hidden) و هدر با اسکرول
                  به همون ردیفِ اصلی (h-16=۶۴px) جمع می‌شه */}
              {/* z-30 نه z-20 -- دکمه‌ی «نگاه سریع» روی کارتِ محصولات هم z-20
                  داره و پایین‌تر از این نوار (توی DOM) میاد؛ چون sticky خودش
                  یه stacking context جدید می‌سازه، z-40ِ منوی سورت داخلِ همین
                  نوار محدود به همین context می‌مونه و اگه خودِ نوار z-20 باشه
                  (مساوی با دکمه‌ی نگاه‌سریع)، دکمه چون بعداً توی DOM میاد
                  می‌شینه روش. z-30 (هم‌سطحِ خودِ هدر، که هم‌پوشانیِ فضایی
                  نداره) این مشکل رو حل می‌کنه */}
              <div className="sticky top-[114px] lg:top-16 z-30 bg-[var(--color-linen)]/95 backdrop-blur flex items-center justify-between gap-3 py-2 mb-3 flex-wrap">
                <h2 className="text-lg font-bold">
                  نتایج جستجو برای «{rawQuery}»
                  {initialTotal !== null && (
                    <span className="text-sm font-normal text-[var(--color-muted)] mr-2">
                      {initialTotal.toLocaleString("fa-IR")}+ محصول
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <GridViewToggle />
                  <TrendyolSortDropdown />
                </div>
              </div>
              <StaleResultsNotice staleSince={staleSince} />
              {initialProducts.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">محصولی با این جستجو پیدا نشد.</p>
              ) : (
                <TrendyolLiveGrid key={searchUrl} initialProducts={initialProducts} initialNextUrl={initialNextUrl} initialWishlistedIds={Array.from(wishlistedTrendyolIds)} minDiscountPercentToShow={minDiscountPercentToShow} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // توکن‌های "نامویژگی~مقدار" -- دقیقاً همون قرارداد فیلترهای مزون، چون هر
  // ویژگی (مثلا زیر سرگروه «سایز») می‌تونه چندتا مقدار هم‌زمان انتخاب‌شده داشته باشه
  const attrTokens = query.attrs?.split(",").filter(Boolean) ?? [];
  const tokenAttrs: { attributeName: string; value: string }[] = [];
  for (const token of attrTokens) {
    const [attributeName, value] = token.split("~");
    if (attributeName && value) tokenAttrs.push({ attributeName, value });
  }

  const { categorySlug: effectiveCategorySlug, attrs: effectiveAttrs } = await resolveEffectiveFilters(
    slug,
    query.category || null,
    tokenAttrs,
    query.section || null
  );

  // اگه resolveEffectiveFilters یه پیش‌فرض (مثلا جنسیت) اضافه کرد که توی URL
  // فعلی نبود، به‌جای اینکه این پیش‌فرض رو نامرئی توی fetch اعمال کنیم، اول
  // کاربر رو به همون URL ولی با پارامتر صریح ریدایرکت می‌کنیم. این‌طوری:
  // - توی نوار آدرس واقعاً می‌بینی چی اعمال شده (مثلا attrs=جنسیت~زنانه)
  // - چک‌باکس «جنسیت: زنانه» توی سایدبار هم تیک‌خورده نشون داده می‌شه، نه خالی
  // - کاربر می‌تونه آگاهانه عوضش کنه به «مردانه»، نه اینکه ندونه اصلاً اعمال شده
  const categoryWasAdded = effectiveCategorySlug !== (query.category || null);
  const attrsWereAdded = effectiveAttrs.length !== tokenAttrs.length;
  if (categoryWasAdded || attrsWereAdded) {
    const redirectParams = new URLSearchParams();
    if (effectiveCategorySlug) redirectParams.set("category", effectiveCategorySlug);
    if (effectiveAttrs.length > 0) {
      redirectParams.set("attrs", effectiveAttrs.map((a) => `${a.attributeName}~${a.value}`).join(","));
    }
    if (query.sst) redirectParams.set("sst", query.sst);
    // section فقط سمت کلاینت (توی ExternalSiteFilters) استفاده می‌شه، سرور بهش
    // کاری نداره -- ولی باید از این ریدایرکت جون به در ببره، وگرنه با ریدایرکت
    // گم می‌شه و سایدبار دیگه نمی‌فهمه کدوم بخش انتخاب شده بود
    if (query.section) redirectParams.set("section", query.section);
    redirect(`/marketplaces/${slug}?${redirectParams.toString()}`);
  }

  const url = await buildExternalSiteUrl(slug, effectiveCategorySlug, effectiveAttrs);
  const sst = query.sst && VALID_SORT_IDS.has(query.sst) ? query.sst : null;
  const urlWithSort = url && sst ? `${url}&sst=${sst}` : url;

  let initialProducts: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  let initialNextUrl: string | null = null;
  let initialTotal: number | null = null;
  let resolvedCategoryIds: string[] = [];
  let loadError = "";
  let staleSince: string | null = null;

  // «بیشترین تخفیف»: همه‌ی فیلترهای کاربر (دسته‌بندی، جنسیت، رنگ، سایز، ...) می‌مونن و
  // فیلترهای تخفیف (تگِ آوانتاژی / کم‌ترین قیمتِ ۳۰ روز) روشون اضافه می‌شن --
  // خودِ تابع (fetchDiscountSeed + TrendyolLiveGrid) اضافه‌شون می‌کنه
  const isDiscountSort = query.sst === DISCOUNT_SORT_ID;
  let discountMode: DiscountScanPlan | undefined;
  const discountBaseUrl = isDiscountSort ? url : null;

  if (isDiscountSort && discountBaseUrl) {
    try {
      const result = await fetchDiscountSeed(discountBaseUrl, {
        hasAdvantageTag: siteSlugToKind(slug) !== "TRENDYOL_MILLA",
      });
      initialProducts = result.products;
      initialNextUrl = null;
      initialTotal = result.products.length;
      discountMode = { seedNextUrl: result.seedNextUrl, scanUrl: result.scanUrl };
    } catch (err) {
      loadError = err instanceof Error ? err.message : "خطا در دریافت محصولاتِ تخفیف‌دار";
    }
  } else if (url) {
    // لاگ سمت سرور -- توی ترمینال npm run dev دیده می‌شه، نه Console مرورگر،
    // چون این fetch سمت سرور (Server Component) انجام می‌شه
    console.log(`[marketplaces/${slug}] fetching:`, urlWithSort);
    try {
      const result = await fetchTrendyolProductsFromUrl(urlWithSort!);
      initialProducts = result.products;
      initialNextUrl = result.nextUrl;
      initialTotal = result.total;
      staleSince = result.staleSince ?? null;
      resolvedCategoryIds = result.resolvedCategoryIds ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطا در دریافت محصولات";
      console.warn(`[marketplaces/${slug}] failed:`, urlWithSort, message);
      await logTrendyolFetchFailure({ url: urlWithSort!, error: message, source: "page-load", siteSlug: slug });
      // خودِ URL ساخته‌شده رو هم توی پیام خطا نشون می‌دیم -- برای دیباگ سریع، بدون
      // نیاز به سراغ رفتن ترمینال هر بار
      loadError = `${message}\nURL: ${urlWithSort}`;
    }
  }

  // میلا منوی دسته‌بندیِ درختیِ خودش رو ندارد -- دسته‌بندی‌های ترندیول به‌عنوان
  // نقطه‌ی شروع براش کپی شدن، ولی خیلی‌هاشون روی میلا محصولی ندارن. این‌جا
  // (نه یه sync دستیِ جداگانه) دقیقاً همون لحظه‌ایه که واقعاً می‌فهمیم یه
  // دسته‌ی خاص روی همین سایت خالیه -- فقط وقتی که تنها فیلترهای فعال همین
  // دسته (و شاید جنسیت همراهش) باشن، نه وقتی برند/سایز/... دیگه‌ای هم انتخاب
  // شده (وگرنه صفر شدن نتیجه ممکنه به‌خاطر آن فیلترهای دیگه باشه، نه خودِ دسته)
  // توی حالتِ «بیشترین تخفیف» initialTotal شمارِ نتیجه‌ی *فیلترِ تخفیف* ـه، نه کلِ دسته --
  // صفر بودنش نباید دسته رو «خالیِ تأییدشده» (و مخفی) علامت بزنه
  if (!loadError && !query.q && !isDiscountSort) {
    const categoryToken = effectiveAttrs.find((a) => a.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL);
    const onlyCategoryAndGender = effectiveAttrs.every(
      (a) => a.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL || a.attributeName === "جنسیت"
    );
    if (categoryToken && onlyCategoryAndGender) {
      const decodedParam = decodeTrendyolCategoryParam(categoryToken.value);
      // اتحادهای چندآیدیِ ۸ بخش اصلی (rootWc) این‌جا بررسی نمی‌شن -- چون یه
      // nameTr واحد برای مقایسه ندارن؛ فقط دسته‌های تکی (drill-down واقعی) رو چک می‌کنیم
      const isSingleCategory = !decodedParam.includes(",");
      let shouldMarkEmpty = initialTotal === 0;

      if (!shouldMarkEmpty && isSingleCategory && initialTotal !== null && initialTotal > 0) {
        // نتیجه غیرصفره، ولی ممکنه این wc= روی همین سایت بی‌صدا نادیده گرفته
        // شده باشه (fallback عمومی) -- یعنی سایت اصلاً این آیدی رو به‌عنوان
        // فیلتر نپذیرفته، حتی با نتیجه‌ی غیرصفر. (نکته: مقایسه‌ی اسمِ محصولِ
        // برگشتی با nameTrِ ذخیره‌شده عمداً این‌جا نیست -- امتحان شد و false-
        // positive واقعی داد، چون خودِ ترندیول توی پاسخِ زنده‌ی سرچ، اسمِ دسته
        // رو گاهی انگلیسی برمی‌گردونه («T-Shirt») درحالی‌که توی منوی اسکرِیپ‌شده
        // ترکیه («Tişört») -- این یه اختلاف واقعیِ خودِ ترندیوله، نه نشونه‌ی خالی‌بودن)
        const numericId = decodedParam.startsWith("wc=") ? decodedParam.slice(3) : decodedParam;
        shouldMarkEmpty = !resolvedCategoryIds.includes(numericId);
      }

      if (shouldMarkEmpty) {
        await prisma.trendyolCategoryCache
          .updateMany({
            where: {
              site: siteSlugToKind(slug),
              param: decodedParam,
              confirmedEmpty: false,
            },
            data: { confirmedEmpty: true, confirmedEmptyAt: new Date() },
          })
          .catch(() => {
            // best-effort -- اگه این آپدیت شکست خورد، فقط یعنی دفعه‌ی بعد هم
            // دوباره امتحان می‌شه؛ نباید کل صفحه رو بترکونه
          });
      }
    }
  }

  // برای هرکدوم از فیلترهای فعلاً انتخاب‌شده، یه برچسب فارسی خوانا -- دسته‌بندی
  // جدا می‌شه تا توی عنوان بالای لیست نشون داده بشه (مثل «Pantolon 59961+
  // Ürün» خودِ ترندیول)، بقیه به‌صورت چیپ‌های قابل‌حذف
  const activeChips = await resolveActiveFilterChips(effectiveAttrs, slug);
  const categoryChip = activeChips.find((c) => c.token.startsWith("__trendyolCategory~"));
  const otherChips = activeChips.filter((c) => c !== categoryChip);

  // اگه سایز (Beden) از سایدبار انتخاب شده باشه، همون رو (با اسم ترکی خامش --
  // دقیقاً همون چیزی که توی product.sizes صفحه‌ی محصول هست) به کارت‌های گرید
  // پاس می‌دیم تا لینکشون به صفحه‌ی محصول همون سایز رو از قبل انتخاب کنه
  const sizeFilterEntry = effectiveAttrs.find((a) => a.attributeName === TRENDYOL_RAW_VARIANT_SENTINEL);
  let activeSizeAttrsQuery: string | undefined;
  if (sizeFilterEntry) {
    const [filterKey, valueId] = sizeFilterEntry.value.split("|");
    const cached =
      filterKey && valueId
        ? await prisma.trendyolFilterCache.findUnique({
            where: { site_filterKey_valueId: { site: siteSlugToKind(slug), filterKey, valueId } },
          })
        : null;
    if (cached?.nameTr) activeSizeAttrsQuery = `Beden~${cached.nameTr}`;
  }

  // ExternalSiteFilters حالت درون‌خودش (بخش/دسته‌ی انتخاب‌شده‌ی فعلی، مسیر
  // drill-down) رو توی useState نگه می‌داره -- وقتی کاربر از منوی افقی
  // (CategoryMegaMenu) یه بخش/جنسیت دیگه رو می‌زنه، Next.js همین Server
  // Component رو دوباره با URL تازه اجرا می‌کنه، ولی چون این کامپوننت سمت
  // کلاینت هیچ‌وقت remount نمی‌شه (props‌هاش عوض نشدن)، حالت قبلی (مثلاً
  // دسته‌بندیِ قبلاً drill-downشده) دست‌نخورده می‌مونه و روی فیلترِ تازه قاطی
  // می‌شه. کلید زیر دقیقاً همون دو سیگنالی (section، توکن دسته‌بندی خام) که
  // این حالت رو تعیین می‌کنن رو دنبال می‌کنه -- با تغییرشون، کامپوننت کامل از
  // نو mount می‌شه و حالت قبلی پاک‌سازی می‌شه؛ فیلترهای دیگه (برند/رنگ/سایز) که
  // این دو سیگنال رو تغییر نمی‌دن، باعث remount اضافی/بی‌مورد نمی‌شن
  const categoryTokenValue = effectiveAttrs.find((a) => a.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL)?.value ?? "";
  const filtersResetKey = `${query.section ?? ""}::${categoryTokenValue}`;

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-8 md:pt-8">
      {/* پایین‌تر از md، سایدبارِ فیلتر و دکمه‌ی محرکش (توی نوارِ ابزار) هردو
          state بازبودنِ شیت رو از همین Provider می‌گیرن -- طبقِ درخواستِ صریح
          که چیدمانِ موبایل مثلِ اپِ ترندیول (دکمه‌ی «فیلترها»ی جداگانه) باشه،
          نه سایدبارِ همیشه‌-بازِ وب */}
      <MobileFilterSheetProvider>
      <div className="grid md:grid-cols-[240px_1fr] gap-8">
        {/* فیلترها -- فقط دسته‌بندی‌ها و ویژگی‌هایی که واقعاً برای همین سایت نگاشت
            ثبت شده (نه کل فیلترهای مزون)، چون واکشی زنده‌ست. ظاهر و رفتار دقیقاً
            مثل فیلترهای مزون: چک‌باکسی، سرچ داخل هر بخش، اسکرول مجزا برای هر لیست */}
        <ExternalSiteFilters
          key={filtersResetKey}
          siteSlug={slug}
          categories={options.categories}
          attributeFilters={options.attributeFilters}
          isAdmin={session?.user?.role === "ADMIN"}
        />

        {/* نتایج */}
        <div>
          {loadError ? (
            <p className="text-sm text-[var(--color-muted)]">
              مشکلی پیش اومد، لطفاً بعداً دوباره تلاش کنید.
            </p>
          ) : !url ? (
            <p className="text-sm text-[var(--color-muted)]">
              برای شروع، یه فیلتر انتخاب کن یا از پنل ادمین حداقل یه نگاشت دسته‌بندی/ویژگی رو به‌عنوان
              «صفحه‌ی اول» این سایت تیک بزن.
            </p>
          ) : (
            <>
              {/* فیلترهای فعال، جلوی عنوان لیست، همه توی یه ردیف کم‌ارتفاع --
                  به‌جای دو بلوکِ جدا (عنوان+مرتب‌سازی، بعد چیپ‌ها زیرش). طبقِ
                  درخواستِ صریح، موقعِ اسکرول ثابت می‌مونه درست زیرِ هدرِ سایت.
                  دو مقدارِ topِ چسبناک لازمه چون ارتفاعِ هدر بسته به breakpoint
                  فرق می‌کنه (توضیحِ کامل بالاتر، کنارِ حالتِ سرچِ متنی) */}
              {/* z-30 نه z-20 -- همون دلیلِ حالتِ سرچِ متنی (بالاتر): دکمه‌ی
                  «نگاه سریع» روی کارت‌ها هم z-20 داره و بعداً توی DOM میاد */}
              <div className="sticky top-[114px] lg:top-16 z-30 bg-[var(--color-linen)]/95 backdrop-blur flex items-center gap-3 py-2 mb-3 flex-wrap">
                {/* برخلافِ کامنتِ قبلی («چیپ‌ها رو مخفی کردیم کافیه»)، وقتی اسمِ
                    سایت/دسته‌بندی + شمارشِ محصول (مثلاً «ترندیول میلا۳٬۱۵۹+
                    محصول») به‌تنهایی هم طولانی باشه، همون + دکمه‌های فیلتر/سورت
                    هنوز جا نمی‌شن و کلِ صفحه عرضی اسکرول می‌خوره. flex-wrap
                    (مثلِ حالتِ سرچِ متنی، بالاتر) باعث می‌شه دکمه‌های فیلتر/سورت
                    به‌جای فشاردادنِ عرض، خودشون برن خطِ بعد */}
                <h2 className="text-base font-bold shrink-0 whitespace-nowrap">
                  {categoryChip?.label ?? options.site.name}
                  {initialTotal !== null && (
                    <span className="text-xs font-normal text-[var(--color-muted)] mr-2">
                      {initialTotal.toLocaleString("fa-IR")}+ محصول
                    </span>
                  )}
                </h2>
                {/* توی موبایل جا کم میاد و باعثِ اسکرولِ افقیِ کل صفحه می‌شه -- چون
                    تعدادِ فیلترهای فعال از قبل رویِ خودِ دکمه‌ی «فیلترها» (پایین)
                    به‌عنوان بج نشون داده می‌شه، این چیپ‌ها روی موبایل زائدن؛ فقط
                    توی وب (که اون دکمه اصلاً نیست) نشون داده می‌شن */}
                <div className="hidden md:contents">
                  <ActiveFilterChipsBar
                    chips={otherChips}
                    attrsParam={query.attrs}
                    categoryParam={query.category}
                    sstParam={query.sst}
                    slug={slug}
                  />
                </div>
                <div className="shrink-0 ms-auto flex items-center gap-2">
                  <MobileFilterTriggerButton activeCount={otherChips.length} />
                  <GridViewToggle />
                  <TrendyolSortDropdown includeDiscountSort />
                </div>
              </div>
              {isDiscountSort && (
                <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
                  مرتب‌سازی بر اساسِ بیشترین تخفیف: فیلترهای خودت حفظ شده و
                  {slug === "trendyol-milla"
                    ? " فیلترِ «کم‌ترین قیمتِ ۳۰ روز اخیر» (میلا فیلترِ «آوانتاژلی» نداره) بهشون اضافه شده."
                    : " فیلترِ «آوانتاژلی» و «کم‌ترین قیمتِ ۳۰ روز اخیر» بهشون اضافه شده."} محصولات چندتا‌چندتا بررسی می‌شن و هر بار
                  دوباره بر اساسِ درصدِ تخفیف مرتب می‌شن -- نه کلِ دسته. اگه با فیلترهات محصولِ تخفیف‌داری
                  نبود، لیست خالی می‌مونه؛ یه فیلتر رو بردار.
                </p>
              )}
              <StaleResultsNotice staleSince={staleSince} />
              <TrendyolLiveGrid
                key={isDiscountSort ? `${discountBaseUrl}#discount` : urlWithSort}
                initialProducts={initialProducts}
                initialNextUrl={initialNextUrl}
                initialWishlistedIds={Array.from(wishlistedTrendyolIds)}
                activeAttrsQuery={activeSizeAttrsQuery}
                minDiscountPercentToShow={minDiscountPercentToShow}
                discountMode={discountMode}
              />
            </>
          )}
        </div>
      </div>
      </MobileFilterSheetProvider>
    </div>
  );
}

// وقتی ترندیول بلاک کرده و آخرین نتیجه‌ی ذخیره‌شده نشون داده می‌شه (fetchTrendyolProductsFromUrl)
function StaleResultsNotice({ staleSince }: { staleSince: string | null }) {
  if (!staleSince) return null;
  const hoursAgo = Math.max(1, Math.round((Date.now() - new Date(staleSince).getTime()) / 3_600_000));
  return (
    <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 mb-3 leading-relaxed">
      ترندیول الان در دسترس نیست؛ این لیست مالِ حدودِ {hoursAgo.toLocaleString("fa-IR")} ساعت پیشه و ممکنه
      قیمت یا موجودی‌ها به‌روز نباشن.
    </p>
  );
}
