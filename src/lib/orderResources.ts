import type { Prisma } from "@prisma/client";
import { applyWalletTransaction } from "@/lib/wallet";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

// این تابع همه منابعی که هنگام ثبت سفارش رزرو شده بودن رو برمی‌گردونه:
// موجودی variant، موجودی حراج فلش، مصرف کوپن، و مبلغ کسرشده از کیف پول.
// هم موقع لغو دستی سفارش توسط کاربر و هم موقع شکست پرداخت در درگاه استفاده می‌شه.
export async function restoreOrderResources(tx: Prisma.TransactionClient, order: OrderWithItems) {
  for (const item of order.items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    if (item.flashSaleId) {
      await tx.flashSale.update({
        where: { id: item.flashSaleId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  if (order.couponCode) {
    await tx.coupon.updateMany({
      where: { code: order.couponCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  if (order.walletUsed > 0) {
    await applyWalletTransaction(tx, {
      userId: order.userId,
      amount: order.walletUsed,
      type: "REFUND",
      description: `بازگشت وجه سفارش #${order.id.slice(-8)}`,
      orderId: order.id,
    });
  }

  // اگه این سفارش، ادعای FIRST_BUY رو ثبت کرده بود (src/app/api/orders/route.ts)،
  // با لغوش اون ادعا هم پاک می‌شه -- کاربر واقعاً هنوز «اولین خرید»ش رو نکرده
  await tx.firstBuyClaim.deleteMany({ where: { userId: order.userId, orderId: order.id } });
}

// وقتی ادمین تعداد یه قلم مزون رو توی سفارشِ در انتظار تأیید ویرایش می‌کنه،
// موجودی variant باید به‌اندازه‌ی اختلاف تعداد تنظیم بشه (نه بازگردانی کامل
// مثل restoreOrderResources). quantityDelta مثبت یعنی تعداد زیاد شده (باید از
// موجودی کم بشه، با چک کافی‌بودن)؛ منفی یعنی تعداد کم شده (باید به موجودی برگرده)
export async function adjustVariantStockForQuantityChange(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantityDelta: number
) {
  if (quantityDelta === 0) return;
  if (quantityDelta > 0) {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.stock < quantityDelta) {
      throw new Error("موجودی کافی برای این تعداد وجود ندارد");
    }
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: quantityDelta } } });
  } else {
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: -quantityDelta } } });
  }
}
