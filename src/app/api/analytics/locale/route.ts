import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ lang: z.string().min(2).max(35) });

// ثبتِ ناشناسِ زبانِ مرورگرِ بازدیدکننده (navigator.language) -- سیگنالِ خامِ
// تصمیم‌گیری برای اینکه آیا واقعاً ارزش دارد محتوای واقعی سایت (نه فقط قابش)
// به زبان‌های دیگر ترجمه شود. کلاینت (LocaleAnalyticsRecorder) این را حداکثر
// یک‌بار در ماه به‌ازای هر مرورگر می‌فرستد.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await prisma.visitorLocale.create({ data: { browserLang: parsed.data.lang } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
