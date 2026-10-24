import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { cacheTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { translateTrendyolAttributeText, translateSearchQueryToTurkish } from "@/lib/trendyolTitleTranslation";
import {
  parseTrendyolInput,
  buildProductIdTag,
  siteSlugFromUrl,
  getDiscountPercent,
  translateAgeSizeLabel,
  isTrendyolShortLink,
  resolveTrendyolShortLink,
} from "@/lib/poster";
import { prisma } from "@/lib/prisma";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// کدهای معمولِ سایز (حرف/عدد کوتاه مثلِ S، M، ۳۶، ۲XL) نیازی به ترجمه ندارن؛
// فقط وقتی سایز یک *کلمه‌ی* واقعیه (مثل "Standart") باید از دیکشنری رد شود
async function translateSizeLabelForPoster(size: string): Promise<string> {
  const ageLabel = translateAgeSizeLabel(size);
  if (ageLabel) return ageLabel;
  if (!/[A-Za-zÇŞĞİÖÜçşğıöü]{4,}/.test(size)) return size;
  return translateTrendyolAttributeText(size);
}

// ابزار ادمین «پوستر اینستاگرام»:
//  - action=search  : جستجوی زنده در ترندیول (برای اینکه ادمین محصول را پیدا کند)
//  - action=detail  : جزئیات کامل یک محصول (تصاویر، ویژگی‌ها، سایزها، قیمت) برای ساخت پوستر
export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  let body: {
    action?: string;
    query?: string;
    input?: string;
    contentId?: string;
    url?: string;
    name?: string;
    image?: string | null;
    price?: number | null;
    originalPrice?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }

  const action = body.action;

  if (action === "search") {
    const query = (body.query ?? "").trim();
    if (query.length < 2) {
      return NextResponse.json({ error: "حداقل ۲ حرف وارد کنید" }, { status: 400 });
    }
    try {
      // نکته‌ی مهم: قبلاً این جستجو مستقیم به public.trendyol.com/discovery-web-
      // searchgw-service می‌زد -- یه اندپوینتِ آزمایشی/غیررسمی که از اول با
      // هشدارِ صریح مستند شده بود («ممکنه بدون اطلاع قبلی قطع بشه»؛ ببین
      // trendyol.ts بالای searchTrendyolLive). دقیقاً همون اتفاق افتاد: الان
      // این دامنه اصلاً DNS نداره. به‌جاش از همون مکانیزمِ اثبات‌شده و
      // زنده‌ی بقیه‌ی سایت (اسکرپِ HTML صفحه‌ی /sr?q=... با
      // fetchTrendyolProductsFromUrl، دقیقاً همون چیزی که marketplaces/[slug]
      // برای جستجوی مشتری استفاده می‌کنه) استفاده می‌کنیم
      const site = await prisma.externalSite.findUnique({ where: { slug: "trendyol" } });
      if (!site) {
        return NextResponse.json({ error: "سایتِ ترندیول در «سایت‌های خارجی» تعریف نشده" }, { status: 400 });
      }
      const { translated: translatedQuery, droppedWords } = await translateSearchQueryToTurkish(query);
      const q = encodeURIComponent(translatedQuery);
      const searchUrl = `${site.baseUrl}q=${q}&qt=${q}&st=${q}&os=1`;
      const { products, total } = await fetchTrendyolProductsFromUrl(searchUrl, { allowStale: false });
      return NextResponse.json({
        totalCount: total,
        droppedWords,
        products: products.map((p) => ({
          id: String(p.id),
          name: p.name,
          image: p.image,
          price: p.price,
          originalPrice: p.originalPrice,
          url: p.url,
          category: p.category,
        })),
      });
    } catch (err) {
      return NextResponse.json({ error: "جستجو در ترندیول ناموفق بود", detail: String(err) }, { status: 502 });
    }
  }

  if (action === "detail") {
    let input = (body.input ?? "").trim();
    // لینکِ کوتاهِ اپِ ترندیول (ty.gl) -- قبل از parseTrendyolInput باید به
    // لینکِ کاملِ محصول حل بشه، وگرنه parseTrendyolInput ردش می‌کنه
    if (isTrendyolShortLink(input)) {
      const resolved = await resolveTrendyolShortLink(input);
      if (!resolved) {
        return NextResponse.json(
          { error: "لینکِ کوتاه باز نشد -- لینکِ کاملِ محصول را مستقیم بچسبانید" },
          { status: 400 }
        );
      }
      input = resolved;
    }
    const parsed = parseTrendyolInput(input);
    if (!parsed) {
      return NextResponse.json(
        { error: "لینک یا شناسه‌ی محصول ترندیول معتبر نیست" },
        { status: 400 }
      );
    }

    let url: string | null = parsed.type === "url" ? parsed.url : null;
    let contentId: string | null = parsed.type === "contentId" ? parsed.contentId : null;

    if (!url && contentId) {
      const cached = await getCachedTrendyolUrlSafe(contentId);
      url = cached;
      if (!url) {
        return NextResponse.json(
          { error: "لینک این محصول در حافظه نیست؛ لینک کامل را وارد کنید" },
          { status: 404 }
        );
      }
    }

    try {
      const detail = await fetchTrendyolProductDetail(url!);
      if (!detail) {
        return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
      }
      if (detail.contentId && url) {
        await cacheTrendyolProductUrl(detail.contentId, url);
      }
      contentId = detail.contentId || contentId;
      const sizes = await Promise.all(detail.sizes.map(translateSizeLabelForPoster));
      // معادلِ فارسیِ برند -- فقط وقتی توی دیکشنری اضافه شده باشه (مثلِ بقیه‌ی
      // کلماتِ ناشناخته)؛ وگرنه همون اسمِ لاتینِ اصلی برمی‌گرده و توی هشتگ‌ها
      // (طبقِ isValidHashtagToken) فیلتر می‌شه -- پس بدونِ ترجمه هیچ تغییری نمی‌کنه
      const brandFa = detail.brand ? await translateTrendyolAttributeText(detail.brand) : null;
      const finalUrl = detail.url || url || "";
      const previousPosts = contentId
        ? await prisma.instagramPosterLog.findMany({
            where: { contentId, siteSlug: siteSlugFromUrl(finalUrl) },
            orderBy: { postedAt: "desc" },
            take: 5,
            select: { postedAt: true },
          })
        : [];
      return NextResponse.json({
        contentId,
        name: detail.name,
        nameFa: detail.nameFa,
        brand: detail.brand,
        brandFa,
        categoryName: detail.categoryName,
        images: detail.images,
        attributes: detail.attributes,
        sizes,
        colorCount: detail.colorVariants?.length ?? 0,
        // رنگِ فعلی حذف می‌شه -- فقط رنگ‌های *دیگر* برای عکسِ اضافه‌ی
        // «رنگ‌های دیگر موجود» لازمه
        colorVariants: (detail.colorVariants ?? [])
          .filter((v) => v.contentId !== detail.contentId)
          .map((v) => ({ colorName: v.colorName, image: v.image })),
        price: detail.price,
        originalPrice: detail.originalPrice,
        priceTL: detail.priceTL,
        originalPriceTL: detail.originalPriceTL,
        // یعنی price/originalPriceTL بالا از قبل یه تخفیفِ سبدخریدِ ترندیول
        // («Sepette %X İndirim») توش خورده -- currentSeller.campaignLabel
        // دقیقاً همون‌جایی ساخته می‌شه که discountedPrice از sellingPrice
        // کمتره (ببین computePriceInfo توی trendyolProductDetail.ts). وقتی
        // این true باشه، دیگه نباید campaignBadges (پایین‌تر، برای
        // basketDiscountPct) هم دوباره روی همین قیمت اعمال بشه -- وگرنه یه
        // تخفیفِ سبدخریدِ واحد دوبار حساب می‌شه و درصد/قیمتِ نهایی اشتباه
        // می‌شه (باگی که واقعاً رخ داده بود)
        priceIncludesBasketDiscount: Boolean(detail.currentSeller?.campaignLabel),
        inStock: detail.inStock,
        url: detail.url || url,
        tag: buildProductIdTag(detail.contentId || contentId),
        campaignBadges: detail.campaignBadges,
        previousPosts: previousPosts.map((p) => ({ postedAt: p.postedAt.toISOString() })),
      });
    } catch (err) {
      return NextResponse.json(
        { error: "دریافت جزئیات محصول ناموفق بود", detail: String(err) },
        { status: 502 }
      );
    }
  }

  if (action === "logPosted") {
    const contentId = (body.contentId ?? "").trim();
    const url = (body.url ?? "").trim();
    if (!contentId || !url) {
      return NextResponse.json({ error: "contentId/url لازم است" }, { status: 400 });
    }
    await prisma.instagramPosterLog.create({
      data: {
        contentId,
        siteSlug: siteSlugFromUrl(url),
        name: body.name || "",
        image: body.image || null,
        price: body.price != null ? Math.round(body.price) : null,
        originalPrice: body.originalPrice != null ? Math.round(body.originalPrice) : null,
        discountPercent: getDiscountPercent(body.price, body.originalPrice),
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
}

// خواندن کش لینک بدون throw
async function getCachedTrendyolUrlSafe(contentId: string): Promise<string | null> {
  try {
    const { getCachedTrendyolProductUrl } = await import("@/lib/trendyolProductUrlCache");
    return await getCachedTrendyolProductUrl(contentId);
  } catch {
    return null;
  }
}