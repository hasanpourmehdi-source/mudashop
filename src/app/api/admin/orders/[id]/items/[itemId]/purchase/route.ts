import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { computePurchaseSummary } from "@/lib/orderPurchaseStatus";
import { z } from "zod";

const schema = z.object({
  tag: z.string().trim().min(1, "تگ رو وارد کنید").max(200),
  actualPrice: z.number().int().nonnegative(),
  // اگه سایز/رنگ روی لینک اصلی موجود نبود و از یه تامین‌کننده‌ی دیگه خریداری
  // شد، آدرس واقعیِ خرید (اختیاری، ممکنه با لینک اصلی محصول فرق داشته باشه)
  purchaseUrl: z.string().trim().url("لینک معتبر نیست").max(1000).optional().or(z.literal("")),
});

// فاز اول خرید تک‌به‌تک اقلام خارجی («در صف خرید») -- ادمین می‌گه این قلم رو
// واقعاً خرید، با یه تگ برای ردیابی فیزیکی (بعداً وقتی کالا به انبار/نمایندگی
// می‌رسه، همین تگ برای پیدا کردن دوباره‌ی سفارش استفاده می‌شه) و قیمت واقعی
// خریداری‌شده (اگه با چیزی که مشتری پرداخت کرده فرق داشت، تسویه‌ش موکول به
// پرداخت باربری/ارسال می‌شه، نه فوری)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin("PURCHASING");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, cancellationRequest: true },
  });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  if (item.source !== "TRENDYOL") {
    return NextResponse.json({ error: "این عملیات فقط برای اقلام خارجی معنی دارد" }, { status: 400 });
  }
  if (order.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "این عملیات فقط بعد از پرداخت اقلام سفارش انجام می‌شود" },
      { status: 400 }
    );
  }
  if (item.purchaseStatus !== "PENDING") {
    return NextResponse.json({ error: "وضعیت خرید این قلم قبلاً مشخص شده است" }, { status: 400 });
  }
  // مشتری درخواست لغو داده و منتظر تصمیم ادمینه -- نباید هم‌زمان از یه پنل
  // دیگه (بی‌خبر از این درخواست) خرید واقعی رو شروع کرد؛ اول باید درخواست
  // لغو تأیید یا رد بشه
  if (order.cancellationRequest && order.cancellationRequest.status === "PENDING") {
    return NextResponse.json(
      {
        error:
          "یه درخواست لغوِ در انتظار بررسی روی این سفارش هست -- اول اون رو تأیید یا رد کن، بعد خرید رو انجام بده",
      },
      { status: 400 }
    );
  }

  const existingTag = await prisma.orderItem.findUnique({ where: { purchaseTag: parsed.data.tag } });
  if (existingTag) {
    return NextResponse.json({ error: "این تگ قبلاً برای یه قلم دیگه استفاده شده است" }, { status: 409 });
  }

  const now = new Date();
  const updatedItem = await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      purchaseStatus: "PURCHASED",
      purchaseTag: parsed.data.tag,
      purchasePriceActual: parsed.data.actualPrice,
      purchaseUrl: parsed.data.purchaseUrl || null,
      purchaseResolvedAt: now,
    },
  });

  const summary = computePurchaseSummary(
    order.items.map((i) => (i.id === itemId ? updatedItem : i))
  );

  // اگه قیمتِ واقعیِ خریداری‌شده با چیزی که مشتری پرداخت کرده فرق داشت، باید
  // همون لحظه به مشتری خبر بدیم که چرا -- وگرنه بعداً موقع تعیین هزینه ارسال
  // (که این اختلاف بهش اضافه/کم می‌شه) یه عدد ناگهانی و بی‌توضیح می‌بینه.
  // این پیام به‌طور مستقل از پیام کلی «X از Y کالا خریداری شد» ارسال می‌شه تا
  // گم نشه
  const priceDiffTotal = (parsed.data.actualPrice - item.price) * item.quantity;
  const priceDiffNote =
    priceDiffTotal > 0
      ? ` -- قیمت واقعیِ این کالا ${priceDiffTotal.toLocaleString("fa-IR")} تومان بیشتر از چیزی بود که پرداخت کرده بودید؛ این مبلغ به هزینه‌ی ارسال/باربری این سفارش اضافه می‌شه`
      : priceDiffTotal < 0
        ? ` -- قیمت واقعیِ این کالا ${Math.abs(priceDiffTotal).toLocaleString("fa-IR")} تومان کمتر از چیزی بود که پرداخت کرده بودید؛ این مبلغ از هزینه‌ی ارسال/باربری این سفارش کم می‌شه`
        : "";

  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      status: order.status,
      note: `قلم «${item.title}» خریداری شد (تگ: ${parsed.data.tag}) -- ${summary.purchased} از ${summary.total} کالای خارجی این سفارش خریداری شد${priceDiffNote}`,
    },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: `${summary.purchased} از ${summary.total} کالای سفارش #${id.slice(-8)} خریداری شد`,
      link: `/orders/${id}`,
    },
  });

  if (priceDiffTotal !== 0) {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        message: `قیمت «${item.title}» توی سفارش #${id.slice(-8)}${priceDiffNote}`,
        link: `/orders/${id}`,
      },
    });
  }

  return NextResponse.json(updatedItem);
}
