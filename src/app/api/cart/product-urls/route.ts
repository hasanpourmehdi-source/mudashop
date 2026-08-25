import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // کلاینت‌های adjacent (مثلidebar/سیل) ممکن است فقط contentId داشته باشند.
    // این endpoint فقط آدرس‌های کش شده رو برگردارد تا Cart page بتواند لینک درست بسازه.
    const rows = await prisma.trendyolProductUrlCache.findMany({
      select: { contentId: true, url: true },
    });
    const urlMap = rows.reduce((acc, { contentId, url }) => {
      acc[contentId] = url;
      return acc;
    }, {} as Record<string, string>);
    return NextResponse.json({ urlMap });
  } catch (err) {
    console.error("Error fetching cart product URLs:", err);
    return NextResponse.json({ urlMap: {} }, { status: 500 });
  }
}