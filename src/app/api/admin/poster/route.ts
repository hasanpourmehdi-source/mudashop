import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { searchTrendyolLive } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { cacheTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { translateTrendyolAttributeText } from "@/lib/trendyolTitleTranslation";
import { parseTrendyolInput, buildProductIdTag } from "@/lib/poster";

// کدهای معمولِ سایز (حرف/عدد کوتاه مثلِ S، M، ۳۶، ۲XL) نیازی به ترجمه ندارن؛
// فقط وقتی سایز یک *کلمه‌ی* واقعیه (مثل "Standart") باید از دیکشنری رد شود
async function translateSizeLabelForPoster(size: string): Promise<string> {
  if (!/[A-Za-zÇŞĞİÖÜçşğıöü]{4,}/.test(size)) return size;
  return translateTrendyolAttributeText(size);
}

// ابزار ادمین «پوستر اینستاگرام»:
//  - action=search  : جستجوی زنده در ترندیول (برای اینکه ادمین محصول را پیدا کند)
//  - action=detail  : جزئیات کامل یک محصول (تصاویر، ویژگی‌ها، سایزها، قیمت) برای ساخت پوستر
export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  let body: { action?: string; query?: string; input?: string };
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
      const { products, totalCount } = await searchTrendyolLive(query);
      return NextResponse.json({
        totalCount,
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
    const input = (body.input ?? "").trim();
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
      return NextResponse.json({
        contentId,
        name: detail.name,
        nameFa: detail.nameFa,
        brand: detail.brand,
        categoryName: detail.categoryName,
        images: detail.images,
        attributes: detail.attributes,
        sizes,
        colorCount: detail.colorVariants?.length ?? 0,
        price: detail.price,
        originalPrice: detail.originalPrice,
        priceTL: detail.priceTL,
        originalPriceTL: detail.originalPriceTL,
        inStock: detail.inStock,
        url: detail.url || url,
        tag: buildProductIdTag(detail.contentId || contentId),
        campaignBadges: detail.campaignBadges,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "دریافت جزئیات محصول ناموفق بود", detail: String(err) },
        { status: 502 }
      );
    }
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