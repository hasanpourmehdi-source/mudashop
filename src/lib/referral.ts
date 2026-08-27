import { prisma } from "@/lib/prisma";
import { applyWalletTransaction } from "@/lib/wallet";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { Prisma } from "@prisma/client";

// ================= کد معرفی / افیلیت =================
// هر کاربر یه کدِ معرفیِ یکتا دارد (lazily ساخته می‌شود، نه موقع ساختِ کاربر --
// چون کاربرهای OAuth از مسیر آداپتورِ NextAuth ساخته می‌شن که این‌جا قابل
// قلاب‌کردن نیست). وقتی یه کاربرِ جدید با کدِ یکی دیگه ثبت‌نام کند، User.referredById
// پر می‌شود؛ اولین سفارشِ «پرداخت‌شده»‌ی همان کاربر یک‌بار به معرف پاداش می‌دهد.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون حروف/ارقام مشابه (0/O, 1/I)

function randomCode(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // برخورد با کدِ تکراری -- یه کدِ تصادفیِ جدید امتحان کن
    }
  }
  throw new Error("ساخت کد معرفی ناموفق بود، دوباره تلاش کنید");
}

// resolve کردن یه کدِ معرفی به userId معرف. کدِ نامعتبر یا معرفی‌کردنِ خودِ فرد
// (که اصلاً نباید اتفاق بیفتد) به‌سادگی null برمی‌گرداند، نه خطا -- ثبت‌نام
// هرگز نباید به‌خاطر یه کدِ اشتباه شکست بخورد.
export async function resolveReferrerId(code: string | null | undefined, newUserEmail: string): Promise<string | null> {
  if (!code) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code.trim().toUpperCase() } });
  if (!referrer || referrer.email === newUserEmail) return null;
  return referrer.id;
}

// اگه این سفارش، اولینِ «پرداخت‌شده»‌یِ یک کاربرِ معرفی‌شده باشه، یک‌بار به
// معرف پاداش می‌دهد. چکِ priorPaidCount زیر به‌تنهایی در برابرِ دو سفارشِ
// هم‌زمانِ همون کاربرِ معرفی‌شده امن نیست (هر دو می‌تونن صفر ببینن) -- بک‌استاپِ
// واقعی همون قیدِ یکتاییِ ReferralReward.referredId است: create داخل تراکنش
// روی P2002 (چه از طرفِ orderId چه referredId) بی‌خطر لغو می‌شه، پس idempotent
// بودن (صدازدنِ چندباره از چند مسیرِ مختلفِ «سفارش پرداخت شد») واقعاً تضمین می‌شه.
export async function applyReferralRewardIfEligible(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, user: { select: { referredById: true } } },
  });
  if (!order?.user.referredById) return;

  const already = await prisma.referralReward.findUnique({ where: { orderId } });
  if (already) return;

  const priorPaidCount = await prisma.order.count({
    where: { userId: order.userId, paymentStatus: "PAID", id: { not: orderId } },
  });
  if (priorPaidCount > 0) return;

  const rewardAmount = Number(await getSiteSetting(SITE_SETTING_KEYS.REFERRAL_REWARD_AMOUNT)) || 0;
  if (rewardAmount <= 0) return;

  const referrerId = order.user.referredById;

  const rewarded = await prisma.$transaction(async (tx) => {
    try {
      await tx.referralReward.create({
        data: { referrerId, referredId: order.userId, orderId, rewardAmount },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // یه فراخوانیِ هم‌زمانِ دیگه (همین سفارش یا اولین سفارشِ هم‌زمانِ دیگه‌یِ
        // همین کاربرِ معرفی‌شده) زودتر پاداش رو ثبت کرد -- بی‌خطر، دوباره کاری نکن
        return false;
      }
      throw err;
    }
    await applyWalletTransaction(tx, {
      userId: referrerId,
      amount: rewardAmount,
      type: "REFERRAL",
      description: `پاداش معرفیِ سفارش #${orderId.slice(-8)}`,
      orderId,
    });
    await tx.notification.create({
      data: {
        userId: referrerId,
        message: `${rewardAmount.toLocaleString("fa-IR")} تومان پاداش معرفی به کیف پولت اضافه شد 🎉`,
        link: "/referral",
      },
    });
    return true;
  });

  if (!rewarded) return;

  await notifyCustomerOutbound({
    userId: referrerId,
    eventType: "REFERRAL_REWARD",
    title: "پاداش کد معرفی",
    body: `${rewardAmount.toLocaleString("fa-IR")} تومان پاداش معرفی به کیف پولت اضافه شد.`,
  });
}
