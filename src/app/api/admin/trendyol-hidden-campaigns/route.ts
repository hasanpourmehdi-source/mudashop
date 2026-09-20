import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { invalidateHiddenCampaignsCache } from "@/lib/trendyolHiddenCampaigns";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const results = await prisma.trendyolHiddenCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ results });
}

// تیکِ «غیرفعال» کنارِ ترجمه‌ی هر کمپین همین‌جا رو صدا می‌زنه -- campaignId
// همون آیدیِ خودِ ترندیوله (مشترک بینِ همه‌ی محصولاتی که توی همون کمپینِ خاص
// شرکت دارن)، پس با یه‌بار مخفی‌کردن، روی *همه‌ی* محصولات اون کمپین اثر می‌ذاره
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await request.json();
  const campaignId = typeof body.campaignId === "number" ? body.campaignId : null;
  const rawNameTr = typeof body.rawNameTr === "string" ? body.rawNameTr.trim() : "";

  if (campaignId === null) {
    return NextResponse.json({ error: "campaignId الزامی است" }, { status: 400 });
  }

  try {
    const created = await prisma.trendyolHiddenCampaign.upsert({
      where: { campaignId },
      create: { campaignId, rawNameTr },
      update: {},
    });
    invalidateHiddenCampaignsCache();
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
