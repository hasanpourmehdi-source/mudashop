import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  translations: z
    .array(
      z.object({
        path: z.string().min(1),
        nameFa: z.string().min(1),
      })
    )
    .min(1),
});

// ورودی گروهی: یه آرایه از {path, nameFa} -- دقیقاً همون شکلی که فایل export
// می‌ده، به‌علاوه‌ی nameFa که کلود (یا هرکسی) پرش کرده. کلید تطبیق "path"ه
// (نه param)، چون path یکتاست ولی param می‌تونه بین چندتا مسیر مشترک باشه.
// این ترجمه‌ها nameFaSuggested=true ثبت می‌شن (چون مترجم AI/انسان بیرونیه، نه
// خودِ ادمین از پنل) -- ادمین می‌تونه بعداً با فیلتر «فقط پیشنهادی» روشون مرور کنه.
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const { translations } = parsed.data;
  let updated = 0;
  let notFound = 0;

  const BATCH_SIZE = 200;
  for (let i = 0; i < translations.length; i += BATCH_SIZE) {
    const batch = translations.slice(i, i + BATCH_SIZE);
    const results = await prisma.$transaction(
      batch.map((t) =>
        prisma.trendyolCategoryCache.updateMany({
          where: { path: t.path },
          data: { nameFa: t.nameFa, nameFaSuggested: true },
        })
      )
    );
    for (const r of results) {
      if (r.count > 0) updated++;
      else notFound++;
    }
  }

  return NextResponse.json({ updated, notFound, total: translations.length });
}
