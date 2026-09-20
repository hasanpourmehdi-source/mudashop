import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { siteSlugToKind } from "@/lib/trendyol";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// برخلاف حالت صفر-محصول (که خودکار توی marketplaces/[slug]/page.tsx تشخیص
// داده می‌شه)، بعضی دسته‌های میلا نتیجه‌ی غیرصفر ولی کاملاً بی‌ربط برمی‌گردونن
// (مثلاً «اتو» یه مشت روتختی می‌ده) -- این فقط با چشمِ ادمین قابل‌تشخیصه، برای
// همین این‌جا همون confirmedEmpty رو دستی (نه خودکار) ست می‌کنیم؛ اثرش دقیقاً
// یکیه: این param دیگه توی لیست دسته‌بندی‌های همین سایت پیشنهاد نمی‌شه
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { slug } = await params;
  const site = siteSlugToKind(slug);
  const body = await request.json().catch(() => ({}));
  const param = typeof body?.param === "string" ? body.param.trim() : "";
  if (!param) {
    return NextResponse.json({ error: "param لازمه" }, { status: 400 });
  }

  const { count } = await prisma.trendyolCategoryCache.updateMany({
    where: { site, param },
    data: { confirmedEmpty: true, confirmedEmptyAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: count });
}
