import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction } from "@/lib/wallet";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ITEM_RECEIVED", "REFUNDED"]),
});

const STATUS_NOTIFICATION_MESSAGES: Record<string, string> = {
  APPROVED: "درخواست مرجوعی شما تأیید شد -- لطفاً کالا را برای ما ارسال کنید",
  REJECTED: "درخواست مرجوعی شما رد شد",
  ITEM_RECEIVED: "کالای مرجوعی شما دریافت شد -- به‌زودی وجه به کیف پولتان بازمی‌گردد",
};

const STATUS_HISTORY_NOTES: Record<string, string> = {
  APPROVED: "درخواست مرجوعی توسط ادمین تأیید شد",
  REJECTED: "درخواست مرجوعی توسط ادمین رد شد",
  ITEM_RECEIVED: "کالای مرجوعی توسط ادمین دریافت شد",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, userId: true, status: true, couponCode: true } },
      items: { include: { orderItem: true } },
    },
  });
  if (!returnRequest) {
    return NextResponse.json({ error: "درخواست مرجوعی یافت نشد" }, { status: 404 });
  }

  if (returnRequest.status === "REFUNDED") {
    return NextResponse.json(
      { error: "این درخواست قبلاً به سرانجام رسیده و قابل تغییر نیست" },
      { status: 400 }
    );
  }

  // فقط وقتی برای اولین بار به REFUNDED می‌ره، وجه واقعاً برمی‌گرده و موجودی بازسازی می‌شه --
  // فقط برای همون کالاهایی که واقعاً توی این درخواست مرجوع شدن، نه کل اقلام سفارش
  if (parsed.data.status === "REFUNDED") {
    const { order } = returnRequest;

    await prisma.$transaction(async (tx) => {
      for (const { orderItem } of returnRequest.items) {
        if (orderItem.variantId) {
          await tx.productVariant.update({
            where: { id: orderItem.variantId },
            data: { stock: { increment: orderItem.quantity } },
          });
        }
        if (orderItem.flashSaleId) {
          await tx.flashSale.update({
            where: { id: orderItem.flashSaleId },
            data: { stock: { increment: orderItem.quantity } },
          });
        }
      }

      if (order.couponCode) {
        await tx.coupon.updateMany({
          where: { code: order.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: returnRequest.refundAmount,
        type: "REFUND",
        description: `بازگشت وجه مرجوعی سفارش #${order.id.slice(-8)}`,
        orderId: order.id,
      });

      await tx.order.update({ where: { id: order.id }, data: { status: "RETURNED" } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: "RETURNED", note: "مرجوعی تأیید و وجه بازگشت شد" },
      });
      await tx.returnRequest.update({ where: { id }, data: { status: "REFUNDED" } });
      await tx.notification.create({
        data: {
          userId: order.userId,
          message: `وجه مرجوعی سفارش #${order.id.slice(-8)} به کیف پولتان بازگشت داده شد`,
          link: `/orders/${order.id}`,
        },
      });
    });

    const updated = await prisma.returnRequest.findUnique({ where: { id } });
    return NextResponse.json(updated);
  }

  const [updated] = await prisma.$transaction([
    prisma.returnRequest.update({ where: { id }, data: { status: parsed.data.status } }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: returnRequest.order.id,
        status: returnRequest.order.status,
        note: STATUS_HISTORY_NOTES[parsed.data.status] ?? `وضعیت درخواست مرجوعی به‌روزرسانی شد`,
      },
    }),
    prisma.notification.create({
      data: {
        userId: returnRequest.order.userId,
        message:
          STATUS_NOTIFICATION_MESSAGES[parsed.data.status] ??
          `وضعیت درخواست مرجوعی سفارش #${returnRequest.order.id.slice(-8)} تغییر کرد`,
        link: `/orders/${returnRequest.order.id}`,
      },
    }),
  ]);
  return NextResponse.json(updated);
}
