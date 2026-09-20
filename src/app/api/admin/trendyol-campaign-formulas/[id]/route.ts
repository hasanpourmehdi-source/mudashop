import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import { invalidateCampaignFormulaCache } from "@/lib/trendyolTitleTranslation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const data: Prisma.TrendyolCampaignNameFormulaUpdateInput = {};
  if (typeof body.patternTr === "string") data.patternTr = body.patternTr.trim();
  if (typeof body.templateFa === "string") data.templateFa = body.templateFa.trim();
  if (typeof body.priority === "number") data.priority = body.priority;

  try {
    const updated = await prisma.trendyolCampaignNameFormula.update({ where: { id }, data });
    invalidateCampaignFormulaCache();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "ردیف پیدا نشد یا خطا در ذخیره‌سازی" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.trendyolCampaignNameFormula.delete({ where: { id } });
    invalidateCampaignFormulaCache();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "ردیف پیدا نشد یا خطا در حذف" }, { status: 400 });
  }
}
