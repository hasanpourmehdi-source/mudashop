import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchTrendyolProductById } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { GIFT_WRAP_COST, SHIPPING_METHODS, isTehranCity } from "@/lib/shipping";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { z } from "zod";

// محصولات دموی قدیمی (Fake Store API) فقط ۲۰ تا محصول دارن (id های ۱ تا ۲۰)؛
// contentId های محصولات واقعی ترندیول (از /marketplaces/trendyol، کارت‌های
// لایو و «نگاه سریع») همیشه حداقل ۷-۸ رقمی‌ان -- یه آستانه‌ی امن (زیر ۱۰۰۰)
// این دو رو از هم تشخیص می‌ده، دقیقاً همون منطقی که products/trendyol/[slug]
// برای تشخیص slug قدیمی/جدید استفاده می‌کنه
function isLegacyDemoTrendyolId(id: string): boolean {
  return /^\d+$/.test(id) && Number(id) < 1000;
}

const orderItemSchema = z.object({
  source: z.enum(["MAZON", "TRENDYOL"]),
  productId: z.string(), // slug (مزون) یا external id (ترندیول)
  variantId: z.string().optional(),
  flashSaleId: z.string().optional(),
  quantity: z.number().int().positive("تعداد باید حداقل ۱ باشد"),
});

const newAddressSchema = z.object({
  title: z.string().min(1, "عنوان آدرس الزامی است"),
  fullName: z.string().min(2, "نام گیرنده باید حداقل ۲ حرف باشد"),
  phone: z.string().min(8, "شماره تماس معتبر نیست"),
  province: z.string().min(1, "استان الزامی است"),
  city: z.string().min(1, "شهر الزامی است"),
  postalCode: z.string().min(5, "کد پستی معتبر نیست"),
  detail: z.string().min(3, "آدرس کامل الزامی است"),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "سبد خرید نمی‌تواند خالی باشد"),
  addressId: z.string().optional(),
  newAddress: newAddressSchema.optional(),
  shippingMethod: z.string().optional(),
  giftWrap: z.boolean().default(false),
  couponCode: z.string().optional(),
  useWallet: z.boolean().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { items, addressId, newAddress, shippingMethod, giftWrap, couponCode, useWallet } = parsed.data;

  if (!addressId && !newAddress) {
    return NextResponse.json({ error: "آدرس ارسال لازم است" }, { status: 400 });
  }

  // IDOR-safe: اگه addressId داده شده باید متعلق به همین کاربر باشه
  let resolvedAddressId: string | null = null;
  let addressSnapshot: {
    title: string;
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    detail: string;
  };

  if (addressId) {
    const addr = await prisma.address.findUnique({ where: { id: addressId } });
    if (!addr || addr.userId !== userId) {
      return NextResponse.json({ error: "آدرس نامعتبر است" }, { status: 400 });
    }
    resolvedAddressId = addr.id;
    addressSnapshot = addr;
  } else {
    addressSnapshot = newAddress!;
  }

  // قیمت و موجودی هر آیتم رو دوباره از منبع اصلی (نه از کلاینت) محاسبه می‌کنیم
  // تا کاربر نتونه قیمت یا تخفیف حراج فلش رو دستکاری کنه
  type ResolvedItem = {
    productId: string | null;
    variantId: string | null;
    externalId: string | null;
    flashSaleId: string | null;
    source: "MAZON" | "TRENDYOL";
    title: string;
    image: string | null;
    price: number;
    quantity: number;
  };
  const resolvedItems: ResolvedItem[] = [];

  for (const item of items) {
    if (item.source === "MAZON") {
      const product = await prisma.product.findUnique({
        where: { slug: item.productId },
        include: { variants: { include: { values: true } } },
      });
      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `محصول «${item.productId}» یافت نشد` },
          { status: 400 }
        );
      }

      let priceDiff = 0;
      let variant = null;
      if (item.variantId) {
        variant = product.variants.find((v) => v.id === item.variantId) ?? null;
        if (!variant) {
          return NextResponse.json(
            { error: "ترکیب انتخابی نامعتبر است" },
            { status: 400 }
          );
        }
        if (variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `موجودی «${product.title}» کافی نیست` },
            { status: 400 }
          );
        }
        priceDiff = variant.priceDiff;
      }

      // اگه flashSaleId ارسال شده، فعال بودنش رو خودمون از DB تأیید می‌کنیم (نه از کلاینت)
      let effectiveDiscount = product.discount;
      let resolvedFlashSaleId: string | null = null;
      if (item.flashSaleId) {
        const now = new Date();
        const flashSale = await prisma.flashSale.findFirst({
          where: {
            id: item.flashSaleId,
            productId: product.id,
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        });
        if (flashSale) {
          if (flashSale.stock < item.quantity) {
            return NextResponse.json(
              { error: `موجودی حراج «${product.title}» کافی نیست` },
              { status: 400 }
            );
          }
          effectiveDiscount = flashSale.discountPercent;
          resolvedFlashSaleId = flashSale.id;
        }
      }

      const unitPrice =
        Math.round(product.basePrice * (1 - effectiveDiscount / 100)) + priceDiff;

      let images: string[] = [];
      try {
        images = JSON.parse(product.images);
      } catch {
        images = [product.images];
      }

      resolvedItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        externalId: null,
        flashSaleId: resolvedFlashSaleId,
        source: "MAZON",
        title: product.title,
        image: images[0] ?? null,
        price: unitPrice,
        quantity: item.quantity,
      });
    } else if (isLegacyDemoTrendyolId(item.productId)) {
      // محصول دموی قدیمی (کاتالوگ نمایشی صفحه‌ی اصلی، از Fake Store API)
      const trendyolProduct = await fetchTrendyolProductById(item.productId);
      if (!trendyolProduct) {
        return NextResponse.json(
          { error: `محصول ترندیول «${item.productId}» یافت نشد` },
          { status: 400 }
        );
      }
      resolvedItems.push({
        productId: null,
        variantId: null,
        externalId: item.productId,
        flashSaleId: null,
        source: "TRENDYOL",
        title: trendyolProduct.title,
        image: trendyolProduct.image,
        price: trendyolProduct.price,
        quantity: item.quantity,
      });
    } else {
      // محصول واقعی از /marketplaces/trendyol (کارت لایو یا «نگاه سریع») --
      // اینا توی جدول محلی نیستن، باید از روی contentId آدرس کامل رو از کش
      // پیدا کنیم و قیمت/موجودی لحظه‌ای رو دوباره مستقیم از ترندیول بگیریم
      // (نه از قیمتی که کلاینت فرستاده)
      const trendyolUrl = await getCachedTrendyolProductUrl(item.productId);
      if (!trendyolUrl) {
        return NextResponse.json(
          { error: `محصول ترندیول «${item.productId}» یافت نشد` },
          { status: 400 }
        );
      }

      let detail;
      try {
        detail = await fetchTrendyolProductDetail(trendyolUrl);
      } catch (err) {
        console.warn("خطا در واکشی جزئیات محصول ترندیول در لحظه‌ی ثبت سفارش:", err);
        await logTrendyolFetchFailure({ url: trendyolUrl, error: String(err), source: "checkout" });
        detail = null;
      }

      if (!detail || detail.price == null) {
        return NextResponse.json(
          { error: `محصول ترندیول «${item.productId}» در حال حاضر در دسترس نیست` },
          { status: 400 }
        );
      }
      if (!detail.inStock) {
        return NextResponse.json(
          { error: `محصول «${detail.nameFa}» دیگر موجود نیست` },
          { status: 400 }
        );
      }

      resolvedItems.push({
        productId: null,
        variantId: null,
        externalId: item.productId,
        flashSaleId: null,
        source: "TRENDYOL",
        title: detail.nameFa,
        image: detail.images[0] ?? null,
        price: detail.price,
        quantity: item.quantity,
      });
    }
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // نحوه‌ی ارسال فقط برای سبد فقط-مزون لازمه (سفارش حاوی کالای خارجی، نحوه/هزینه‌ی
  // ارسالش بعد از خرید و وزن‌کشی توسط ادمین مشخص می‌شه) -- قانون «پیک موتوری فقط
  // برای تهران» هم مستقل از کلاینت اینجا دوباره چک می‌شه
  const hasExternalItems = resolvedItems.some((i) => i.source === "TRENDYOL");
  let validatedShippingMethod: string | null = null;
  if (!hasExternalItems) {
    if (!shippingMethod || !SHIPPING_METHODS.includes(shippingMethod as (typeof SHIPPING_METHODS)[number])) {
      return NextResponse.json({ error: "نحوه ارسال را انتخاب کنید" }, { status: 400 });
    }
    if (shippingMethod === "پیک موتوری" && !isTehranCity(addressSnapshot.city)) {
      return NextResponse.json(
        { error: "ارسال با پیک فقط برای آدرس‌های تهران امکان‌پذیر است" },
        { status: 400 }
      );
    }
    validatedShippingMethod = shippingMethod;
  }

  // اعتبارسنجی سرور-ساید کوپن (شبیه به /api/coupons/validate ولی مستقل، چون این نقطه مصرف واقعیه)
  let discountTotal = 0;
  let freeShipping = false;
  let resolvedCoupon: { id: string; code: string; maxUses: number | null } | null = null;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: "کد تخفیف نامعتبر است" }, { status: 400 });
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: "این کد تخفیف منقضی شده است" }, { status: 400 });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ error: "ظرفیت این کد تخفیف تمام شده است" }, { status: 400 });
    }
    if (subtotal < coupon.minOrderAmount) {
      return NextResponse.json({ error: "مبلغ سفارش به حداقل لازم نرسیده است" }, { status: 400 });
    }
    if (coupon.type === "FIRST_BUY") {
      const previousOrders = await prisma.order.count({
        where: { userId, status: { not: "CANCELLED" } },
      });
      if (previousOrders > 0) {
        return NextResponse.json(
          { error: "این کد فقط برای اولین خرید معتبر است" },
          { status: 400 }
        );
      }
    }

    if (coupon.type === "PERCENT" || coupon.type === "FIRST_BUY") {
      discountTotal = Math.round((subtotal * coupon.value) / 100);
    } else if (coupon.type === "FIXED") {
      discountTotal = Math.min(coupon.value, subtotal);
    } else if (coupon.type === "FREE_SHIP") {
      freeShipping = true;
    }
    resolvedCoupon = { id: coupon.id, code: coupon.code, maxUses: coupon.maxUses };
  }

  // هزینه ارسال دیگه اینجا حساب نمی‌شه -- ادمین موقع بررسی سفارش (بعد از محاسبه‌ی
  // باربری) دستی وارد می‌کنه. پس این «total» موقتیه (بدون هزینه ارسال)، فقط برای
  // نمایش تا قبل از نهایی‌سازی؛ کیف‌پول هم تا اون لحظه اعمال نمی‌شه چون مبلغ
  // نهایی کامل نیست -- فقط نیت مشتری (useWalletRequested) ذخیره می‌شه
  const giftWrapCost = giftWrap ? GIFT_WRAP_COST : 0;
  const total = subtotal - discountTotal + giftWrapCost;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // موجودی هر variant رو به‌صورت اتمیک و شرطی کم می‌کنیم تا از overselling جلوگیری بشه
      for (const item of resolvedItems) {
        if (item.variantId) {
          const result = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new Error(`موجودی «${item.title}» به‌طور همزمان تمام شد`);
          }
        }
        if (item.flashSaleId) {
          const result = await tx.flashSale.updateMany({
            where: { id: item.flashSaleId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new Error(`موجودی حراج «${item.title}» به‌طور همزمان تمام شد`);
          }
        }
      }

      // مصرف اتمیک و شرطی کوپن (جلوگیری از race condition روی maxUses)
      if (resolvedCoupon) {
        const couponResult = await tx.coupon.updateMany({
          where: {
            id: resolvedCoupon.id,
            ...(resolvedCoupon.maxUses !== null
              ? { usedCount: { lt: resolvedCoupon.maxUses } }
              : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (couponResult.count === 0) {
          throw new Error("ظرفیت این کد تخفیف هم‌زمان تمام شد");
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          addressId: resolvedAddressId,
          subtotal,
          shippingCost: null,
          shippingMethod: validatedShippingMethod,
          freeShippingApplied: freeShipping,
          useWalletRequested: useWallet,
          discountTotal,
          total,
          giftWrap,
          couponCode: resolvedCoupon?.code,
          walletUsed: 0,
          // پرداخت/کیف‌پول تا وقتی ادمین هزینه ارسال رو تعیین نکنه نهایی نمی‌شه
          paymentStatus: "PENDING",
          paidAt: null,
          paymentAuthority: null,
          addressSnapshot: JSON.stringify(addressSnapshot),
          items: {
            create: resolvedItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              externalId: i.externalId,
              flashSaleId: i.flashSaleId,
              source: i.source,
              title: i.title,
              image: i.image,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      await tx.orderStatusHistory.create({
        data: { orderId: createdOrder.id, status: "PENDING", note: "سفارش توسط مشتری ثبت شد" },
      });

      return createdOrder;
    });

    // هر سفارش تازه باید ادمین رو برای بررسی/تعیین هزینه ارسال خبر کنه (چون
    // paymentStatus همیشه PENDING شروع می‌شه، دیگه شرطی نداره)
    {
      const shortId = order.id.slice(-8);
      await notifyAdminsOnce(
        `سفارش جدید #${shortId}`,
        `سفارش جدید #${shortId} توسط ${session.user.name ?? session.user.email} ثبت شد -- مبلغ اولیه ${order.total.toLocaleString(
          "fa-IR"
        )} تومان (بدون هزینه ارسال). برای بررسی، تعیین هزینه ارسال و تخصیص شماره کارت به پنل سفارش‌ها مراجعه کنید.`,
        `/admin/orders/${order.id}`
      );
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "خطا در ثبت سفارش";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
