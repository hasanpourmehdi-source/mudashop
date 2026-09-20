import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { invalidateCampaignFormulaCache } from "@/lib/trendyolTitleTranslation";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const results = await prisma.trendyolCampaignNameFormula.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ results });
}

// افزودن یه الگوی جدید -- الگو/قالب هردو با نحوِ ساده‌ی {1},{2},... نوشته می‌شن
// (نه رجکسِ خام)، ساخته/چکِ خودِ regex توی trendyolTitleTranslation.ts انجام می‌شه
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await request.json();
  const patternTr = typeof body.patternTr === "string" ? body.patternTr.trim() : "";
  const templateFa = typeof body.templateFa === "string" ? body.templateFa.trim() : "";
  const priority = typeof body.priority === "number" ? body.priority : 0;

  if (!patternTr || !templateFa) {
    return NextResponse.json({ error: "الگوی ترکی و قالبِ فارسی هر دو الزامی‌اند" }, { status: 400 });
  }

  try {
    const created = await prisma.trendyolCampaignNameFormula.upsert({
      where: { patternTr },
      create: { patternTr, templateFa, priority },
      update: { templateFa, priority },
    });
    invalidateCampaignFormulaCache();
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
