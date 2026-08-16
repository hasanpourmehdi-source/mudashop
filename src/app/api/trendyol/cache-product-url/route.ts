import { NextResponse } from "next/server";
import { cacheTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";

// ALLOWED_HOSTS مشابه src/app/api/trendyol/live/route.ts -- فقط اجازه‌ی
// ذخیره‌ی لینک‌هایی که واقعاً به دامنه‌های ترندیول شناخته‌شده اشاره می‌کنن
const ALLOWED_HOSTS = [
  "www.trendyol.com",
  "trendyol.com",
  "www.trendyol-milla.com",
  "trendyol-milla.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const contentId = typeof body?.contentId === "string" ? body.contentId : "";
  const url = typeof body?.url === "string" ? body.url : "";

  if (!contentId || !url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "contentId یا url نامعتبر است" }, { status: 400 });
  }

  await cacheTrendyolProductUrl(contentId, url);
  return NextResponse.json({ success: true });
}
