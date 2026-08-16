import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

// خروجی JSON از ردیف‌های ترجمه‌نشده -- برای فرستادن به کلود (یا هر مترجم دیگه)
// جهت ترجمه‌ی گروهی. خروجی این روت دقیقاً همون شکلیه که روت import انتظار
// داره (فقط کافیه هر آبجکت یه nameFa بهش اضافه بشه).
export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const rows = await prisma.trendyolCategoryCache.findMany({
    where: { nameFa: null },
    select: { path: true, param: true, nameTr: true },
    orderBy: { path: "asc" },
  });

  return new NextResponse(JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="trendyol-untranslated-${rows.length}.json"`,
    },
  });
}
