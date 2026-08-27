import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchTrendyolProductById } from "@/lib/trendyol";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { GIFT_WRAP_COST, NO_COST_SHIPPING_METHODS, SHIPPING_METHODS, calculateShipping, isTehranCity } from "@/lib/shipping";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { UserFacingError } from "@/lib/errors";
import { finalizeItemsPayment } from "@/lib/orderFinalizePayment";
import { getSiteSettingBool, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { resolveExternalSiteIdFromUrl } from "@/lib/externalSites";
import { rateLimitOrNull, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { Prisma } from "@prisma/client";
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
  variantLabel: z.string().optional(), // مثلاً "سایز: L / رنگ: قرمز"
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
  // فقط وقتی CASH_ON_DELIVERY_ENABLED روشنه معتبره -- وگرنه سرور نادیده
  // می‌گیرتش (پایین‌تر) و همون کارت‌به‌کارتِ پیش‌فرض اعمال می‌شه
  paymentMethod: z.enum(["CARD_TRANSFER", "CASH_ON_DELIVERY"]).default("CARD_TRANSFER"),
  // فقط برای خریدِ مهمان (بدون لاگین) لازمن
  guestName: z.string().min(2).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(8).optional(),
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
  const limited = rateLimitOrNull(req, "ORDER_CREATE");
  if (limited) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE(limited.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const session = await auth();

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { items, addressId, newAddress, shippingMethod, giftWrap, couponCode, useWallet, paymentMethod, guestName, guestEmail, guestPhone } =
    parsed.data;

  // اگه ادمین از تنظیمات پرداخت‌درمحل رو خاموش کرده ولی کلاینت (مثلاً تب قدیمی
  // باز مونده) هنوز CASH_ON_DELIVERY فرستاده، بی‌سروصدا به کارت‌به‌کارت
  // برمی‌گردیم -- نه خطا، چون این یه انتخابِ نمایشیه نه چیزی که مشتری اونو
  // «خراب» کرده باشه
  const resolvedPaymentMethod =
    paymentMethod === "CASH_ON_DELIVERY" && (await getSiteSettingBool(SITE_SETTING_KEYS.CASH_ON_DELIVERY_ENABLED))
      ? "CASH_ON_DELIVERY"
      : "CARD_TRANSFER";

  // خریدِ مهمان دفترچه‌ی کیف‌پول ندارد (بدون لاگین موجودی‌ای برای اعمال وجود
  // ندارد) -- finalizeItemsPayment عملاً همیشه صفر محاسبه می‌کند، ولی ذخیره‌ی
  // useWalletRequested=true روی سفارشِ مهمان گمراه‌کننده است؛ بی‌سروصدا false می‌شود
  const resolvedUseWallet = session?.user?.id ? useWallet : false;

  // خریدِ مهمان: بدون لاگین هم می‌شه سفارش ثبت کرد، ولی فقط با newAddress (نه
  // آدرسِ ذخیره‌شده -- مهمان دفترچه‌ی آدرس ندارد) و نام/ایمیل/تلفن. یه کاربرِ
  // سایه‌ای (isGuest=true, بدون رمز) ساخته یا پیدا می‌شود تا همه‌ی زیرساخت‌های
  // موجود (اعلان، رفاند، معرفی و ...) بدون تغییر کار کنند
  let userId: string;
  let customerName: string;
  let customerEmail: string;
  if (session?.user?.id) {
    userId = session.user.id;
    customerName = session.user.name ?? session.user.email ?? "";
    customerEmail = session.user.email ?? "";
  } else {
    if (!newAddress || !guestName || !guestEmail || !guestPhone) {
      return NextResponse.json(
        { error: "برای خریدِ بدون ثبت‌نام، نام و ایمیل و شماره تماس لازم است" },
        { status: 400 }
      );
    }
    const existingUser = await prisma.user.findUnique({ where: { email: guestEmail } });
    if (existingUser && !existingUser.isGuest) {
      return NextResponse.json(
        { error: "این ایمیل قبلاً ثبت‌نام کرده است -- لطفاً وارد حساب خود شوید" },
        { status: 409 }
      );
    }
    const guestUser =
      existingUser ??
      (await prisma.user.create({
        data: { name: guestName, email: guestEmail, phone: guestPhone, isGuest: true },
      }).catch(() =>
        // شماره تماس با کاربرِ دیگری برخورد کرد (یکتاست) -- بدونِ شماره دوباره بساز
        prisma.user.create({ data: { name: guestName, email: guestEmail, isGuest: true } })
      ));
    userId = guestUser.id;
    customerName = guestName;
    customerEmail = guestEmail;
  }

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
    externalSiteId: string | null;
    flashSaleId: string | null;
    source: "MAZON" | "TRENDYOL";
    title: string;
    image: string | null;
    price: number;
    quantity: number;
    variantLabel: string | null;
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

      // موجودی فقط روی ProductVariant نگه‌داری می‌شه (Product خودش فیلد stock
      // نداره) -- پس اگه محصول حتی یه ترکیب هم داشته باشه، انتخابِ ترکیب
      // (variantId) الزامیه؛ وگرنه کل بلوکِ چکِ موجودی زیر (هم اینجا هم چکِ
      // اتمیکِ داخل تراکنش) رد می‌شه و می‌شه با هر تعدادی، بدون کم‌شدنِ هیچ
      // موجودی‌ای، سفارش ثبت کرد. محصولی که اصلاً ترکیبی نداره (طبق قراردادِ
      // همین پروژه توی ساختِ محصول: «عدم وجودِ ترکیب یعنی عدم موجودی») هم
      // ذاتاً قابل‌فروش نیست -- چیزی برای کم‌کردن ازش وجود نداره
      if (product.variants.length === 0) {
        return NextResponse.json(
          { error: `محصول «${product.title}» موجود نیست` },
          { status: 400 }
        );
      }
      if (!item.variantId) {
        return NextResponse.json(
          { error: `لطفاً ترکیب (سایز/رنگ) «${product.title}» را انتخاب کنید` },
          { status: 400 }
        );
      }
      const variant = product.variants.find((v) => v.id === item.variantId) ?? null;
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
      const priceDiff = variant.priceDiff;

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
        externalSiteId: null,
        flashSaleId: resolvedFlashSaleId,
        source: "MAZON",
        title: product.title,
        image: images[0] ?? null,
        price: unitPrice,
        quantity: item.quantity,
        variantLabel: item.variantLabel ?? null,
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
        // دموی قدیمی (Fake Store API) هیچ لینکِ واقعیِ ترندیول/میلا‌ای نداره،
        // پس سایتش قابل‌تشخیص نیست -- null یعنی «نامشخص»، نه یه سایتِ خاص
        externalSiteId: null,
        flashSaleId: null,
        source: "TRENDYOL",
        title: trendyolProduct.title,
        image: trendyolProduct.image,
        price: trendyolProduct.price,
        quantity: item.quantity,
        variantLabel: item.variantLabel ?? null,
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
        externalSiteId: await resolveExternalSiteIdFromUrl(trendyolUrl),
        flashSaleId: null,
        source: "TRENDYOL",
        title: detail.nameFa,
        image: detail.images[0] ?? null,
        price: detail.price,
        quantity: item.quantity,
        variantLabel: item.variantLabel ?? null,
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
  let resolvedCoupon: { id: string; code: string; maxUses: number | null; type: string } | null = null;

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
    resolvedCoupon = { id: coupon.id, code: coupon.code, maxUses: coupon.maxUses, type: coupon.type };
  }

  // هزینه ارسال برای سفارش‌های فقط-مزون همین‌جا قابل محاسبه‌ست: روش‌های
  // NO_COST («پیک موتوری»/«تیپاکس» که هزینه مستقیم به تحویل‌دهنده پرداخت
  // می‌شه) یا کوپن ارسال رایگان => صفر؛ روش پستی => SHIPPING_COST مگر سبد
  // بالاتر از آستانه‌ی ارسال رایگان باشد. سفارش‌های حاوی کالای خارجی (باربری)
  // همچنان بعداً توسط ادمین تعیین می‌شه (این‌حا null).
  let resolvedShippingCost: number | null = null;
  if (!hasExternalItems) {
    const isNoCostMethod = NO_COST_SHIPPING_METHODS.includes(
      validatedShippingMethod as (typeof NO_COST_SHIPPING_METHODS)[number]
    );
    // توگلِ «هزینه‌ی ارسال از قبل توی قیمت کالا لحاظ شده» -- اگه روشنه، اینجا
    // نباید هیچ ارسالی روی total گذاشته بشه (وگرنه finalizeItemsPayment مسیر
    // خودش صفرش می‌کنه ولی این مقدارِ از قبل پخته‌شده توی total می‌مونه و
    // مشتری یه‌بار اضافه پرداخت می‌کنه)
    const skipShippingCalculation = await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_SHIPPING_CALCULATION);
    resolvedShippingCost =
      freeShipping || isNoCostMethod || skipShippingCalculation ? 0 : calculateShipping(subtotal);
  }

  const giftWrapCost = giftWrap ? GIFT_WRAP_COST : 0;
  const total = subtotal - discountTotal + giftWrapCost + (resolvedShippingCost ?? 0);

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
            throw new UserFacingError(`موجودی «${item.title}» به‌طور همزمان تمام شد`);
          }
        }
        if (item.flashSaleId) {
          const result = await tx.flashSale.updateMany({
            where: { id: item.flashSaleId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new UserFacingError(`موجودی حراج «${item.title}» به‌طور همزمان تمام شد`);
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
          throw new UserFacingError("ظرفیت این کد تخفیف هم‌زمان تمام شد");
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          addressId: resolvedAddressId,
          subtotal,
          shippingCost: resolvedShippingCost,
          shippingMethod: validatedShippingMethod,
          freeShippingApplied: freeShipping,
          useWalletRequested: resolvedUseWallet,
          paymentMethod: resolvedPaymentMethod,
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
              externalSiteId: i.externalSiteId,
              flashSaleId: i.flashSaleId,
              source: i.source,
              title: i.title,
              image: i.image,
              price: i.price,
              quantity: i.quantity,
              variantLabel: i.variantLabel,
            })),
          },
        },
        include: { items: true },
      });

      await tx.orderStatusHistory.create({
        data: { orderId: createdOrder.id, status: "PENDING", note: "سفارش توسط مشتری ثبت شد" },
      });

      // بک‌استاپِ اتمیکِ FIRST_BUY: چکِ previousOrders بالا خارج از تراکنش بود و
      // در برابر دو درخواستِ هم‌زمان امن نیست (هر دو می‌تونن صفر ببینن). این ردیف
      // چون userId یکتاست، تلاشِ دومِ هم‌زمان رو با شکستِ کل تراکنش رد می‌کنه
      if (resolvedCoupon?.type === "FIRST_BUY") {
        try {
          await tx.firstBuyClaim.create({ data: { userId, orderId: createdOrder.id } });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new UserFacingError("این کد فقط برای اولین خرید معتبر است");
          }
          throw err;
        }
      }

      // سفارش با موفقیت ثبت شد -- دیگه «رهاشده» نیست، عکسِ لحظه‌ایِ سبد رو پاک
      // کن. باید همراهِ خودِ سفارش اتمیک باشه، وگرنه اگه بعد از کامیت یه خطای
      // جدا رخ بده، سبدِ سفارش‌شده هنوز به‌عنوانِ «رهاشده» می‌مونه و مشتری یه
      // یادآوریِ نابه‌جا می‌گیره برای چیزی که قبلاً سفارش داده
      if (session?.user?.id) {
        await tx.cartSnapshot.deleteMany({ where: { userId: session.user.id } });
      }

      return createdOrder;
    });

    // اگه «تأییدِ اولیه‌ی ادمین» از تنظیمات خاموشه، همون‌جا (بدونِ منتظرِ باز
    // کردنِ دستیِ سفارش توسط ادمین) نهایی‌سازیِ دورِ اولِ پرداخت رو با کارتِ
    // پیش‌فرض انجام می‌دیم -- دقیقاً همون کاری که finalize-shipping دستی انجام
    // می‌ده. اگه به هر دلیلی نشد (مثلاً هیچ کارتِ پیش‌فرضی تنظیم نشده)، بی‌سروصدا
    // به همون مسیرِ عادیِ «منتظرِ بررسیِ ادمین» برمی‌گرده -- مشتری هیچ‌وقت به‌خاطرِ
    // یه تنظیمِ ناقص، وسطِ خرید گیر نمی‌کنه
    let autoFinalized = false;
    if (await getSiteSettingBool(SITE_SETTING_KEYS.SKIP_ADMIN_REVIEW)) {
      const result = await finalizeItemsPayment(order.id, {});
      if (result.ok) {
        await prisma.order.update({ where: { id: order.id }, data: { status: "PROCESSING" } });
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: "PROCESSING",
            note: "سفارش بدونِ نیاز به بررسیِ دستیِ ادمین، خودکار پردازش شد",
          },
        });
        autoFinalized = true;
      }
    }

    // هر سفارش تازه باید ادمین رو برای بررسی/تعیین هزینه ارسال خبر کنه، مگر
    // این‌که همین الان خودکار نهایی شده باشه (اون‌وقت چیزی برای بررسی نمونده)
    {
      const shortId = order.id.slice(-8);
      if (!autoFinalized) {
        await notifyAdminsOnce(
          `سفارش جدید #${shortId}`,
          `سفارش جدید #${shortId} توسط ${customerName || customerEmail}${session?.user?.id ? "" : " (خریدِ مهمان)"} ثبت شد -- مبلغ ${order.total.toLocaleString(
            "fa-IR"
          )} تومان ${order.shippingCost === null ? "(هزینه ارسال/باربری بعد از وزن‌کشی اعلام می‌شود)" : "(شامل هزینه ارسال)"}. برای بررسی، نهایی‌سازی و تخصیص شماره کارت به پنل سفارش‌ها مراجعه کنید.`,
          `/admin/orders/${order.id}`
        );
      }
      await notifyCustomerOutbound({
        userId: order.userId,
        eventType: "ORDER_CREATED",
        title: `سفارش #${shortId} ثبت شد`,
        body: `سفارش #${shortId} شما با موفقیت ثبت شد و پس از تأیید پرداخت، آماده‌سازی می‌شود.`,
      });
    }

    const responseOrder = autoFinalized
      ? ((await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } })) ?? order)
      : order;
    return NextResponse.json(responseOrder, { status: 201 });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof UserFacingError && err.message
        ? err.message
        : "خطای غیرمنتظره در ثبت سفارش";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
