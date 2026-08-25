import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ endpoint: z.string().url() });

// حذفِ یک subscription پوش (وقتی کاربر خودش پوش رو خاموش می‌کند، یا مرورگر
// دیگه معتبرش نمی‌داند). فقط subscriptionِ خودِ همین کاربر قابل حذفه. اگه این
// آخرین subscriptionِ کاربر بود، pushOn هم به false برمی‌گردد -- چون دیگر
// واقعاً هیچ دستگاهی برای ارسال ندارد.
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

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: session.user.id },
  });

  const remaining = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  if (remaining === 0) {
    await prisma.notificationSetting.updateMany({
      where: { userId: session.user.id },
      data: { pushOn: false },
    });
  }

  return NextResponse.json({ ok: true });
}
