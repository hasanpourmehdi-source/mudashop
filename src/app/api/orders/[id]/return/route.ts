import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { z } from "zod";

const RETURN_WINDOW_DAYS = 7;

const REASON_ENUM = z.enum(["DEFECTIVE", "WRONG_ITEM", "WRONG_SIZE", "CHANGED_MIND", "OTHER"]);

const returnSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        reason: REASON_ENUM,
        description: z.string().max(1000).optional(),
      })
    )
    .min(1, "حداقل یک کالا را برای مرجوع کردن انتخاب کنید"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      returnRequest: true,
      items: {
        include: {
          product: { select: { isReturnable: true } },
          externalSite: { select: { isReturnable: true } },
        },
      },
    },
  });

  // IDOR-safe: فقط صاحب سفارش می‌تونه براش درخواست مرجوعی بده
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  if (order.status !== "DELIVERED" || !order.deliveredAt) {
    return NextResponse.json(
      { error: "فقط سفارش‌های تحویل‌داده‌شده قابل مرجوع کردن هستند" },
      { status: 400 }
    );
  }

  const daysSinceDelivery = (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `مهلت ${RETURN_WINDOW_DAYS} روزه درخواست مرجوعی این سفارش گذشته است` },
      { status: 400 }
    );
  }

  // اگه درخواست قبلی رد شده، مشتری می‌تونه دوباره (مثلاً با دلیل/توضیح بهتر)
  // تلاش کنه -- فقط تا وقتی که ادمین هنوز داره روش تصمیم می‌گیره یا در جریانه
  // (PENDING/APPROVED/ITEM_RECEIVED) اجازه‌ی درخواست دوم نیست
  if (order.returnRequest && order.returnRequest.status !== "REJECTED") {
    return NextResponse.json(
      { error: "برای این سفارش قبلاً درخواست مرجوعی ثبت شده است" },
      { status: 409 }
    );
  }

  const orderItemsById = new Map(order.items.map((i) => [i.id, i]));
  const nonReturnableProductsEnabled = await getSiteSettingBool(SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED);
  for (const item of parsed.data.items) {
    const orderItem = orderItemsById.get(item.orderItemId);
    if (!orderItem) {
      return NextResponse.json({ error: "کالای انتخاب‌شده متعلق به این سفارش نیست" }, { status: 400 });
    }
    // دو سطحِ جدا: اقلامِ مزون فلگِ خودِ محصول، اقلامِ ترندیول فلگِ سطحِ سایتِ
    // خارجی‌شون (ترندیول/میلا ممکنه هرکدوم قانونِ مرجوعیِ متفاوتی داشته باشن).
    // اگه سایتِ اون قلم نامشخص باشه (مثلاً دموی قدیمی)، محافظه‌کارانه رد نمی‌شه
    const isNonReturnable =
      nonReturnableProductsEnabled &&
      ((orderItem.source === "MAZON" && orderItem.product?.isReturnable === false) ||
        (orderItem.source === "TRENDYOL" && orderItem.externalSite?.isReturnable === false));
    if (isNonReturnable) {
      return NextResponse.json(
        { error: `کالای «${orderItem.title}» قابل مرجوع نیست` },
        { status: 400 }
      );
    }
    // قانونِ همیشگیِ کالای خارجی -- صرف‌نظر از تنظیماتِ بالا (که فقط کنترل
    // می‌کنن مرجوعی اصلاً هست یا نه)، «انصراف بدون دلیل خاص» هیچ‌وقت برای
    // کالای خارجی قبول نمی‌شه؛ فقط ایراد/اشتباه (خرابی، کالای اشتباه، سایز/رنگ نامناسب)
    if (orderItem.source === "TRENDYOL" && item.reason === "CHANGED_MIND") {
      return NextResponse.json(
        {
          error: `کالای «${orderItem.title}» (کالای خارجی) فقط در صورتِ خرابی، ارسالِ اشتباه یا نامناسب‌بودنِ سایز/رنگ قابلِ مرجوعه -- انصراف از خرید شاملِ مرجوعی نمی‌شه`,
        },
        { status: 400 }
      );
    }
  }

  const refundAmount = parsed.data.items.reduce((sum, item) => {
    const orderItem = orderItemsById.get(item.orderItemId)!;
    return sum + orderItem.price * orderItem.quantity;
  }, 0);

  // اگه درخواست قبلی رد شده بود، اول اون رو کنار می‌زاریم تا رکورد جدید
  // (که orderId اش یکتاست) جاش رو بگیره
  const previousRejectedId = order.returnRequest?.status === "REJECTED" ? order.returnRequest.id : null;

  // reason سطح‌بالا یه enum تکی‌ه (نمی‌تونه چندتا دلیل رو هم‌زمان نگه داره) --
  // پس دلیل قلم اول رو می‌گیریم (محدودیت فنی واقعیه)، ولی description سطح‌بالا
  // رو با خلاصه‌ی دلیل/توضیح همه‌ی اقلام پر می‌کنیم تا هیچ اطلاعاتی گم نشه --
  // خودِ هر ReturnRequestItem هم دلیل/توضیح مستقل خودش رو داره
  const combinedReason = parsed.data.items[0].reason;
  const combinedDescription =
    parsed.data.items.length > 1
      ? parsed.data.items
          .map((item, idx) => `قلم ${idx + 1}: ${item.reason}${item.description ? ` (${item.description})` : ""}`)
          .join(" | ")
      : parsed.data.items[0].description || undefined;

  if (previousRejectedId) {
    await prisma.$transaction([
      prisma.returnRequestItem.deleteMany({ where: { returnRequestId: previousRejectedId } }),
      prisma.returnRequest.delete({ where: { id: previousRejectedId } }),
    ]);
  }

  const [returnRequest] = await prisma.$transaction([
    prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId: session.user.id,
        reason: combinedReason,
        description: combinedDescription,
        refundAmount,
        items: {
          create: parsed.data.items.map((item) => ({
            orderItemId: item.orderItemId,
            reason: item.reason,
            description: item.description,
          })),
        },
      },
      include: { items: true },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: previousRejectedId
          ? `مشتری بعد از رد درخواست قبلی، دوباره درخواست مرجوعی برای ${parsed.data.items.length.toLocaleString("fa-IR")} کالا ثبت کرد`
          : `مشتری درخواست مرجوعی برای ${parsed.data.items.length.toLocaleString("fa-IR")} کالا ثبت کرد`,
      },
    }),
  ]);

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        message: `درخواست مرجوعی جدید روی سفارش #${id.slice(-8)}`,
        link: `/admin/orders/${id}`,
      })),
    });
  }

  await notifyCustomerOutbound({
    userId: order.userId,
    eventType: "RETURN_SUBMITTED",
    title: `درخواست مرجوعی سفارش #${id.slice(-8)} ثبت شد`,
    body: `درخواست مرجوعی برای ${parsed.data.items.length.toLocaleString("fa-IR")} کالای سفارش #${id.slice(-8)} ثبت شد و پس از بررسی ادمین، نتیجه اطلاع‌رسانی می‌شود.`,
  });

  return NextResponse.json(returnRequest, { status: 201 });
}
