import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchWishlistedTrendyolIds } from "@/lib/wishlist";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { translateCampaignName } from "@/lib/trendyolTitleTranslation";
import {
  getSiteFilterOptions,
  buildExternalSiteUrl,
  resolveActiveFilterChips,
} from "@/lib/externalSites";
import { TrendyolLiveGrid } from "@/components/TrendyolLiveGrid";
import { ExternalSiteFilters } from "@/components/ExternalSiteFilters";
import { TrendyolSortDropdown } from "@/components/TrendyolSortDropdown";
import { ActiveFilterChipsBar } from "@/components/ActiveFilterChipsBar";
import { ProductCampaignHeader } from "@/components/ProductCampaignHeader";
import { MobileFilterSheetProvider } from "@/components/MobileFilterSheetContext";
import { MobileFilterTriggerButton } from "@/components/MobileFilterTriggerButton";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

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

// صفحه‌ی داخلیِ خودمون برای «همه‌ی محصولاتِ یک کمپین» -- به‌جای لینک مستقیم
// به ترندیول. پارامتر `prm=` روی همون endpoint سرچِ خودِ ترندیول (`/sr?...`)
// دقیقاً همون کاری رو می‌کنه که وقتی خودِ کاربر روی کمپین کلیک می‌کند و به
// `trendyol.com/sr?prm={id}` می‌رود انجام می‌شود (تأیید‌شده با تستِ واقعی) --
// این‌جا با همون مکانیزمِ fetchTrendyolProductsFromUrl که برای صفحه‌ی فروشگاه
// (`store/[merchantId]`) هم استفاده می‌شه، فقط با پارامترِ `prm` به‌جای `mid`.
//
// طبقِ درخواستِ صریح، سورت و فیلتر (دسته‌بندی/برند/رنگ/...) هم اضافه شد --
// تأیید شده با تستِ زنده که ترندیول واقعاً prm= رو با wc=/wcl=/... هم‌زمان
// اعمال می‌کنه (نتیجه محدودتر از prm=تنها می‌شه، نه اینکه prm نادیده گرفته
// بشه)، پس همون buildExternalSiteUrl معمولی رو صدا می‌زنیم و فقط prm رو به
// انتهای URL نتیجه اضافه می‌کنیم
export default async function TrendyolCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; campaignId: string }>;
  searchParams: Promise<{ text?: string; rawNameTr?: string; category?: string; attrs?: string; sst?: string }>;
}) {
  const { slug, campaignId } = await params;
  const { text, rawNameTr, category, attrs, sst: sstParam } = await searchParams;

  const options = await getSiteFilterOptions(slug);
  if (!options) notFound();
  if (!/^\d+$/.test(campaignId)) notFound();

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const wishlistedTrendyolIds = await fetchWishlistedTrendyolIds(session?.user?.id);
  const minDiscountPercentToShow =
    Number(await getSiteSetting(SITE_SETTING_KEYS.MIN_DISCOUNT_PERCENT_TO_SHOW)) || 2;

  // طبقِ درخواستِ صریح: همون امکاناتِ ادمینِ ترجمه/تعریف‌الگو/غیرفعال‌کردن که
  // کنارِ هر کمپین توی صفحه‌ی محصول هست، اینجا (صفحه‌ی «محصولاتِ این کمپین») هم
  // باشه. rawNameTr از همون لینکی که کاربر کلیک کرده میاد (ProductCampaigns)؛
  // فقط برای ادمین و فقط وقتی rawNameTr در دسترس باشه (لینکِ قدیمی/دستی که
  // rawNameTr نداره، همون متنِ ازقبل‌ترجمه‌شده رو بدونِ این امکانات نشون می‌ده)
  const formulaMatch = isAdmin && rawNameTr ? await translateCampaignName(rawNameTr) : null;

  // توکن‌های "نامویژگی~مقدار" -- دقیقاً همون قراردادِ فیلترهای صفحه‌ی اصلیِ
  // مارکت‌پلیس. عمداً از resolveEffectiveFilters (که پیش‌فرضِ جنسیت اضافه/ریدایرکت
  // می‌کنه) استفاده نمی‌کنیم -- این‌جا یه زیرمجموعه‌ی محدودِ یه کمپینه، نه
  // مرورِ کلیِ سایت، پس نیازی به اون پیچیدگی نیست
  const attrTokens = attrs?.split(",").filter(Boolean) ?? [];
  const tokenAttrs: { attributeName: string; value: string }[] = [];
  for (const token of attrTokens) {
    const [attributeName, value] = token.split("~");
    if (attributeName && value) tokenAttrs.push({ attributeName, value });
  }

  const filtersUrl = await buildExternalSiteUrl(slug, category || null, tokenAttrs);
  const sst = sstParam && VALID_SORT_IDS.has(sstParam) ? sstParam : null;
  // اگه هیچ فیلتری انتخاب نشده، همون URLِ ساده‌ی prm=تنها؛ وگرنه prm به‌عنوانِ
  // یه پارامترِ اضافه به همون URLِ فیلترشده می‌چسبه (baseUrl خودش با "?" تمام
  // می‌شه، پس filtersUrl هم با "&" قابلِ ادامه‌دادنه)
  const searchUrl = filtersUrl
    ? `${filtersUrl}&prm=${campaignId}${sst ? `&sst=${sst}` : ""}`
    : `${options.site.baseUrl}prm=${campaignId}${sst ? `&sst=${sst}` : ""}`;

  let initialProducts: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  let initialNextUrl: string | null = null;
  let initialTotal: number | null = null;
  try {
    const result = await fetchTrendyolProductsFromUrl(searchUrl);
    initialProducts = result.products;
    initialNextUrl = result.nextUrl;
    initialTotal = result.total;
  } catch (err) {
    console.warn("خطا در واکشی محصولات کمپین ترندیول:", err);
    await logTrendyolFetchFailure({
      url: searchUrl,
      error: String(err),
      source: "search",
      siteSlug: slug,
    });
  }

  const activeChips = await resolveActiveFilterChips(tokenAttrs, slug);

  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-8 md:pt-8">
      <ProductCampaignHeader
        text={text ? text : "محصولاتِ این کمپین"}
        campaignId={Number(campaignId)}
        rawNameTr={rawNameTr ?? null}
        isAdmin={isAdmin}
        matchedFormula={formulaMatch?.matchedFormula ?? false}
        formulaId={formulaMatch?.formulaId ?? null}
        matchedPatternTr={formulaMatch?.matchedPatternTr ?? null}
        matchedTemplateFa={formulaMatch?.matchedTemplateFa ?? null}
      />

      <MobileFilterSheetProvider>
      <div className="grid md:grid-cols-[240px_1fr] gap-8">
        <ExternalSiteFilters
          siteSlug={slug}
          categories={options.categories}
          attributeFilters={options.attributeFilters}
          isAdmin={isAdmin}
        />

        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {initialTotal !== null && (
              <span className="text-xs text-[var(--color-muted)] shrink-0">
                {initialTotal.toLocaleString("fa-IR")}+ محصول
              </span>
            )}
            {/* طبقِ همون منطقِ صفحه‌ی اصلیِ مزون -- توی موبایل، تعدادِ فیلترهای
                فعال از قبل رویِ بجِ دکمه‌ی «فیلترها»ست، این چیپ‌ها زائدن */}
            <div className="hidden md:contents">
              <ActiveFilterChipsBar
                chips={activeChips}
                attrsParam={attrs}
                categoryParam={category}
                sstParam={sst ?? undefined}
                slug={slug}
                basePath={`/marketplaces/${slug}/campaign/${campaignId}`}
              />
            </div>
            <div className="shrink-0 ms-auto flex items-center gap-2">
              <MobileFilterTriggerButton activeCount={activeChips.length} />
              <TrendyolSortDropdown />
            </div>
          </div>

          {initialProducts.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">محصولی برای این کمپین (با این فیلترها) پیدا نشد.</p>
          ) : (
            <TrendyolLiveGrid
              key={searchUrl}
              initialProducts={initialProducts}
              initialNextUrl={initialNextUrl}
              initialWishlistedIds={Array.from(wishlistedTrendyolIds)}
              minDiscountPercentToShow={minDiscountPercentToShow}
            />
          )}
        </div>
      </div>
      </MobileFilterSheetProvider>
    </div>
  );
}
