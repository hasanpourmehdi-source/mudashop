import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, applyWalletTransaction } from "@/lib/wallet";
import type { Prisma } from "@prisma/client";

// استخراجِ همون منطقِ «اختلافِ هزینه‌ی ارسال» که توی change-address/route.ts
// هست، به دو فاز -- تا بشه به‌ازای چند سفارش (مثلاً ترکیبِ ارسال) جدا صداش زد:
//  ۱) compute: فقط خوندنی (موجودیِ کیف‌پول، کارتِ پیش‌فرض) -- می‌تونه قبل از
//     شروعِ تراکنشِ اصلی، برای همه‌ی سفارش‌ها اجرا بشه تا اگه یکی‌شون کارتِ
//     فعال نداره، بدونِ نیمه‌کاره‌گذاشتنِ بقیه، زودتر خطا بده.
//  ۲) commit: نوشتنی (داخلِ تراکنش) -- گاردِ همزمانیِ کیف‌پول رو دوباره چک
//     می‌کنه (چون بینِ فازِ ۱ و شروعِ تراکنش ممکنه موجودی عوض شده باشه).
// خودِ change-address/route.ts عمداً دست‌نخورده می‌مونه (یه مسیرِ مالیِ
// کاملاً کار)، این فایل فقط برای مصرف‌کننده‌ی جدید (ترکیبِ ارسال) نوشته شده

export type ShippingCostAdjustment = {
  diff: number; // مثبت یعنی مشتری باید بیشتر بده، منفی یعنی طلبکاره
  walletOffset: number;
  remainder: number;
  paidNow: boolean;
  assignedCard: { cardNumber: string; shebaNumber: string | null; holderName: string } | null;
};

export async function computeShippingCostAdjustment(
  order: { id: string; userId: string; shippingCost: number | null; cargoCost: number | null },
  newTotal: number,
  opts: { bankCardId?: string; hasExternalItems: boolean }
): Promise<ShippingCostAdjustment> {
  const diff = newTotal - ((order.shippingCost ?? 0) + (order.cargoCost ?? 0));

  const wallet = await getOrCreateWallet(order.userId);
  let walletOffset = 0;
  let assignedCard: ShippingCostAdjustment["assignedCard"] = null;
  if (diff > 0) {
    walletOffset = Math.min(wallet.balance, diff);
    const remainder = diff - walletOffset;
    if (remainder > 0) {
      if (opts.bankCardId) {
        assignedCard = await prisma.bankCard.findUnique({ where: { id: opts.bankCardId } });
        if (!assignedCard) {
          throw new Error(`کارتِ بانکیِ انتخاب‌شده برای سفارش #${order.id.slice(-8)} یافت نشد`);
        }
      } else {
        const defaultFlag = opts.hasExternalItems ? "isDefaultForCargo" : "isDefaultForShipping";
        assignedCard =
          (await prisma.bankCard.findFirst({ where: { isActive: true, [defaultFlag]: true } })) ??
          (await prisma.bankCard.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
        if (!assignedCard) {
          throw new Error(
            `چون سفارش #${order.id.slice(-8)} مبلغِ بیشتری باید بده، یه کارتِ بانکیِ فعال لازمه (هیچ‌کدوم ثبت نشده)`
          );
        }
      }
    }
  }
  const remainder = diff > 0 ? diff - walletOffset : 0;
  return { diff, walletOffset, remainder, paidNow: remainder <= 0, assignedCard };
}

// باید داخلِ یه prisma.$transaction صدا زده بشه -- گاردِ همزمانیِ موجودیِ
// کیف‌پول رو دوباره چک می‌کنه، بعد wallet/ShippingPayment/OrderPaymentEvent رو می‌سازه
export async function commitShippingCostAdjustment(
  tx: Prisma.TransactionClient,
  order: { id: string; userId: string },
  adjustment: ShippingCostAdjustment,
  description: string
): Promise<void> {
  const { diff, walletOffset, remainder, paidNow, assignedCard } = adjustment;
  if (diff === 0) return;

  if (diff > 0) {
    const freshWallet = await getOrCreateWallet(order.userId, tx);
    if (freshWallet.balance < walletOffset) {
      throw new Error("موجودی کیف پول کافی نیست -- لطفاً دوباره تلاش کنید");
    }
  }

  if (diff < 0) {
    await applyWalletTransaction(tx, {
      userId: order.userId,
      amount: -diff,
      type: "REFUND",
      description,
      orderId: order.id,
    });
    return;
  }

  if (walletOffset > 0) {
    await applyWalletTransaction(tx, {
      userId: order.userId,
      amount: walletOffset,
      type: "PURCHASE",
      description,
      orderId: order.id,
    });
  }

  await tx.shippingPayment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      amount: Math.max(remainder, 0),
      shippingCost: diff,
      cargoCost: 0,
      walletOffset,
      status: paidNow ? "PAID" : "AWAITING_PAYMENT",
      paidAt: paidNow ? new Date() : null,
      assignedCardNumber: assignedCard?.cardNumber ?? null,
      assignedShebaNumber: assignedCard?.shebaNumber ?? null,
      assignedCardHolder: assignedCard?.holderName ?? null,
    },
    update: {
      amount: Math.max(remainder, 0),
      shippingCost: diff,
      cargoCost: 0,
      walletOffset,
      status: paidNow ? "PAID" : "AWAITING_PAYMENT",
      paidAt: paidNow ? new Date() : null,
      assignedCardNumber: assignedCard?.cardNumber ?? null,
      assignedShebaNumber: assignedCard?.shebaNumber ?? null,
      assignedCardHolder: assignedCard?.holderName ?? null,
      receiptImage: null,
      receiptSubmittedAt: null,
    },
  });

  if (assignedCard) {
    await tx.orderPaymentEvent.create({
      data: {
        orderId: order.id,
        round: "shipping",
        purpose: description,
        amount: remainder,
        cardNumber: assignedCard.cardNumber,
        cardHolder: assignedCard.holderName,
        shebaNumber: assignedCard.shebaNumber,
      },
    });
  }
}
