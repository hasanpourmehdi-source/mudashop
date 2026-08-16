import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { restoreOrderResources } from "@/lib/orderResources";
import { ORDER_STATUS_NOTIFICATION_MESSAGES } from "@/lib/orderStatusMessages";
import { serializeTrackingCodes } from "@/lib/trackingCodes";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
  reason: z.string().max(500).optional(),
  // سفارش ممکنه توی چندتا بسته‌ی جدا ارسال بشه -- پس همیشه یه آرایه می‌گیریم،
  // نه یه کد تکی
  trackingCodes: z.array(z.string().max(200)).max(20).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true, shippingPayment: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }

  // چون دیگه دراپ‌داون آزاد نداریم، هر گذار باید واقعاً منطقی باشه -- سرور هم
  // باید همون شرط‌هایی که دکمه‌های AdminOrderActions رعایت می‌کنن رو دوباره
  // چک کنه (نه فقط UI)، وگرنه یه درخواست دستی می‌تونست وضعیت رو نامعتبر جا به جا کنه

  const trackingLabel = existing.shippingMethod === "پیک موتوری" ? "شماره تماس پیک" : "کد رهگیری";
  const trackingCodesInput = (parsed.data.trackingCodes ?? []).map((c) => c.trim()).filter(Boolean);

  // اصلاح کدهای رهگیری/شماره پیک بعد از ثبت ارسال -- وقتی status ارسالی همون
  // status فعلیه (نه یه گذار واقعی)، یعنی ادمین فقط داره کدها رو ویرایش/اضافه
  // می‌کنه، نه دوباره «ثبت ارسال» می‌زنه. این مسیر از قوانین گذار وضعیت و
  // ثبت تاریخچه‌ی تکراری معاف می‌شه، ولی مشتری از تغییر مطلع می‌شه. فقط قبل
  // از تحویل مجازه -- بعد از DELIVERED سفارش بسته شده و هیچ‌چیزش (حتی کد
  // رهگیری) دیگه قابل ویرایش نیست
  if (
    parsed.data.status === existing.status &&
    existing.status === "SHIPPED" &&
    trackingCodesInput.length > 0
  ) {
    const trackingCode = serializeTrackingCodes(trackingCodesInput);
    const order = await prisma.order.update({ where: { id }, data: { trackingCode } });
    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: existing.status,
        note: `${trackingLabel}(های) سفارش توسط ادمین اصلاح شد: ${trackingCodesInput.join("، ")}`,
      },
    });
    await prisma.notification.create({
      data: {
        userId: existing.userId,
        message: `${trackingLabel}(های) سفارش #${id.slice(-8)} به‌روزرسانی شد: ${trackingCodesInput.join("، ")}`,
        link: `/orders/${id}`,
      },
    });
    return NextResponse.json(order);
  }

  if (parsed.data.status === "SHIPPED") {
    if (existing.status !== "PROCESSING" || existing.paymentStatus !== "PAID") {
      return NextResponse.json(
        { error: "این سفارش هنوز آماده‌ی ثبت ارسال نیست" },
        { status: 400 }
      );
    }
    // این چک قبلاً فقط برای سفارش‌های خارجی بود (hasExternalItems) -- ولی یه
    // سفارش مزونیِ برگشت‌خورده (RTS) هم یه ردیف ShippingPayment می‌گیره (با
    // status="FAILED"، در mark-returned-to-sender) که باید قبل از «ثبت ارسال»ِ
    // دوباره تسویه بشه؛ چک‌کردن صرفِ وجودِ ردیف (نه نوع سفارش) هر دو حالت رو
    // درست می‌گیره، بدون اینکه سفارش‌های عادیِ مزون (که اصلاً ShippingPayment
    // ندارن) رو تحت تأثیر قرار بده
    if (existing.shippingPayment && existing.shippingPayment.status !== "PAID") {
      return NextResponse.json(
        { error: "هزینه ارسال/باربری این سفارش هنوز تسویه نشده" },
        { status: 400 }
      );
    }
  }
  if (parsed.data.status === "DELIVERED" && existing.status !== "SHIPPED") {
    return NextResponse.json(
      { error: "سفارشی که هنوز ارسال نشده رو نمی‌شه تحویل‌داده‌شده ثبت کرد" },
      { status: 400 }
    );
  }
  if (
    parsed.data.status === "CANCELLED" &&
    ["CANCELLED", "DELIVERED", "RETURNED"].includes(existing.status)
  ) {
    return NextResponse.json({ error: "این سفارش دیگه قابل لغو نیست" }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() ?? "";
  if (parsed.data.status === "CANCELLED" && !reason) {
    return NextResponse.json({ error: "لطفاً دلیل لغو را بنویسید" }, { status: 400 });
  }

  if (parsed.data.status === "SHIPPED" && trackingCodesInput.length === 0) {
    return NextResponse.json(
      { error: "لطفاً حداقل یک کد رهگیری یا شماره تماس پیک وارد کنید" },
      { status: 400 }
    );
  }
  const trackingCode = parsed.data.status === "SHIPPED" ? serializeTrackingCodes(trackingCodesInput) : "";

  // لغو توسط ادمین باید دقیقاً مثل لغو توسط مشتری/رد فیش پرداخت، موجودی
  // variant/حراج‌فلش، مصرف کوپن، و مبلغ کیف‌پول رزروشده رو برگردونه -- قبلاً
  // این مسیر فقط status رو عوض می‌کرد و منابع رزروشده برای همیشه گیر می‌موندن
  const order =
    parsed.data.status === "CANCELLED"
      ? await prisma.$transaction(async (tx) => {
          await restoreOrderResources(tx, existing);
          return tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
        })
      : await prisma.order.update({
          where: { id },
          data: {
            status: parsed.data.status,
            ...(parsed.data.status === "SHIPPED" ? { trackingCode } : {}),
            // اولین باری که سفارش تحویل داده می‌شه، زمانش رو ثبت می‌کنیم -- مبنای مهلت ۷ روزه مرجوعی
            ...(parsed.data.status === "DELIVERED" && !existing?.deliveredAt
              ? { deliveredAt: new Date() }
              : {}),
          },
        });

  const historyNote =
    parsed.data.status === "CANCELLED"
      ? `لغو توسط ادمین -- ${reason}`
      : parsed.data.status === "SHIPPED"
      ? `سفارش توسط ادمین ارسال شد -- ${trackingLabel}(های): ${trackingCodesInput.join("، ")}`
      : parsed.data.status === "DELIVERED"
      ? "سفارش توسط ادمین تحویل‌داده‌شده ثبت شد"
      : "بروزرسانی توسط ادمین";

  await prisma.orderStatusHistory.create({
    data: { orderId: id, status: parsed.data.status, note: historyNote },
  });

  // برای ارسال، برچسب کد رهگیری/شماره پیک بسته به نحوه‌ی ارسال فرق می‌کنه --
  // پیک موتوری یعنی شماره تماس، بقیه‌ی روش‌ها (پست/تیپاکس) یعنی کد رهگیری واقعی
  const shippedMessage =
    parsed.data.status === "SHIPPED"
      ? `سفارش شما ارسال شد -- ${trackingLabel}(های): ${trackingCodesInput.join("، ")}`
      : null;
  const statusMessage = shippedMessage ?? ORDER_STATUS_NOTIFICATION_MESSAGES[parsed.data.status];
  if (existing && existing.status !== parsed.data.status && statusMessage) {
    await prisma.notification.create({
      data: { userId: existing.userId, message: statusMessage, link: `/orders/${id}` },
    });
  }

  return NextResponse.json(order);
}
