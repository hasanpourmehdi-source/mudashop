import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// پیگیریِ سفارش برای «خریدِ مهمان» -- بدون لاگین، فقط با شناسه‌ی سفارش + همان
// ایمیلی که موقع خرید داده شده. عمداً محدود و read-only است (بدون پیام/مرجوعی/
// لغو -- اون‌ها فقط با حساب کاربری واقعی در دسترس‌اند)
const schema = z.object({
  orderId: z.string().min(8),
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "شناسه سفارش و ایمیل معتبر لازم است" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      user: { select: { email: true } },
      items: {
        select: { source: true, purchaseStatus: true, quantity: true, title: true, price: true, image: true, variantLabel: true },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
      shippingPayment: { select: { status: true } },
    },
  });

  if (!order || order.user.email.toLowerCase() !== parsed.data.email.trim().toLowerCase()) {
    return NextResponse.json({ error: "سفارشی با این مشخصات پیدا نشد" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentAuthority: order.paymentAuthority,
    itemsNegotiationStatus: order.itemsNegotiationStatus,
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    hasExternalItems: order.items.some((i) => i.source === "TRENDYOL"),
    shippingPayment: order.shippingPayment,
    items: order.items,
    shippingMethod: order.shippingMethod,
    createdAt: order.createdAt.toISOString(),
    packageStatuses: order.packageStatuses,
    total: order.total,
    trackingCode: order.trackingCode,
  });
}
