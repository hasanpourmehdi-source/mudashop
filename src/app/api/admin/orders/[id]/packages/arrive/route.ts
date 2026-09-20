import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { parsePackageStatuses, markPackageArrived, serializePackageStatuses } from "@/lib/packageStatuses";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { getLoyaltyCashbackPercent, applyOrderCashback } from "@/lib/giftCard";
import { computeLoyaltyPointsEarned, getLoyaltyTier, getLoyaltyConfig } from "@/lib/loyaltyTier";
import { SITE_SETTING_KEYS, getSiteSettingBool } from "@/lib/siteSettings";
import { z } from "zod";

const arriveSchema = z.object({
  code: z.string().min(1).max(200),
});

// علامت‌زدن «این بسته تحویل داده شد» -- برای تحویل جزئی/چند بسته. اگه همه‌ی
// بسته‌ها تحویل داده شده باشن، کل سفارش به‌صورت خودکار DELIVERED می‌شه (و
// deliveredAt ثبت می‌شه) و اگه هنوز بقیه در راهن، سفارش SHIPPED می‌مونه ولی
// مشتری از رسیدنِ این بسته مطلع می‌شه
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = arriveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "کد بسته نامعتبر است" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  if (order.status !== "SHIPPED") {
    return NextResponse.json({ error: "فقط سفارش ارسال‌شده می‌تواند بسته تحویل‌داده‌شده داشته باشد" }, { status: 400 });
  }

  const { statuses, found, allArrived } = markPackageArrived(order.packageStatuses, parsed.data.code);
  if (!found) {
    return NextResponse.json({ error: "این کد رهگیری جزو بسته‌های سفارش نیست" }, { status: 400 });
  }
  const serialized = serializePackageStatuses(statuses);
  const shortId = id.slice(-8);
  const loyaltyEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.LOYALTY_CASHBACK_ENABLED);
  const loyaltyConfig = loyaltyEnabled ? await getLoyaltyConfig() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id },
      data: {
        packageStatuses: serialized,
        ...(allArrived ? { status: "DELIVERED", deliveredAt: new Date() } : {}),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: allArrived ? "DELIVERED" : order.status,
        note: allArrived
          ? "همه‌ی بسته‌های سفارش تحویل داده شد -- سفارش تکمیل شد"
          : `بسته با کد ${parsed.data.code} تحویل داده شد -- بقیه در راه است`,
      },
    });

    await tx.notification.create({
      data: {
        userId: order.userId,
        message: allArrived
          ? `سفارش #${shortId} کامل تحویل داده شد (هر دو بسته/همه‌ی بسته‌ها).`
          : `بسته‌ای از سفارش #${shortId} (کد ${parsed.data.code}) تحویل داده شد -- بقیه هنوز در راه است.`,
        link: `/orders/${id}`,
      },
    });

    // وفاداری: بعد از تحویلِ کاملِ سفارش، کسراژ به کیف پول مشتری اضافه می‌شه --
    // سطحِ فعلیِ کاربر (بر اساسِ امتیازهای قبلی) یه درصدِ اضافه به نرخِ پایه می‌ده
    // -- کلِ این بلوک فقط وقتی اجرا می‌شه که ادمین از تنظیمات روشنش کرده باشه
    if (allArrived && loyaltyEnabled && loyaltyConfig) {
      const userBefore = await tx.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } });
      const tier = getLoyaltyTier(userBefore?.loyaltyPoints ?? 0, loyaltyConfig.tiers);
      const basePercent = await getLoyaltyCashbackPercent();
      const cashback = await applyOrderCashback(tx, {
        userId: order.userId,
        orderId: id,
        paidAmount: order.total,
        percent: basePercent + tier.bonusPercent,
      });
      const pointsEarned = computeLoyaltyPointsEarned(order.total, loyaltyConfig.tomanPerPoint);
      if (pointsEarned > 0) {
        await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: pointsEarned } } });
      }
      if (cashback > 0) {
        await tx.notification.create({
          data: {
            userId: order.userId,
            message: `${cashback.toLocaleString("fa-IR")} تومان کسراژ وفاداری سفارش #${shortId} به کیف پولت اضافه شد 🎁`,
            link: `/loyalty`,
          },
        });
      }

      // ارتقاءِ سطحِ باشگاه -- اگه امتیازِ تازه از آستانه‌ی سطحِ بالاتر رد شد
      const newTier = getLoyaltyTier((userBefore?.loyaltyPoints ?? 0) + pointsEarned, loyaltyConfig.tiers);
      if (newTier.key !== tier.key) {
        await tx.notification.create({
          data: {
            userId: order.userId,
            message: `🎉 به سطح ${newTier.label} باشگاه مشتریان ارتقا یافتی!`,
            link: `/loyalty`,
          },
        });
      }
    }

    return result;
  });

  // بعد از تراکنش -- اعلان بیرون‌سایت (ایمیل/پیامک) بر اساس ترجیحات مشتری
  await notifyCustomerOutbound({
    userId: order.userId,
    eventType: "PACKAGE_DELIVERED",
    title: allArrived
      ? `سفارش #${shortId} کامل تحویل داده شد`
      : `بسته‌ای از سفارش #${shortId} تحویل داده شد`,
    body: allArrived
      ? `سفارش #${shortId} کامل تحویل داده شد (همه‌ی بسته‌ها).`
      : `بسته‌ای از سفارش #${shortId} (کد ${parsed.data.code}) تحویل داده شد -- بقیه هنوز در راه است.`,
  });

  return NextResponse.json(updated);
}

// برای پنل ادمین: وضعیت فعلی بسته‌ها
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { packageStatuses: true } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  return NextResponse.json(parsePackageStatuses(order.packageStatuses));
}