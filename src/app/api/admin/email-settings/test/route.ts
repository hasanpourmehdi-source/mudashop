import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { deliverEmail } from "@/lib/outboundNotify";
import { z } from "zod";

const testSchema = z.object({
  to: z.string().email("ایمیل معتبر نیست"),
});

// ارسالِ یه ایمیلِ تستی با همون تنظیماتِ پرووایدرِ فعلی (تنظیمات سایت یا env
// var) -- برای این‌که ادمین بدونِ منتظرِ یه رویدادِ واقعی، سریع مطمئن بشه
// پرووایدر درست کانفیگ شده
export async function POST(req: Request) {
  const { ok } = await requireAdmin("SETTINGS");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const result = await deliverEmail({
    to: parsed.data.to,
    subject: "ایمیل تستیِ مُداشاپ",
    body: "این یه ایمیلِ تستی از پنلِ تنظیماتِ مُداشاپه -- اگه این رو دریافت کردی، پرووایدرِ ایمیل درست کار می‌کنه.",
  });

  return NextResponse.json(result);
}
