import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// ثبتِ subscription پوش کاربر لاگین‌شده (بعد از pushManager.subscribe موفق
// توی کلاینت). یه endpoint می‌تونه فقط به یک کاربر تعلق داشته باشه -- اگه
// قبلاً (مثلاً برای یه کاربر دیگه‌ی همون مرورگر) ثبت شده بود، به‌روز می‌شه.
// pushOn هم همین‌جا true می‌شه تا اطلاعش با وجودِ واقعیِ subscription یکی بماند.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await prisma.$transaction([
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    }),
    prisma.notificationSetting.upsert({
      where: { userId: session.user.id },
      update: { pushOn: true },
      create: { userId: session.user.id, pushOn: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
