import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHIPPING_METHODS, NO_COST_SHIPPING_METHODS, calculateShipping, isTehranCity, GIFT_WRAP_COST } from "@/lib/shipping";
import { z } from "zod";

const addressSchema = z.object({
  title: z.string().min(1, "عنوان آدرس الزامی است"),
  fullName: z.string().min(2, "نام گیرنده باید حداقل ۲ حرف باشد"),
  phone: z.string().min(8, "شماره تماس معتبر نیست"),
  province: z.string().min(1, "استان الزامی است"),
  city: z.string().min(1, "شهر الزامی است"),
  postalCode: z.string().min(5, "کد پستی معتبر نیست"),
  detail: z.string().min(3, "آدرس کامل الزامی است"),
});

const schema = z.object({
  newAddress: addressSchema,
  shippingMethod: z.string().optional(),
});

// مشتری فقط تا وقتی سفارش هنوز PENDINGه (یعنی هنوز هزینه ارسال نهایی/پرداخت
// نشده) می‌تونه خودش آدرس/نحوه ارسال رو عوض کنه -- دقیقاً همون پنجره‌ای که
// ویرایش اقلام سفارش هم داره. بعد از این مرحله، هزینه ارسال قبلاً محاسبه و
// در معرض پرداخت شده، پس تغییرش باید از راه ادمین (با تسویه‌ی اختلاف قیمت)
// انجام بشه: src/app/api/admin/orders/[id]/change-address/route.ts
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  }
  if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
    return NextResponse.json(
      {
        error:
          "هزینه ارسال این سفارش قبلاً مشخص شده -- برای تغییر آدرس با پشتیبانی در میان بگذارید",
      },
      { status: 400 }
    );
  }

  const hasExternalItems = order.items.some((i) => i.source === "TRENDYOL");
  let newShippingMethod = order.shippingMethod;
  let newShippingCost = order.shippingCost;

  if (!hasExternalItems) {
    const method = parsed.data.shippingMethod ?? order.shippingMethod ?? undefined;
    if (!method || !SHIPPING_METHODS.includes(method as (typeof SHIPPING_METHODS)[number])) {
      return NextResponse.json({ error: "نحوه ارسال معتبر نیست" }, { status: 400 });
    }
    if (method === "پیک موتوری" && !isTehranCity(parsed.data.newAddress.city)) {
      return NextResponse.json(
        { error: "پیک موتوری فقط برای آدرس‌های تهران ممکنه -- نحوه ارسال دیگه‌ای انتخاب کن" },
        { status: 400 }
      );
    }
    const isNoCostMethod = NO_COST_SHIPPING_METHODS.includes(method as (typeof NO_COST_SHIPPING_METHODS)[number]);
    newShippingCost = order.freeShippingApplied || isNoCostMethod ? 0 : calculateShipping(order.subtotal);
    newShippingMethod = method;
  }

  // جمع کلِ قطعی (subtotal - discount + giftWrap + newShipping) --
  // incrementِ shippingDiff بعد از هر ویرایشِ قلمِ ادمین (که total رو بدون
  // ارسال بازمحاسبه می‌کنه) غلط می‌شد؛ این‌جا base رو از روی اقلامِ فعلی
  // محاسبه می‌کنیم تا همیشه درست باشه
  const baseTotal = order.subtotal - order.discountTotal + (order.giftWrap ? GIFT_WRAP_COST : 0);
  const finalTotal = baseTotal + (newShippingCost ?? 0);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      addressId: null,
      addressSnapshot: JSON.stringify(parsed.data.newAddress),
      ...(!hasExternalItems
        ? { shippingMethod: newShippingMethod, shippingCost: newShippingCost, total: finalTotal }
        : {}),
    },
  });

  await prisma.orderStatusHistory.create({
    data: { orderId: id, status: order.status, note: "آدرس سفارش توسط مشتری تغییر کرد" },
  });

  return NextResponse.json(updated);
}
