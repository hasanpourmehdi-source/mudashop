import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { PaymentStatus } from "@prisma/client";

const VALID_PAYMENT_STATUSES = new Set(Object.values(PaymentStatus));

// paymentStatus/q اختیاری‌ان -- فقط وقتی پنل «افزودن به سفارش» (از صفحه‌ی
// محصول) داره سفارش‌های قابل‌ویرایش (PENDING) رو با کد/اسم مشتری جستجو می‌کنه
// استفاده می‌شن؛ لیست کامل سفارش‌ها (/admin/orders) بدون این پارامترها صدا زده می‌شه
export async function GET(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rawPaymentStatus = searchParams.get("paymentStatus");
  const paymentStatus =
    rawPaymentStatus && VALID_PAYMENT_STATUSES.has(rawPaymentStatus as PaymentStatus)
      ? (rawPaymentStatus as PaymentStatus)
      : null;
  const q = searchParams.get("q")?.trim();
  // جست‌وجو با تگِ فیزیکی یه قلم خارجی (فاز پیگیری خرید) -- برای پیدا کردن
  // سریع سفارش از روی تگ، مستقل از q/paymentStatus
  const tag = searchParams.get("tag")?.trim();

  const orders = await prisma.order.findMany({
    where: {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(tag ? { items: { some: { purchaseTag: tag } } } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { user: { name: { contains: q } } },
              { user: { email: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { items: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    ...(q || paymentStatus || tag ? { take: 20 } : {}),
  });
  return NextResponse.json(orders);
}
