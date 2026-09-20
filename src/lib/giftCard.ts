import { prisma } from "@/lib/prisma";
import { applyWalletTransaction } from "@/lib/wallet";
import { SITE_SETTING_KEYS, getSiteSetting } from "@/lib/siteSettings";

// ================= کارت هدیه و وفاداری =================

// --- توابع خالص (تست‌پذیر) ---

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بدون کاراکترهای گنگ I/O/L/0/1
const ALPHABET_LEN = ALPHABET.length;

// کد فعال‌سازی گروهی، مثل "HDA-7K2M-9QX1". جداکننده ساده برای خوانایی
export function generateGiftCardCode(prefix = "MUD"): string {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const seg = (len: number) => {
    let s = "";
    for (let i = 0; i < len; i++) s += ALPHABET[rand(ALPHABET_LEN)];
    return s;
  };
  return `${prefix}-${seg(4)}-${seg(4)}`;
}

// خالص: کسراژ وفاداری = کف (مبلغ × درصد / ۱۰۰). درصد از ۰ تا ۱۰۰
export function applyCashback(paidAmount: number, percent: number): number {
  if (paidAmount <= 0 || percent <= 0) return 0;
  return Math.floor((paidAmount * percent) / 100);
}

export type GiftCardLike = {
  balance: number;
  isActive: boolean;
  redeemedAt: Date | string | null;
  expiresAt: Date | string | null;
};

// خالص: آیا کارت هنوز قابل فعال‌سازی است؟ (فعال، مصرف‌نشده، منقضی‌نشده، موجودی دارد)
export function isGiftCardRedeemable(card: GiftCardLike, now: Date = new Date()): boolean {
  if (!card.isActive || card.balance <= 0) return false;
  if (card.redeemedAt !== null) return false;
  if (card.expiresAt !== null && now > new Date(card.expiresAt)) return false;
  return true;
}

// --- عملیات دیتابیس ---

// خرید کارت هدیه با موجودی کیف پول خریدار. در تراکنش: کسر از کیف پول (PURCHASE)
// + ساخت کارت. خطا با متن فارسی throw می‌شه.
export async function buyGiftCard(params: {
  buyerUserId: string;
  amount: number;
  message?: string | null;
  recipientEmail?: string | null;
}) {
  const { buyerUserId, amount, message, recipientEmail } = params;
  const code = generateGiftCardCode();

  return prisma.$transaction(async (tx) => {
    await applyWalletTransaction(tx, {
      userId: buyerUserId,
      amount,
      type: "PURCHASE",
      description: `خرید کارت هدیه کد ${code}`,
    });

    return tx.giftCard.create({
      data: {
        code,
        initialAmount: amount,
        balance: amount,
        message: message || null,
        recipientEmail: recipientEmail || null,
        buyerUserId,
      },
    });
  });
}

// فعال‌سازی کارت هدیه: موجودی کارت به کیف پول گیرنده اضافه می‌شه (GIFT_CARD) و
// کارت مصرف‌شده علامت می‌خوره. یکبارمصرف. خطا با متن فارسی throw می‌شه.
export async function redeemGiftCard(userId: string, code: string): Promise<number> {
  const normalized = code.trim().toUpperCase();
  const card = await prisma.giftCard.findUnique({ where: { code: normalized } });
  if (!card || !isGiftCardRedeemable(card)) {
    throw new Error("این کد معتبر نیست یا قبلاً استفاده شده است");
  }

  await prisma.$transaction(async (tx) => {
    // قفل روی کارت تا دو نفر هم‌زمان نتوانند همان کد را فعال کنند
    const locked = await tx.giftCard.findUnique({ where: { code: normalized } });
    if (!locked || !isGiftCardRedeemable(locked)) {
      throw new Error("این کد معتبر نیست یا قبلاً استفاده شده است");
    }

    await tx.giftCard.update({
      where: { id: locked.id },
      data: { balance: 0, redeemedByUserId: userId, redeemedAt: new Date() },
    });

    await applyWalletTransaction(tx, {
      userId,
      amount: locked.balance,
      type: "GIFT_CARD",
      description: `فعال‌سازی کارت هدیه کد ${normalized}`,
    });
  });

  return card.balance;
}

// درصد کسراژ وفاداری از تنظیمات سایت (پیش‌فرض ۲٪) -- بدون خطا، برای استفاده در
// ادمین هم قابل تغییر است (SiteSetting با کلید LOYALTY_CASHBACK_PERCENT)
export async function getLoyaltyCashbackPercent(): Promise<number> {
  const value = Number(await getSiteSetting(SITE_SETTING_KEYS.LOYALTY_CASHBACK_PERCENT));
  if (!Number.isFinite(value) || value < 0 || value > 100) return 2;
  return value;
}

// اعمال کسراژ وفاداری بعد از تحویل کامل سفارش: به کیف پول مشتری اضافه می‌شه
// (LOYALTY) + زنگوله. در تراکنشِ همان درخواست (client=tx) صدا زده بشه تا اتمیک
// بماند. مبلغ کسراژ برگردانده می‌شه (۰ یعنی چیزی تعلق نگرفت).
export async function applyOrderCashback(
  tx: Parameters<typeof applyWalletTransaction>[0],
  params: {
    userId: string;
    orderId: string;
    paidAmount: number;
    percent: number;
  }
): Promise<number> {
  const cashback = applyCashback(params.paidAmount, params.percent);
  if (cashback <= 0) return 0;

  await applyWalletTransaction(tx, {
    userId: params.userId,
    amount: cashback,
    type: "LOYALTY",
    description: `کسراژ وفاداری سفارش #${params.orderId.slice(-8)}`,
    orderId: params.orderId,
  });
  return cashback;
}