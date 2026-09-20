import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { translateTurkishPhrase } from "@/lib/trendyolTitleTranslation";

// چک زنده (بدون کش) برای یه عنوان خاص -- برای تولتیپ «عنوان اصلی» توی پنل
// ادمین، تا همون لحظه دقیقاً همون کلماتی که با دیکشنری *فعلی* ناشناخته‌ن رو
// نشون بده (نه یه عکس‌لحظه‌ی کهنه از TrendyolTitleCache)
export async function GET(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "";
  const brand = searchParams.get("brand");
  const { unknownTerms } = await translateTurkishPhrase(title, brand);
  return NextResponse.json({ unknownTerms });
}
