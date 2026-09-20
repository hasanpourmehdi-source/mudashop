import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { computeShippingCostAdjustment, commitShippingCostAdjustment } from "@/lib/shippingCostAdjustment";
import { serializeTrackingCodes } from "@/lib/trackingCodes";
import { z } from "zod";

const schema = z.object({
  orderIds: z.array(z.string()).min(2, "حداقل ۲ سفارش برای ترکیب لازمه"),
  totalShippingCost: z.number().int().nonnegative(),
  totalCargoCost: z.number().int().nonnegative().default(0),
  // سهمِ دستیِ هر سفارش (اختیاری) -- اگه نیاد، متناسب با هزینه‌ی فعلیِ خودِ
  // هر سفارش از جمعِ کل تقسیم می‌شه
  shares: z.record(z.string(), z.number().int().nonnegative()).optional(),
  bankCardId: z.string().optional(),
  trackingCode: z.string().optional(),
});

// ترکیبِ ارسالِ چند سفارشِ جدا (مقصدِ مشترک) توی یه بسته -- هزینه‌ی جدیدِ کلی
// بینِ سفارش‌ها تقسیم می‌شه و اختلافش با هزینه‌ی قبلیِ هرکدوم (که از قبل تعیین
// شده بود) دقیقاً مثلِ تغییرِ آدرس تسویه می‌شه: رفاندِ فوری اگه ارزون‌تر شده،
// کیف‌پول+کارت اگه گرون‌تر
export async function POST(req: Request) {
  const { ok, session } = await requireAdmin("ORDERS");
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }
  const { orderIds, totalShippingCost, totalCargoCost, shares, bankCardId, trackingCode } = parsed.data;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true, shippingPayment: true },
  });
  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "بعضی از سفارش‌های انتخاب‌شده یافت نشدن" }, { status: 404 });
  }
  for (const order of orders) {
    if (order.status !== "PROCESSING" || order.paymentStatus !== "PAID") {
      return NextResponse.json(
        { error: `سفارش #${order.id.slice(-8)} در وضعیتی نیست که بشه ارسالش رو ترکیب کرد (باید در حالِ پردازش و پرداخت‌شده باشه)` },
        { status: 400 }
      );
    }
    if (order.shippingGroupId) {
      return NextResponse.json(
        { error: `سفارش #${order.id.slice(-8)} از قبل عضوِ یه گروهِ ترکیبیِ دیگه‌ست` },
        { status: 400 }
      );
    }
    if (order.shippingPayment && order.shippingPayment.status !== "PAID") {
      return NextResponse.json(
        { error: `سفارش #${order.id.slice(-8)} یه دورِ پرداختِ هزینه‌ی ارسالِ تعیین‌تکلیف‌نشده داره -- اول اون رو حل کن` },
        { status: 400 }
      );
    }
  }

  const totalNew = totalShippingCost + totalCargoCost;
  const totalOld = orders.reduce((sum, o) => sum + (o.shippingCost ?? 0) + (o.cargoCost ?? 0), 0);

  // سهمِ هر سفارش: دستیِ ادمین (shares) اگه اومده باشه، وگرنه متناسب با
  // هزینه‌ی فعلیِ خودش از جمعِ کل -- اگه جمعِ قبلی صفر بود (بی‌معنی)، مساوی تقسیم می‌شه
  function shareFor(order: (typeof orders)[number]): number {
    if (shares?.[order.id] != null) return shares[order.id];
    const ownOld = (order.shippingCost ?? 0) + (order.cargoCost ?? 0);
    if (totalOld <= 0) return Math.round(totalNew / orders.length);
    return Math.round((ownOld / totalOld) * totalNew);
  }

  const hasExternalItemsByOrder = new Map(orders.map((o) => [o.id, o.items.some((i) => i.source === "TRENDYOL")]));

  let adjustments;
  try {
    adjustments = await Promise.all(
      orders.map(async (order) => ({
        order,
        share: shareFor(order),
        adjustment: await computeShippingCostAdjustment(order, shareFor(order), {
          bankCardId,
          hasExternalItems: hasExternalItemsByOrder.get(order.id) ?? false,
        }),
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا در محاسبه" }, { status: 400 });
  }

  const shortIds = orders.map((o) => o.id.slice(-8)).join("، ");

  try {
    const group = await prisma.$transaction(async (tx) => {
      const createdGroup = await tx.shippingGroup.create({
        data: { totalShippingCost, totalCargoCost, trackingCode: trackingCode || null },
      });

      for (const { order, share, adjustment } of adjustments) {
        const description = `تسویه‌ی اختلافِ هزینه‌ی ارسال بابتِ ترکیب با سفارش‌های #${shortIds}`;
        await commitShippingCostAdjustment(tx, order, adjustment, description);

        await tx.order.update({
          where: { id: order.id },
          data: {
            shippingGroupId: createdGroup.id,
            shippingCost: share,
            cargoCost: 0,
            total: { increment: adjustment.diff },
            ...(trackingCode ? { trackingCode: serializeTrackingCodes([trackingCode]) } : {}),
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: order.status,
            note: `ارسالِ این سفارش با سفارش‌های #${shortIds} ترکیب شد -- سهمِ جدید از هزینه‌ی ارسال/باربری: ${share.toLocaleString("fa-IR")} تومان`,
          },
        });

        await tx.notification.create({
          data: {
            userId: order.userId,
            message:
              adjustment.diff < 0
                ? `سفارش #${order.id.slice(-8)} با سفارشِ دیگه‌ای ترکیب و با هم ارسال می‌شه -- چون هزینه‌ی ارسال کمتر شد، ${Math.abs(adjustment.diff).toLocaleString("fa-IR")} تومان به کیف پولتان بازگشت داده شد`
                : adjustment.diff > 0 && adjustment.paidNow
                  ? `سفارش #${order.id.slice(-8)} با سفارشِ دیگه‌ای ترکیب و با هم ارسال می‌شه -- اختلافِ هزینه (${adjustment.diff.toLocaleString("fa-IR")} تومان) از کیف پولتان کسر شد`
                  : adjustment.diff > 0
                    ? `سفارش #${order.id.slice(-8)} با سفارشِ دیگه‌ای ترکیب می‌شه -- برای اختلافِ هزینه‌ی ارسال (${adjustment.remainder.toLocaleString("fa-IR")} تومان باقی‌مانده)، وارد صفحه‌ی سفارش خود شوید`
                    : `سفارش #${order.id.slice(-8)} با سفارشِ دیگه‌ای ترکیب و با هم ارسال می‌شه`,
            link: `/orders/${order.id}`,
          },
        });
      }

      return createdGroup;
    });

    await logAdminAction({
      adminId: session.user.id,
      adminName: session.user.name ?? "",
      adminEmail: session.user.email ?? "",
      action: "SHIPPING_GROUP_CREATED",
      targetType: "ShippingGroup",
      targetId: group.id,
      detail: `سفارش‌های #${shortIds} -- هزینه‌ی کلِ جدید: ${totalNew.toLocaleString("fa-IR")} تومان`,
    });

    return NextResponse.json({ success: true, groupId: group.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا در ترکیبِ ارسال" }, { status: 400 });
  }
}
