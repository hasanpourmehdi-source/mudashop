"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  buildCaption,
  buildTelegramNote,
  buildGeneratedHashtags,
  buildGenderHashtags,
  isGenderOnlyHashtag,
  extractBasketDiscountPercent,
  extractTrendyolLinkFromText,
  getDiscountPercent,
  isCouponCodeCampaign,
  ltrIsolate,
  MAX_TOTAL_HASHTAGS,
  pickKeyAttributes,
  priceToman,
  resolveShareTargetInput,
  toEnglishBrandName,
} from "@/lib/poster";
import { siteUrl } from "@/lib/seo";
import { foldTurkish } from "@/lib/turkishText";
import { PosterUntranslatedTerms } from "@/components/PosterUntranslatedTerms";
import { TranslatableRun } from "@/components/AdminClickToTranslate";

// ساخت نمونه‌ی تصویر DOM (نه کامپوننت next/image) برای رندر روی کانواس
const newImage = () => new globalThis.Image();

type SearchResult = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  originalPrice: number | null;
  url: string | null;
  category: string | null;
};

type ProductDetail = {
  contentId: string;
  name: string;
  nameFa: string;
  brand: string | null;
  // معادلِ فارسیِ برند -- فقط وقتی از قبل توی دیکشنری اضافه شده (مثلِ سایرِ
  // کلماتِ ناشناخته)، وگرنه همون brand رو (بدونِ ترجمه) برمی‌گردونه
  brandFa: string | null;
  categoryName: string | null;
  // جنسیتِ محصول از دیتای خودِ صفحه‌ی ترندیول (وقتی توی عنوان/مشخصات نیست)
  genderFa: string | null;
  images: string[];
  attributes: { name: string; value: string }[];
  sizes: string[];
  colorCount: number;
  // رنگ‌های دیگرِ همین محصول (بدونِ خودِ رنگِ فعلی) -- برای عکسِ اضافه‌ی
  // «رنگ‌های دیگر موجود» که همراهِ بقیه‌ی عکس‌ها ساخته می‌شه
  colorVariants: { colorName: string; image: string }[];
  price: number | null;
  originalPrice: number | null;
  priceTL: number | null;
  originalPriceTL: number | null;
  // یعنی priceTL/originalPriceTL از قبل یه تخفیفِ سبدخریدِ ترندیول توش
  // خورده -- اگه true باشه، دیگه نباید campaignBadges (پایین‌تر توی
  // basketDiscountPct) هم دوباره روی همین قیمت اعمال بشه (وگرنه یه تخفیف
  // دوبار حساب می‌شه)
  priceIncludesBasketDiscount: boolean;
  inStock: boolean;
  url: string;
  tag: string;
  campaignBadges: {
    id: number;
    text: string;
    rawNameTr: string;
    // "DiscountOnBasket" یعنی تخفیفِ حتمی/خودکارِ سبدخرید (مثلِ «Sepette %20
    // İndirim») -- برخلافِ بقیه‌ی کمپین‌ها که فقط نمایشی/شرطی‌ان، این یکی
    // مستقیم روی قیمتِ نهایی اثر داره، پس روی پوستر باید به‌جای باکسِ نارنجی،
    // مستقیم روی خودِ قیمت اعمال بشه
    discountType: string | null;
  }[];
  // تاریخ‌هایی که قبلاً پوسترِ همین محصول ساخته و دانلود شده (یعنی احتمالاً
  // قبلاً توی اینستاگرام پست شده) -- خالی/نبودن یعنی هنوز پست نشده
  previousPosts?: { postedAt: string }[];
};

// ۱۰۸۰x۱۳۵۰ (نسبت ۴:۵) -- سایزِ عمودیِ مجازِ اینستاگرام، نه مربع
const POSTER_W = 1080;
const POSTER_H = 1350;
// تقسیمِ عمودی: نیمه‌ای که عکس صاف دیده می‌شه در برابرِ نیمه‌ای که ستونِ
// اطلاعات روش می‌شینه -- پیش‌فرض ستونِ اطلاعات سمتِ راسته (چون فارسی از راست
// خوانده می‌شه)، ولی چون کدومِ سمتِ عکسِ محصول شلوغ/تیره‌ست فرق می‌کنه، این با
// layoutMirrored در drawPoster قابلِ برعکس‌شدنه؛ فقط INFO_X/COL_X (موقعیت،
// نه عرض) به سمت وابسته‌ن، پس همونا رو تابع خودش حساب می‌کنه، نه اینجا
const PHOTO_W = 540;
const INFO_W = POSTER_W - PHOTO_W;
// فاصله‌ی سمتِ عکسِ ستون از خودِ عکس بیشتره (کمتر تصرفِ محتوای عکس، چون عکس
// گاهی تا اینجا هم سرریز می‌کند)، فاصله‌ی سمتِ لبه‌ی کانواس کمتره -- عرضِ کلیِ
// ستون هم به همین خاطر کمتر از قبل می‌شود
const COL_LEFT_INSET = 90;
const COL_RIGHT_INSET = 14;
const COL_W = INFO_W - COL_LEFT_INSET - COL_RIGHT_INSET;
// بک‌گراندِ همه‌ی باکس‌های ستونِ اطلاعات ترانسپارنته -- عکسِ زیرش (وقتی عکس تا
// این ناحیه سرریز می‌کند) باید پیدا باشه، نه این‌که باکس کاملاً پوششش بده
const BOX_BG_ALPHA = 0.45;

// رنگ‌های ردیف‌های اطلاعات
const C_PURPLE = "#6d4bc1";
const C_ORANGE = "#f97316";
const C_KHAKI = "#cbb488";
const C_KHAKI_TEXT = "#5b4522";
const C_RED = "#e11d48";
// قیمتِ نهایی بعدِ تخفیفِ حتمیِ سبدخرید -- سبز، برای اینکه از تخفیفِ عادی
// (قرمز) به‌وضوح جدا باشه
const C_GREEN = "#15803d";
const C_WHITE = "#ffffff";
const C_GRAY_TINT = "#e5e2dd";
const C_GRAY_TINT_TEXT = "#3f3f46";
const C_PRICE_TINT = "#ece4d6";

// حروف/اعداد فارسی برای نمایش روی پوستر
const faNum = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("fa-IR");

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// هر خطِ ورودی که توی عرضِ مجاز جا نشه، سرِ فاصله‌ها می‌شکند و چندخطی می‌شود --
// به‌جای این‌که از باکس بزند بیرون/کات شود. کلمه‌ی تنهایی که حتی خودش هم جا
// نشه، مجبوریم همون‌طور بگذاریم (بدون خط‌شکنی داخلِ خودِ کلمه)
function wrapLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
): string[] {
  const wrapped: string[] = [];
  for (const line of lines) {
    const words = line.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (!current || ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
  }
  return wrapped;
}

// عرضِ واقعاً لازم برای یه باکس (بعد از خط‌شکنیِ احتمالی در سقفِ COL_W) -- برای
// این‌که همه‌ی باکس‌ها یه عرضِ مشترک (بر اساسِ پهن‌ترین متنِ واقعی) بگیرن، نه
// این‌که هرکدوم کاملِ عرضِ ستون رو اشغال کنه حتی وقتی متنش کوتاهه
function measureBoxWidth(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  fontSize: number,
  fontStyle = "bold",
): number {
  ctx.save();
  ctx.font = `${fontStyle} ${fontSize}px Vazirmatn, Tahoma, sans-serif`;
  const wrapped = wrapLines(ctx, lines, COL_W - 28);
  const widest = wrapped.reduce(
    (max, l) => Math.max(max, ctx.measureText(l).width),
    0,
  );
  ctx.restore();
  return widest + 28;
}

// باکسِ گروه‌بندی‌شده با یک یا چند خطِ متنِ وسط‌چین (RTL) -- ارتفاعِ باکس را
// خودش از تعدادِ خط‌ها (بعد از احتمالِ خط‌شکنیِ خطوطِ بلند) حساب می‌کند و
// برمی‌گرداند تا فراخوان بتواند y را جلو ببرد
function drawMultilineBox(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    bg: string;
    fg: string;
    lines: string[];
    fontSize: number;
    fontStyle?: string;
    padY?: number;
    lineGap?: number;
    radius?: number;
  },
): number {
  const {
    x,
    y,
    w,
    bg,
    fg,
    lines,
    fontSize,
    fontStyle = "bold",
    padY = 11,
    lineGap = 5,
    radius = 16,
  } = opts;
  const font = `${fontStyle} ${fontSize}px Vazirmatn, Tahoma, sans-serif`;

  ctx.save();
  ctx.font = font; // برای اندازه‌گیریِ عرضِ هر خط قبل از تصمیمِ خط‌شکنی، باید همین‌جا ست شود
  const maxTextWidth = w - 28;
  const wrappedLines = wrapLines(ctx, lines, maxTextWidth);
  ctx.restore();

  const lineH = fontSize + lineGap;
  const h = wrappedLines.length * lineH + padY * 2 - lineGap;

  ctx.save();
  ctx.globalAlpha = BOX_BG_ALPHA;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = fg;
  let ty = y + padY + fontSize / 2;
  for (const line of wrappedLines) {
    ctx.fillText(line, x + w / 2, ty);
    ty += lineH;
  }
  ctx.restore();
  return h;
}

// کشیدن پوستر اصلی: عکسِ کاملِ محصول (بدون کراپ، بر اساسِ ارتفاعِ کامل -- حتی
// اگه از عرضِ نیمه‌ی چپ بزنه بیرون و کمی زیرِ ستونِ اطلاعات برود، مهم نیست)
// سمتِ چپ، ستونِ اطلاعات سمتِ راست (چون فارسی می‌نویسیم)
function drawPoster(
  ctx: CanvasRenderingContext2D,
  opts: {
    image: HTMLImageElement;
    brand: string | null;
    categoryName: string | null;
    colorCount: number;
    sizes: string[];
    // از قبل انتخاب/فیلترشده -- طبقِ چک‌باکس‌های ادمین (نه خودِ درج‌شده رو
    // اینجا با pickKeyAttributes حساب می‌کنیم، چون UI هم باید همون لیستِ
    // نهایی رو برای چک‌باکس‌ها ببینه، نه یه محاسبه‌ی جداگانه‌ی پنهان)
    keyAttrs: { name: string; value: string }[];
    priceTL: number | null;
    originalPriceTL: number | null;
    // تخفیفِ حتمیِ سبدخریدِ ترندیول (اگه بود) -- روی قیمتِ priceTL اعمال
    // می‌شه، جدا از تخفیفِ عادیِ originalPriceTL/priceTL؛ فقط وقتی
    // priceIncludesBasketDiscount خودش false باشه (وگرنه یعنی priceTL از
    // قبل همین تخفیف رو خورده و دوباره اعمال‌کردنش یعنی دوبار حساب‌کردنِ
    // یه تخفیفِ واحد)
    basketDiscountPct: number | null;
    priceIncludesBasketDiscount: boolean;
    // تخفیفِ ناچیز‌تر از این عدد (مثلاً ۱٪) روی دایره‌ی درصد نشون داده نمی‌شه
    minDiscountPercentToShow: number;
    tag: string;
    bulkPromoLines: string[];
    currencyLines: string[];
    // هندل/تگ/«ارسال از ترکیه» رو کدوم سمتِ پوستر بکشه -- پیش‌فرض راست
    footerOnLeft: boolean;
    // برعکسِ کلِ چیدمان: ستونِ اطلاعات سمتِ چپ و دایره‌ی تخفیف/برند سمتِ راست
    // (پیش‌فرض false یعنی حالتِ فعلی: ستون راست، دایره چپ). این دو همیشه
    // مخالفِ همن -- چون هردو با هم روی یه محورِ عمودی جابه‌جا می‌شن، یه
    // چک‌باکسِ واحد کافیه (نه دوتای مستقل که امکانِ حالتِ نامعتبر بدن)
    layoutMirrored: boolean;
  },
) {
  const {
    image,
    brand,
    categoryName,
    colorCount,
    sizes,
    keyAttrs,
    priceTL: price,
    originalPriceTL,
    basketDiscountPct,
    priceIncludesBasketDiscount,
    minDiscountPercentToShow,
    tag,
    bulkPromoLines,
    currencyLines,
    footerOnLeft,
    layoutMirrored,
  } = opts;

  // موقعیتِ ستونِ اطلاعات -- فقط X (نه عرض، که همیشه COL_W ثابته) به سمت
  // وابسته‌ست؛ حالتِ آینه‌ای، اینسِتِ نزدیک‌به‌عکس/نزدیک‌به‌لبه رو هم برعکس می‌کنه
  const infoX = layoutMirrored ? 0 : PHOTO_W;
  const colX = layoutMirrored
    ? infoX + COL_RIGHT_INSET
    : infoX + COL_LEFT_INSET;

  // ===== عکسِ کاملِ محصول -- مبنا ارتفاعِ کامل (POSTER_H)، نه عرض؛ اگه عرضش
  // بیشتر از نیمه‌ی چپ شد، همون‌طور کشیده می‌شه (روی ستونِ اطلاعات هم بره اشکالی نداره) =====
  ctx.fillStyle = C_WHITE;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const scale = POSTER_H / image.height;
  const dw = image.width * scale;
  ctx.drawImage(image, 0, 0, dw, POSTER_H);

  // تخفیفِ عادی (قیمتِ فروشنده/کمپینِ ترندیول که از قبل توی priceTL/originalPriceTL
  // اومده) و تخفیفِ حتمیِ سبدخرید (که مستقیم روی priceTL اعمال می‌شه) --
  // فقط وقتی priceIncludesBasketDiscount نباشه با هم ترکیب می‌شن. وگرنه
  // (وقتی priceIncludesBasketDiscount درسته) یعنی priceTL از قبل همین
  // تخفیفِ سبدخرید رو خورده (ببین computePriceInfo توی trendyolProductDetail.ts)
  // و basketDiscountPct (که از campaignBadges میاد) داره همون تخفیفِ واحد رو
  // دوباره توصیف می‌کنه -- اعمالِ دوباره‌ش یعنی یه تخفیف دوبار حساب بشه (باگی
  // که واقعاً باعث شد پوستر ٪۹۱ نشون بده وقتی تخفیفِ واقعی فقط ٪۷۰ بود)
  const hasNormalDiscount =
    price != null && originalPriceTL != null && price < originalPriceTL;
  const hasBasketDiscount =
    basketDiscountPct != null && price != null && !priceIncludesBasketDiscount;
  const finalPrice = hasBasketDiscount
    ? price! * (1 - basketDiscountPct! / 100)
    : price;
  // مرجعِ محاسبه‌ی درصدِ دایره: اگه تخفیفِ عادی هم بود originalPriceTL، وگرنه
  // خودِ priceTL (یعنی قیمتِ قبل از تخفیفِ سبد)
  const circleReferencePrice = hasNormalDiscount ? originalPriceTL : price;
  const discountPct = getDiscountPercent(finalPrice, circleReferencePrice);
  const hasDiscount = discountPct != null && discountPct >= minDiscountPercentToShow;

  // دایره‌ی تخفیف و اسمِ برند هر دو روی همین محورِ افقی سنتر می‌شن -- کمی
  // فاصله‌گرفته از نزدیک‌ترین لبه‌ی عکس تا اسمِ برندِ بلند هم جا داشته باشد.
  // پیش‌فرض نزدیکِ لبه‌ی چپ (سمتِ مخالفِ ستونِ اطلاعات)؛ وقتی چیدمان آینه‌ای‌ست
  // (ستونِ اطلاعات چپ)، این‌ها می‌رن نزدیکِ لبه‌ی راست
  const badgeCenterX = layoutMirrored ? POSTER_W - 150 : 150;

  // دایره‌ی تخفیف -- کاملاً ترانسپارنت (بدون پُررنگی)، فقط خطِ دورش قرمز با
  // هالوی سفید (چون روی عکس می‌نشیند)، «%» سمتِ چپِ عدد و خودِ عدد سمتِ
  // راستش (نه یک رشته‌ی به‌هم‌چسبیده)، هم‌اندازه، فارسی و درشت
  if (hasDiscount) {
    const cx = badgeCenterX;
    const cy = 130;
    const r = 90;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 13;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = C_RED;
    ctx.stroke();

    // عمداً اعداد انگلیسی (نه فارسی) -- هم خوانا‌تره روی این بجِ کوچیک، هم
    // متریکِ ارتفاعش قابل‌پیش‌بینی‌تره برای سنتر کردنِ عمودیِ دقیق
    const numText = String(discountPct);
    const gapPx = 8;
    // فونت رو تا جایی که هم از نظرِ عرض هم از نظرِ ارتفاع توی دایره جا بشه
    // بزرگ می‌کنیم (نه یه سایزِ ثابت) -- سقفِ ارتفاع طوری انتخاب شده که با
    // فاصله‌ی خط (line-height) معمولِ فونت‌های بولد، به حاشیه‌ی دایره نچسبه
    const maxTextWidth = 2 * r - 20;
    const maxGlyphSize = Math.min(120, r * 0.95);
    let glyphSize = 40;
    ctx.font = `bold ${glyphSize}px Vazirmatn, Tahoma, sans-serif`;
    while (glyphSize < maxGlyphSize) {
      ctx.font = `bold ${glyphSize + 2}px Vazirmatn, Tahoma, sans-serif`;
      const w =
        ctx.measureText(numText).width + ctx.measureText("٪").width + gapPx;
      if (w > maxTextWidth) break;
      glyphSize += 2;
    }
    ctx.font = `bold ${glyphSize}px Vazirmatn, Tahoma, sans-serif`;
    const numW = ctx.measureText(numText).width;
    const pctW = ctx.measureText("٪").width;
    const totalW = numW + pctW + gapPx;
    // baseline «middle» رو بر اساسِ متریکِ انتزاعیِ فونت سنتر می‌کنه، نه کادرِ
    // واقعیِ خودِ گلیف‌ها -- برای اعداد معمولاً چندپیکسل بالاتر/پایین‌تر از
    // مرکزِ واقعیِ دایره درمیاد. به‌جاش با actualBoundingBoxAscent/Descent
    // (کادرِ واقعیِ رسم‌شده) مرکزِ عمودیِ دقیق رو خودمون حساب می‌کنیم
    ctx.textBaseline = "alphabetic";
    const vMetrics = ctx.measureText(numText);
    const textCenterY =
      cy + (vMetrics.actualBoundingBoxAscent - vMetrics.actualBoundingBoxDescent) / 2;
    ctx.textAlign = "left";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText("٪", cx - totalW / 2, textCenterY);
    ctx.strokeText(numText, cx - totalW / 2 + pctW + gapPx, textCenterY);
    ctx.fillStyle = C_RED;
    ctx.fillText("٪", cx - totalW / 2, textCenterY);
    ctx.fillText(numText, cx - totalW / 2 + pctW + gapPx, textCenterY);
    ctx.restore();
  }

  // اسمِ برند -- سمتِ چپِ عکس (نه ستونِ اطلاعات)، سنتر جاستیفای‌شده با دایره‌ی
  // تخفیف، با حروفِ مشکیِ درشت و هالوی سفید دورش تا روی هر رنگ عکسی خوانا بماند.
  // فونت خودکار کوچیک می‌شود تا برندهای بلند از لبه‌ی عکس بیرون نزنند (نه
  // این‌که نصفه‌ش کات شود، مثل قبل)
  if (brand) {
    const by = hasDiscount ? 270 : 70;
    ctx.save();
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#000000";
    const brandText = toEnglishBrandName(brand).toUpperCase();
    // فاصله تا نزدیک‌ترین لبه‌ی کانواس (نه همیشه لبه‌ی چپ) -- تا برندِ بلند از
    // اون لبه (چپ در حالتِ عادی، راست در حالتِ آینه‌ای) بیرون نزنه
    const nearEdgeDist = layoutMirrored ? POSTER_W - badgeCenterX : badgeCenterX;
    const maxBrandWidth = Math.min(nearEdgeDist * 2 - 24, PHOTO_W - 40);
    // اگه برند چندکلمه‌ای بود و توی یه خط جا نمی‌شد، به‌جایِ ریزکردنِ بی‌حدِ فونت
    // (که خیلی بلندها رو غیرِقابل‌خوندن می‌کرد)، اول سرِ فاصله‌ها می‌شکنیمش به
    // چندخط -- فونت فقط وقتی کوچیک می‌شه که حتی یه *کلمه‌ی تکی* هم توی همون
    // خطِ خودش جا نشه (wrapLines خودش خط‌شکنیِ داخلِ یه کلمه رو انجام نمی‌ده)
    let brandFontSize = 40;
    ctx.font = `bold ${brandFontSize}px Tahoma, sans-serif`;
    let brandLines = wrapLines(ctx, [brandText], maxBrandWidth);
    while (
      brandFontSize > 20 &&
      brandLines.some((l) => ctx.measureText(l).width > maxBrandWidth)
    ) {
      brandFontSize -= 2;
      ctx.font = `bold ${brandFontSize}px Tahoma, sans-serif`;
      brandLines = wrapLines(ctx, [brandText], maxBrandWidth);
    }
    const brandLineH = brandFontSize + 4;
    // خطِ اول عیناً همون جایی می‌مونه که برندِ تک‌خطی می‌نشست (درست زیرِ دایره‌ی
    // تخفیف، مماس) و خطوطِ بعدی می‌رن *پایین* -- قبلاً کلِ بلوک دورِ by سنتر
    // می‌شد و با ۲ خط، خطِ اول می‌رفت بالا و روی لبه‌ی دایره می‌نشست
    const brandStartY = by;
    brandLines.forEach((line, idx) => {
      const ly = brandStartY + idx * brandLineH;
      ctx.strokeText(line, badgeCenterX, ly);
      ctx.fillText(line, badgeCenterX, ly);
    });
    ctx.restore();
  }

  // ===== ستونِ اطلاعات (نیمه‌ی راست) =====
  let y = 40;
  const gap = 8;

  const promoLines = bulkPromoLines.filter(Boolean);
  const colorSizeLines: string[] = [];
  if (colorCount > 1) colorSizeLines.push("رنگبندی");
  // قبلاً همه‌ی سایزها (تا سقفِ ۸تا) با هم توی یه خطِ واحد join می‌شدن -- چون
  // measureBoxWidth عرضِ لازم رو از رویِ همون یه خط حساب می‌کنه، وقتی سایزها
  // زیاد بودن (مثلاً ۶-۸ تا)، commonBoxW (عرضِ مشترکِ همه‌ی باکس‌ها) کشیده
  // می‌شد تا نزدیکِ کلِ عرضِ ستون -- یعنی سایزها بازم روی یه خط جا می‌شدن، فقط
  // فشرده/کشیده. الان هر ردیف حداکثر ۴ سایز داره؛ ردیفِ بعدی (اگه لازم باشه)
  // خودش یه خطِ جداست
  const SIZES_PER_ROW = 4;
  if (sizes.length > 0) {
    const limitedSizes = sizes.slice(0, 8);
    for (let i = 0; i < limitedSizes.length; i += SIZES_PER_ROW) {
      // ltrIsolate لازمه چون drawMultilineBox با ctx.direction="rtl" می‌کشه --
      // بدونش، چندتا سایزِ جدا (مخصوصاً سایزهای عددی مثلِ «36 38 40 42») به‌عنوانِ
      // چندتا رانِ جداگانه، طبقِ جهتِ پاراگراف (راست‌به‌چپ) بازچینش می‌شدن و
      // برعکس (از راست به چپِ صعودی) نشون داده می‌شدن، نه چپ‌به‌راست
      colorSizeLines.push(ltrIsolate(limitedSizes.slice(i, i + SIZES_PER_ROW).join("  ")));
    }
  }
  const priceLines: string[] = [];
  if (price != null) {
    if (hasNormalDiscount)
      priceLines.push(`${faNum(Math.round(originalPriceTL!))}TL`);
    if (hasBasketDiscount) priceLines.push(`${faNum(Math.round(price))}TL`);
    priceLines.push(`${faNum(Math.round(finalPrice!))}TL`);
  }

  // همه‌ی باکس‌ها یه عرضِ مشترک می‌گیرن -- بر اساسِ پهن‌ترینِ متنِ واقعی
  // (بعد از خط‌شکنی)، نه کاملِ عرضِ ستون؛ این‌طوری باکس‌ها جمع‌وجورن و بخشِ
  // بیشتری از عکسِ زیرشون (وقتی عکس سرریز می‌کند) پیدا می‌مونه
  const commonBoxW = Math.min(
    COL_W,
    Math.max(
      measureBoxWidth(ctx, currencyLines, 30),
      promoLines.length > 0 ? measureBoxWidth(ctx, promoLines, 27) : 0,
      categoryName ? measureBoxWidth(ctx, [categoryName], 29) : 0,
      colorSizeLines.length > 0 ? measureBoxWidth(ctx, colorSizeLines, 29) : 0,
      keyAttrs.length > 0
        ? measureBoxWidth(
            ctx,
            keyAttrs.map((a) => a.value),
            24,
          )
        : 0,
      priceLines.length > 0 ? measureBoxWidth(ctx, priceLines, 46) : 0,
    ),
  );
  // هم‌راستا با لبه‌ی بیرونیِ ستون (دورتر از عکس) -- فضای آزادشده سمتِ عکس
  // می‌مونه؛ حالتِ عادی لبه‌ی بیرونی راسته، حالتِ آینه‌ای چپ
  const boxX = layoutMirrored ? colX : colX + (COL_W - commonBoxW);

  // نرخ ارز + هزینه‌ی ارسال -- متنش قابل‌تغییر توسط ادمین (تنظیمات سایت)
  y +=
    drawMultilineBox(ctx, {
      x: boxX,
      y,
      w: commonBoxW,
      bg: C_PURPLE,
      fg: "#ffffff",
      lines: currencyLines,
      fontSize: 30,
    }) + gap;

  // تخفیفِ خریدِ چندعددی -- یک باکسِ گروه‌بندی‌شده (نه ردیف‌های جدا)، اختیاری
  // (دستیِ ادمین -- کمپین‌های واقعیِ ترندیول توی HTMLِ ثابتِ صفحه نیستن، سمتِ
  // کلاینت لود می‌شن، پس نمی‌شه خودکار پیدا/ترجمه‌شون کرد)
  if (promoLines.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: boxX,
        y,
        w: commonBoxW,
        bg: C_ORANGE,
        fg: "#ffffff",
        lines: promoLines,
        fontSize: 27,
      }) + gap;
  }

  // دسته‌بندی محصول
  if (categoryName) {
    y +=
      drawMultilineBox(ctx, {
        x: boxX,
        y,
        w: commonBoxW,
        bg: C_GRAY_TINT,
        fg: C_GRAY_TINT_TEXT,
        lines: [categoryName],
        fontSize: 29,
      }) + gap;
  }

  // رنگ + سایزها -- یک باکسِ گروه‌بندی‌شده (نه دو باکسِ جدا)
  if (colorSizeLines.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: boxX,
        y,
        w: commonBoxW,
        bg: C_GRAY_TINT,
        fg: C_GRAY_TINT_TEXT,
        lines: colorSizeLines,
        fontSize: 29,
      }) + gap;
  }

  // چندتا از مشخصاتِ مهم برای تصمیمِ مشتری (جنس، یقه، آستین و...) -- از قبل
  // ترجمه شده‌اند، فقط اولویت‌بندی/انتخاب می‌شوند (pickKeyAttributes). «رنگ»
  // عمداً حذف می‌شود چون باکسِ «چندرنگ» بالاتر همین اطلاعات رو داده (تکراری
  // نشه)؛ لیبل هم نشون داده نمی‌شه (فقط مقدار) چون روی عکس خلاصه‌نویسی می‌کنیم
  if (keyAttrs.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: boxX,
        y,
        w: commonBoxW,
        bg: C_GRAY_TINT,
        fg: C_GRAY_TINT_TEXT,
        lines: keyAttrs.map((a) => a.value),
        fontSize: 24,
      }) + gap;
  }

  // قیمت -- یک باکس، با تا سه خط بسته به ترکیبِ تخفیفِ عادی/سبدخرید:
  //   بدونِ تخفیف:            [قیمت -- خاکی]
  //   فقط تخفیفِ عادی:        [قیمتِ اصلی خط‌خورده] [قیمتِ نهایی -- قرمز]
  //   فقط تخفیفِ سبدخرید:     [قیمتِ فعلی خط‌خورده] [قیمتِ نهایی -- سبز]
  //   هردو:                   [قیمتِ اصلی خط‌خورده] [قیمتِ فعلی هم خط‌خورده] [قیمتِ نهایی -- سبز]
  if (price != null) {
    type PriceLine = {
      text: string;
      fontSize: number;
      color: string;
      bold: boolean;
      struck: boolean;
    };
    const lines: PriceLine[] = [];
    if (hasNormalDiscount) {
      lines.push({
        text: `${faNum(Math.round(originalPriceTL!))}TL`,
        fontSize: 26,
        color: C_KHAKI_TEXT,
        bold: false,
        struck: true,
      });
    }
    if (hasBasketDiscount) {
      lines.push({
        text: `${faNum(Math.round(price))}TL`,
        fontSize: hasNormalDiscount ? 26 : 30,
        color: C_KHAKI_TEXT,
        bold: false,
        struck: true,
      });
      lines.push({
        text: `${faNum(Math.round(finalPrice!))}TL`,
        fontSize: 46,
        color: C_GREEN,
        bold: true,
        struck: false,
      });
    } else if (hasNormalDiscount) {
      lines.push({
        text: `${faNum(Math.round(price))}TL`,
        fontSize: 46,
        color: C_RED,
        bold: true,
        struck: false,
      });
    } else {
      lines.push({
        text: `${faNum(Math.round(price))}TL`,
        fontSize: 46,
        color: C_KHAKI_TEXT,
        bold: true,
        struck: false,
      });
    }

    const padY = 16;
    const lineGap = 6;
    const boxH =
      lines.reduce((sum, l) => sum + l.fontSize + lineGap, 0) +
      padY * 2 -
      lineGap;

    ctx.save();
    ctx.globalAlpha = BOX_BG_ALPHA;
    ctx.fillStyle = C_PRICE_TINT;
    roundRect(ctx, boxX, y, commonBoxW, boxH, 16);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let ly = y + padY;
    for (const line of lines) {
      ctx.font = `${line.bold ? "bold " : ""}${line.fontSize}px Vazirmatn, Tahoma, sans-serif`;
      ctx.fillStyle = line.color;
      const cy = ly + line.fontSize / 2;
      ctx.fillText(line.text, boxX + commonBoxW / 2, cy);
      if (line.struck) {
        const w = ctx.measureText(line.text).width;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(boxX + commonBoxW / 2 - w / 2, cy);
        ctx.lineTo(boxX + commonBoxW / 2 + w / 2, cy);
        ctx.stroke();
      }
      ly += line.fontSize + lineGap;
    }
    ctx.restore();
    y += boxH + gap;
  }

  // هندل/تگ/ارسال -- دیگه بخشی از ستونِ اطلاعات نیستن (وابسته به این‌که چندتا
  // باکسِ بالاتر نشون داده شده)، بلکه یه نوارِ ثابت پایینِ کاملِ پوستره -- روی
  // خودِ عکس (که تمامِ ارتفاعِ کانواس رو پوشونده). پیش‌فرض سمتِ راست (هم‌راستا با
  // لبه‌ی راستِ باکس‌های ستونِ اطلاعات، نه وسط‌چین) چون فارسی از راست خونده
  // می‌شه؛ اگه footerOnLeft باشه (وقتی سمتِ راستِ عکس شلوغ/تیره‌ست و نوشته‌ها
  // خوانا نمی‌مونن)، با همون فاصله‌ی لبه‌ای، آینه‌وار می‌ره سمتِ چپ.
  // بدون باکس؛ چون روی عکس می‌افته، هالوی سفید دورِ نوشته‌ها می‌کشیم تا خوانا بماند
  const footerX = footerOnLeft ? COL_RIGHT_INSET : POSTER_W - COL_RIGHT_INSET;
  const footerTextAlign: CanvasTextAlign = footerOnLeft ? "left" : "right";
  let footerY = POSTER_H - 148;
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = footerTextAlign;
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#111827";
  ctx.font = "bold 32px Tahoma, sans-serif";
  ctx.strokeText("@Shopping.Stage", footerX, footerY);
  ctx.fillText("@Shopping.Stage", footerX, footerY);
  footerY += 46;
  ctx.strokeText(`#${tag}`, footerX, footerY);
  ctx.fillText(`#${tag}`, footerX, footerY);
  footerY += 46;
  ctx.direction = "rtl";
  ctx.fillStyle = C_RED;
  ctx.font = "bold 32px Vazirmatn, Tahoma, sans-serif";
  ctx.strokeText("ارسال از ترکیه", footerX, footerY);
  ctx.fillText("ارسال از ترکیه", footerX, footerY);
  ctx.restore();
}

// کشیدن عکس‌های غیرِ اصلی -- فقط تصویر تمام‌قاب + یک تگ کوچک روی گوشه‌ی
// پایین-چپ (کافیه که مشتری بداند کدام پست/محصول است، بدون تکرار کل مشخصات)
function drawTagOnlyPoster(
  ctx: CanvasRenderingContext2D,
  opts: { image: HTMLImageElement; tag: string },
) {
  const { image, tag } = opts;

  ctx.fillStyle = C_WHITE;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const scale = Math.min(POSTER_W / image.width, POSTER_H / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, (POSTER_W - dw) / 2, (POSTER_H - dh) / 2, dw, dh);

  // بدون باکسِ پُررنگ -- فقط خودِ تگ با هالوی سفید دورش تا روی هر عکسی خوانا بماند
  const tagText = `#${tag}`;
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 40px Vazirmatn, Tahoma, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#000000";
  const tagX = 32;
  const tagY = POSTER_H - 48;
  ctx.strokeText(tagText, tagX, tagY);
  ctx.fillText(tagText, tagX, tagY);
  ctx.restore();
}

// یه گریدِ خودکار پیدا می‌کنه که n خونه (با نسبتِ ابعادِ aspect = عرض/ارتفاعِ
// عکس) رو توی فضای areaW×areaH جا بده و بزرگ‌ترین اندازه‌ی ممکن (contain-fit،
// بدونِ کراپ) رو بده -- تعدادِ کم شد بزرگ می‌شن، زیاد شد خودکار کوچیک/فشرده می‌شن
function computeGrid(
  n: number,
  areaW: number,
  areaH: number,
  gap: number,
  aspect: number,
) {
  let best = { cols: 1, rows: n, cellW: 0, cellH: 0, drawH: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (areaW - gap * (cols - 1)) / cols;
    const cellH = (areaH - gap * (rows - 1)) / rows;
    const drawH = Math.min(cellH, cellW / aspect);
    if (drawH > best.drawH) best = { cols, rows, cellW, cellH, drawH };
  }
  return best;
}

// عکسِ اضافه‌ی «رنگ‌های دیگر موجود» -- کنارِ عکسِ اصلی و بقیه‌ی عکس‌های محصول
// دانلود می‌شه (فقط وقتی محصول واقعاً رنگِ دیگه‌ای هم داشته باشه). بدونِ
// تیتر/برند بالا -- کلِ فضای پوستر برای عکس‌ها استفاده می‌شه؛ هر عکس با
// سایز/نسبتِ ابعادِ اصلیِ خودش (contain-fit، نه کراپِ مربعی) جا می‌شه
function drawColorVariantsPoster(
  ctx: CanvasRenderingContext2D,
  opts: { images: HTMLImageElement[]; tag: string },
) {
  const { images, tag } = opts;

  ctx.fillStyle = C_WHITE;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  const FOOTER_H = 90;
  const MARGIN = 20;
  const GAP = 14;
  const gridTop = MARGIN;
  const gridBottom = POSTER_H - FOOTER_H;
  const gridWidth = POSTER_W - MARGIN * 2;
  const gridHeight = gridBottom - gridTop;

  // نسبتِ ابعادِ عکسِ اولی به‌عنوانِ نماینده برای انتخابِ بهترین شکلِ گرید --
  // عکس‌های رنگ‌های مختلفِ همون محصول معمولاً همون نسبت رو دارن
  const representativeAspect = images[0].width / images[0].height;
  const { cols, rows, cellW, cellH } = computeGrid(
    images.length,
    gridWidth,
    gridHeight,
    GAP,
    representativeAspect,
  );
  const usedW = cellW * cols + GAP * (cols - 1);
  const usedH = cellH * rows + GAP * (rows - 1);
  const startX = MARGIN + (gridWidth - usedW) / 2;
  const startY = gridTop + (gridHeight - usedH) / 2;

  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cellW + GAP);
    const cy = startY + row * (cellH + GAP);
    // contain-fit با نسبتِ ابعادِ خودِ همین عکس -- نه فرض‌کردنِ خونه‌ی مربعی
    const scale = Math.min(cellW / img.width, cellH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx + (cellW - dw) / 2, cy + (cellH - dh) / 2, dw, dh);
  });

  const tagText = `#${tag}`;
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 40px Vazirmatn, Tahoma, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#000000";
  ctx.strokeText(tagText, 32, POSTER_H - 48);
  ctx.fillText(tagText, 32, POSTER_H - 48);
  ctx.restore();
}

// عکسِ جداگانه‌ی هرکدوم از رنگ‌های دیگه (نه گریدِ ترکیبیِ بالا) -- طبقِ
// درخواستِ صریح: عکسِ عادیِ همون رنگ + تگ، به‌همراهِ اسمِ رنگ بالای تگ. اسمِ
// رنگ چه ترجمه‌ی فارسی داشته باشه چه نه (fetchTrendyolProductDetail با
// fallback به خودِ کلمه‌ی خام برمی‌گردونه)، همیشه نوشته می‌شه -- با هالوی سفید
// دورش تا روی هر عکسی خوانا بماند
function drawColorPhotoPoster(
  ctx: CanvasRenderingContext2D,
  opts: { image: HTMLImageElement; tag: string; colorName: string },
) {
  const { image, tag, colorName } = opts;

  ctx.fillStyle = C_WHITE;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const scale = Math.min(POSTER_W / image.width, POSTER_H / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, (POSTER_W - dw) / 2, (POSTER_H - dh) / 2, dw, dh);

  const tagX = 32;
  const tagY = POSTER_H - 48;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#000000";

  ctx.direction = "ltr";
  ctx.font = "bold 40px Vazirmatn, Tahoma, sans-serif";
  const tagText = `#${tag}`;
  ctx.strokeText(tagText, tagX, tagY);
  ctx.fillText(tagText, tagX, tagY);

  if (colorName) {
    ctx.direction = "rtl";
    ctx.font = "bold 46px Vazirmatn, Tahoma, sans-serif";
    const nameY = tagY - 56;
    ctx.strokeText(colorName, tagX, nameY);
    ctx.fillText(colorName, tagX, nameY);
  }
  ctx.restore();
}

// بارگذاری تصویر به‌شکل Promise (به‌جای onload دستی) -- برای ساختن چندتا
// عکس پشت‌سرهم توی یه حلقه‌ی async
function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = newImage();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`بارگذاری عکس ناموفق بود: ${src}`));
    img.src = src;
  });
}

// رندر روی یه کانواس آفلاین (نه کانواس نمایشیِ صفحه) و خروجی PNG -- برای
// عکس‌هایی که فقط باید دانلود شوند، بدون تغییر پیش‌نمایش زنده‌ی کاربر
function renderOffscreenToDataUrl(
  draw: (ctx: CanvasRenderingContext2D) => void,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("کانواس پشتیبانی نمی‌شود");
  draw(ctx);
  return canvas.toDataURL("image/png");
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// فقط باز کردنِ خودِ اپ (نه صفحه‌ی خاصی توش). عمداً بدونِ fallback به سایتِ
// اینستاگرام -- اون سایت (بدونِ VPN) بلاکه و صفحه‌ی خطا نشون می‌داد
function instagramAppUrl(): string {
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
    return "intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end";
  }
  return "instagram://app";
}

// عکس‌های ساخته‌شده رو به فایل تبدیل می‌کنه تا با Web Share (منوی اشتراکِ گوشی)
// مستقیم به «پستِ» اینستاگرام فرستاده بشن -- بدونِ نیاز به گشتن توی گالری
// بدونِ fetch(dataUrl): CSPِ سایت (connect-src) اجازه‌ی data: نمی‌ده و fetch بلاک می‌شد
function dataUrlsToFiles(items: { name: string; dataUrl: string }[]): File[] {
  return items.map((it) => {
    const bin = atob(it.dataUrl.slice(it.dataUrl.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], it.name, { type: "image/png" });
  });
}

async function shareFiles(files: File[]): Promise<boolean> {
  if (files.length === 0 || typeof navigator === "undefined" || !navigator.share) return false;
  if (navigator.canShare && !navigator.canShare({ files })) return false;
  try {
    await navigator.share({ files });
    return true;
  } catch {
    return false;
  }
}

// برندهای چندکلمه‌ای (مثلاً «U.S. Polo Assn.») باید یکجا -- نه کلمه‌به‌کلمه --
// برای ترجمه پیشنهاد بشن، چون تک‌تکِ کلمه‌هاشون به‌تنهایی معنی نداره (طبقِ
// درخواستِ صریح). دقیقاً همون نرمال‌سازیِ سمتِ سرور (حذفِ علامت‌ها قبل از
// foldTurkish -- ببین turkishLowercase/normalizedWords توی
// trendyolTitleTranslation.ts) این‌جا هم اعمال می‌شه، وگرنه نقطه‌ی داخلِ اسمِ
// برند باعث می‌شد ترجمه‌ی ثبت‌شده هیچ‌وقت با متنِ واقعیِ محصول تطبیق پیدا نکنه
function brandCoreWords(brand: string): string[] {
  return brand
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:()"']/g, ""))
    .filter(Boolean);
}

// ادمین معمولاً بعضی مشخصات (مثلاً «مبدا») رو هیچ‌وقت تیک نمی‌زنه -- طبقِ
// درخواستِ صریح، به‌جای این‌که هر بار برای محصولِ بعدی دوباره دستی خاموششون
// کنه، اینجا (فقط سمتِ مرورگرِ خودِ همین ادمین -- localStorage، نه یه
// تنظیمِ سراسری/DB که روی همه‌ی محصولات/همه‌ی ادمین‌ها اثر بذاره) به خاطر
// می‌سپاریم و دفعه‌ی بعد خودکار از تیک می‌افتن
const DEFAULT_EXCLUDED_ATTR_STORAGE_KEY = "posterGenerator:defaultExcludedAttrNames";

function getDefaultExcludedAttrNames(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DEFAULT_EXCLUDED_ATTR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDefaultExcludedAttrNames(names: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEFAULT_EXCLUDED_ATTR_STORAGE_KEY, JSON.stringify(Array.from(names)));
  } catch {
    // بی‌اهمیت -- فقط یه راحتیِ محلیه، نه چیزِ حیاتی
  }
}

export default function PosterGeneratorPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  // کلماتی که توی جستجو ترجمه نشدن و کلاً از عبارت حذف شدن (مثلاً «شومیز» تا
  // قبل از اضافه‌شدنش به دیکشنری) -- تا ادمین بی‌خبر نمونه که نتیجه‌ها بر
  // اساسِ یه عبارتِ ناقص/متفاوت از چیزی که تایپ کرده برگشته
  const [searchDroppedWords, setSearchDroppedWords] = useState<string[]>([]);
  const [directInput, setDirectInput] = useState("");

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  const [tag, setTag] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [copied, setCopied] = useState("");

  // باکسِ نارنجیِ «تخفیف خرید چند عددی» -- با کمپین‌های واقعیِ ترندیول (اگه
  // پیدا شدن، از badges توی پاسخِ جستجو/لیستینگ می‌آیند و ترجمه شده‌اند) پر
  // می‌شه؛ ولی همیشه قابل‌ویرایش/خالی‌کردن دستی هم هست (خالی = نشون داده نمی‌شه)
  const [bulkPromoLine1, setBulkPromoLine1] = useState("");
  const [bulkPromoLine2, setBulkPromoLine2] = useState("");

  // متنِ باکسِ بنفشِ «نرخ ارز روزانه...» -- از تنظیماتِ سایت (قابل‌ویرایش توسط
  // ادمین از /admin/settings) خوانده می‌شه، نه هاردکد
  const [currencyLines, setCurrencyLines] = useState<string[]>([
    "نرخ ارز روزانه و",
    "هزینه ارسال هوایی",
  ]);
  // تخفیفِ خیلی ناچیز (مثلاً ۱٪) روی هیچ‌جای پوستر نشون داده نمی‌شه -- طبقِ
  // همون تنظیمِ سراسریِ minDiscountPercentToShow که روی لیستینگ/نگاهِ‌سریع هم اعمال می‌شه
  const [minDiscountPercentToShow, setMinDiscountPercentToShow] = useState(2);

  const [generatingAll, setGeneratingAll] = useState(false);
  const generatedFilesRef = useRef<File[]>([]);
  // href نباید موقعِ SSR از navigator حساب بشه (اندروید/iOS فرق دارن و React
  // اختلافِ attribute بینِ سرور و کلاینت رو تصحیح نمی‌کنه)
  const [instagramHref, setInstagramHref] = useState("instagram://app");
  useEffect(() => setInstagramHref(instagramAppUrl()), []);
  const [generateStatus, setGenerateStatus] = useState("");
  const [posterError, setPosterError] = useState("");

  // مشخصاتِ کلیدیِ روی پوستر -- با چک‌باکس کنارِ هرکدوم، ادمین می‌تونه هرکدوم
  // رو نخواد هم از خودِ عکس هم از هشتگ‌ها حذف کنه (نه فقط عکس)
  const [excludedAttrNames, setExcludedAttrNames] = useState<Set<string>>(
    new Set(),
  );
  // بعضی مقادیرِ ویژگی (مثلاً "ایستاده یقه"، از ترجمه‌ی کلمه‌به‌کلمه‌ی ترکیِ
  // "Dik Yaka" بدونِ معکوس‌سازیِ segment مثلِ خودِ عنوان) ترتیبِ صفت-قبل-از-اسمِ
  // ترکی رو حفظ می‌کنن -- باید دستی به «اسم-قبل-از-صفتِ» فارسی («یقه ایستاده»)
  // برعکس بشن؛ دقیقاً همون الگوی reverseCustomHashtag پایین‌تر، فقط اینجا روی
  // خودِ کلماتِ مقدار (نه دو تا هشتگِ جدا)
  const [reversedAttrNames, setReversedAttrNames] = useState<Set<string>>(
    new Set(),
  );
  // دسته‌بندی هم مثلِ مشخصات تیک‌خوره -- قبلاً همیشه بدونِ قید-و-شرط روی عکس
  // نوشته می‌شد، الان پیش‌فرض true (رفتارِ قبلی دست‌نخورده) ولی قابلِ خاموش‌کردن
  const [categoryIncluded, setCategoryIncluded] = useState(true);
  // هندل/تگ/«ارسال از ترکیه» -- پیش‌فرض سمتِ راستِ پوستر (طبقِ درخواستِ صریحِ
  // اولیه)؛ بعضی عکس‌ها ممکنه سمتِ راستشون شلوغ/تیره باشه و نوشته‌ها روش خونا
  // نباشن، پس با این چک‌باکس ادمین می‌تونه ببردش سمتِ چپ
  const [footerOnLeft, setFooterOnLeft] = useState(false);
  // چیدمانِ آینه‌ای: ستونِ اطلاعات (نوشته‌ها) و دایره‌ی تخفیف+برند همیشه
  // مخالفِ همدیگه‌ن -- پیش‌فرض ستونِ اطلاعات راست/دایره چپه؛ وقتی سمتِ راستِ
  // عکس شلوغ/تیره‌ست و نوشته‌ها روش خونا نمی‌مونن، با این چک‌باکس برعکس می‌شن
  const [layoutMirrored, setLayoutMirrored] = useState(false);
  // هشتگ‌های نهاییِ کپشن -- به‌جای انتخابِ کاملاً خودکار، ادمین با چک‌باکس از
  // بینِ کاندیدها انتخاب می‌کنه (حداکثر ۵تا، طبقِ سیاستِ استیج)
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(
    new Set(),
  );
  // هشتگ‌های دستی‌ای که ادمین با «ادغام» چندتا هشتگِ دیگه ساخته (مثلاً
  // «کیف»+«لوازم»+«آرایش» -> «کیف_لوازم_آرایش») -- توی hashtagCandidates
  // نیستن (چون از buildGeneratedHashtags نمیان)، پس جدا نگه‌داری می‌شن تا هم
  // به‌عنوان چک‌باکسِ اضافه نشون داده بشن هم امکانِ حذف داشته باشن
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  // پیغامِ ثبتِ ترجمه‌ی ترکیبی توی دیکشنری (بعدِ برعکس‌کردنِ یه هشتگِ ترکیبی)
  const [hashtagNote, setHashtagNote] = useState("");

  // جلوگیری از ثبتِ تکراریِ «پست شد» توی همون سشن -- مثلاً وقتی ادمین چندبار
  // پشتِ‌سرهم دکمه‌ی دانلود/اینستاگرام رو برای همون محصول می‌زنه
  const loggedPostedRef = useRef<Set<string>>(new Set());

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, string> | null) => {
        const text = data?.posterCurrencyText;
        if (text) setCurrencyLines(text.split("\n").filter(Boolean));
        const minPct = Number(data?.minDiscountPercentToShow);
        if (Number.isFinite(minPct)) setMinDiscountPercentToShow(minPct);
      })
      .catch(() => {});
  }, []);

  // هر بار پوسترِ محصول ساخته و دانلود شد، ثبت می‌کنیم که «احتمالاً پست شد» --
  // بی‌صدا (fire-and-forget)، چون این فقط یه کمکه، نباید جلوی خودِ دانلود رو بگیره
  function markAsPosted() {
    if (!detail) return;
    const key = `${detail.contentId}:${detail.url}`;
    if (loggedPostedRef.current.has(key)) return;
    loggedPostedRef.current.add(key);
    fetch("/api/admin/poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "logPosted",
        contentId: detail.contentId,
        url: detail.url,
        name: detail.nameFa || detail.name,
        image: selectedImage,
        price: detail.price,
        originalPrice: detail.originalPrice,
      }),
    }).catch(() => {});
  }

  // اگه این محصول قبلاً پوسترش ساخته شده، قبلِ ساختِ دوباره یه هشدارِ ساده --
  // نه بلاکِ کامل، چون ممکنه عمداً بخواد دوباره پست کنه
  function confirmIfAlreadyPosted(): boolean {
    if (!detail?.previousPosts?.length) return true;
    const last = new Date(detail.previousPosts[0].postedAt).toLocaleDateString("fa-IR");
    return window.confirm(
      `این محصول قبلاً (${last}) پوستر ساخته و دانلود شده -- به‌نظر می‌رسه توی اینستاگرام گذاشته شده. باز هم بسازم؟`,
    );
  }

  // دو راهِ ورود به این صفحه با لینکِ محصول از‌قبل‌آماده -- هردو باکسِ لینکِ
  // اصلی رو پر می‌کنن و خودکار جزئیات رو بارگذاری می‌کنن، تا مجبور نشیم دستی
  // لینک رو پیست کنیم:
  //   ۱) دکمه‌ی «📷 ساخت پست اینستاگرام» (کنارِ عنوانِ یه محصول، هرجای سایت) با ?input=...
  //   ۲) دکمه‌ی «اشتراک‌گذاری»ِ خودِ اندروید روی اپِ ترندیول -> انتخابِ مُداشاپ از
  //      لیست (Web Share Target -- public/manifest.json::share_target) با
  //      ?title=/?text=/?url=... که مرورگر خودش می‌فرسته، نه خودِ سایت
  // توی این حالت («focusedMode») کارِ ادمین فقط ساختنِ پوستر از همون لینکه --
  // بخشِ جستجو و باکسِ دستیِ لینک اصلاً لازم نیست، فقط شلوغیه (طبقِ درخواستِ صریح)
  // window.location.search (نه useSearchParams) عمداً استفاده شده که نیازی
  // به Suspense boundary نداشته باشیم -- این صفحه از اول تا آخر client‌ه
  const [focusedMode, setFocusedMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasAutoLoadParams = !!(
      params.get("url") ||
      params.get("text") ||
      params.get("title") ||
      params.get("input")
    );
    setFocusedMode(hasAutoLoadParams);

    const resolved = resolveShareTargetInput(params);
    if (resolved) {
      setDirectInput(resolved);
      loadDetail(resolved);
    } else if (hasAutoLoadParams) {
      // از اشتراک‌گذاری اومدیم ولی هیچ لینکِ ترندیول/میلاـیی توش پیدا نشد
      setDetailError(
        "لینکِ محصولِ ترندیول/میلا توی محتوای اشتراک‌گذاری‌شده پیدا نشد -- لینک رو دستی پیست کن.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    setSearchError("");
    setResults([]);
    setSearchDroppedWords([]);
    if (query.trim().length < 2) {
      setSearchError("حداقل ۲ حرف وارد کنید");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/admin/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error ?? "خطا در جستجو");
        return;
      }
      setResults(data.products ?? []);
      setSearchDroppedWords(data.droppedWords ?? []);
    } catch {
      setSearchError("خطای شبکه در جستجو");
    } finally {
      setSearching(false);
    }
  }

  async function loadDetail(input: string) {
    setLoadingDetail(true);
    setDetailError("");
    setDetail(null);
    generatedFilesRef.current = [];
    setCopied("");
    try {
      const res = await fetch("/api/admin/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "خطا در دریافت جزئیات");
        return;
      }
      const d = data as ProductDetail;
      // فقط وقتی واقعاً محصولِ دیگه‌ای بارگذاری شده، انتخاب‌های چک‌باکسیِ ادمین
      // (مشخصاتِ حذف‌شده/هشتگ‌های انتخابی) پاک بشن -- نه هر بار (مثلاً بعدِ
      // ترجمه‌ی یه کلمه که همین صفحه دوباره همون محصول رو بارگذاری می‌کنه)
      if (detail?.contentId !== d.contentId) {
        // مشخصاتی که ادمین قبلاً (برای هر محصولِ دیگه‌ای) خاموششون کرده بود،
        // پیش‌فرض همین‌جا هم خاموش می‌مونن -- طبقِ درخواستِ صریح
        setExcludedAttrNames(getDefaultExcludedAttrNames());
        setReversedAttrNames(new Set());
        setSelectedHashtags(new Set());
        setCustomHashtags([]);
        setCategoryIncluded(true);
      }
      setDetail(d);
      setTag(d.tag);
      setSelectedImage(d.images[0] ?? "");
      // اگه کمپینِ واقعیِ ترندیول (مثلاً «۲ عدد و بیشتر ۴۰ لیر تخفیف») پیدا شده
      // بود، خودکار توی باکسِ نارنجی بنویس. کمپین‌های کدتخفیفی (نیاز به
      // واردکردنِ کد توی چک‌اوتِ خودِ ترندیول) و تخفیفِ سبدخرید (که دیگه مستقیم
      // روی خودِ قیمت اعمال می‌شه، نه توی باکسِ نارنجی -- پایین‌تر توی
      // basketDiscountPct) عمداً از این باکس حذف می‌شن
      const realCampaigns = (d.campaignBadges ?? []).filter(
        (b) =>
          !isCouponCodeCampaign(b.text) &&
          b.discountType !== "DiscountOnBasket",
      );
      setBulkPromoLine1(realCampaigns[0]?.text ?? "");
      setBulkPromoLine2(realCampaigns[1]?.text ?? "");
    } catch {
      setDetailError("خطای شبکه در دریافت جزئیات");
    } finally {
      setLoadingDetail(false);
    }
  }

  // جایگزینِ سریعِ Web Share Target برای وقتی که (به هر دلیلی، مثلاً محدودیت‌های
  // زیرساختیِ نصبِ WebAPK) مُداشاپ توی لیستِ اشتراک‌گذاریِ سیستم‌عامل نمیاد --
  // به‌جای پیست‌کردنِ دستی توی باکس، با یک لمس محتوای کلیپ‌بورد رو می‌خونه، لینکِ
  // ترندیول/میلا رو ازش استخراج می‌کنه و خودکار بارگذاری می‌کنه
  async function pasteFromClipboard() {
    setDetailError("");
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractTrendyolLinkFromText(text);
      if (!extracted) {
        setDetailError(
          "لینکِ محصولِ ترندیول/میلا توی کلیپ‌بورد پیدا نشد -- لینک رو دستی پیست کن.",
        );
        return;
      }
      setDirectInput(extracted);
      await loadDetail(extracted);
    } catch {
      setDetailError(
        "خواندنِ کلیپ‌بورد ممکن نشد -- لینک رو دستی توی باکس پیست کن.",
      );
    }
  }

  // زوم روی پیش‌نمایشِ پوستر -- مشترک بینِ mousemove (دسکتاپ) و touchstart/move
  // (موبایل)، چون هردو فقط یه نقطه‌ی clientX/clientY نسبت به همون باکسِ دورِ
  // کانواس لازم دارن
  function zoomPosterAt(clientX: number, clientY: number, box: HTMLElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = box.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    canvas.style.transformOrigin = `${x}% ${y}%`;
    canvas.style.transform = "scale(2.2)";
  }

  function resetPosterZoom() {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.transform = "scale(1)";
  }

  // تیک‌زدنِ یه هشتگ -- حداکثر MAX_TOTAL_HASHTAGS تا هم‌زمان انتخاب می‌شن؛ اگه
  // پُر باشه، تیکِ جدید نادیده گرفته می‌شه (باید اول یکی رو بردارد). سقف رو روی
  // selectedHashtagsList.length (تعدادِ واقعاً معتبر/نمایش‌داده‌شده) چک می‌کنیم،
  // نه اندازه‌ی خامِ Set -- وگرنه یه هشتگِ یتیم که بعدِ برداشتنِ تیکِ یه مشخصه یا
  // برعکس‌کردنِ ترتیبِ کلماتش از لیستِ کاندیدها حذف شده ولی هنوز توی Set مونده،
  // بی‌صدا یکی از ۵ سهمیه رو می‌گیره -- با اینکه هیچ چک‌باکسی نشونش نمی‌ده و
  // شمارشگرِ «X از ۵» هم ندیدش می‌گیره (باگِ گزارش‌شده: «قبول نمی‌کنه با اینکه
  // ۵ تا نشده»)
  function toggleHashtag(term: string) {
    setSelectedHashtags((prev) => {
      const next = new Set(prev);
      if (next.has(term)) {
        next.delete(term);
      } else if (selectedHashtagsList.length < MAX_TOTAL_HASHTAGS) {
        next.add(term);
      }
      return next;
    });
  }

  // چسبوندنِ چندتا هشتگِ تیک‌خورده به هم و ساختِ یه هشتگِ ترکیبیِ جدید (مثلاً
  // «کیف»+«لوازم»+«آرایش» -> «کیف_لوازم_آرایش»، طبقِ درخواستِ صریح). ترتیبِ
  // *تیک‌خوردن* حفظ می‌شه (Setِ جاوااسکریپت ترتیبِ اضافه‌شدن رو نگه می‌داره) --
  // مثلاً اگه اول «چرم» و بعد «مصنوعی» رو تیک بزنی، «چرم_مصنوعی» ساخته می‌شه،
  // نه ترتیبِ نمایشیِ چک‌باکس‌ها. هشتگ‌های ترکیب‌شده از انتخاب برداشته می‌شن (خودشون هنوز به‌عنوانِ
  // چک‌باکسِ جدا موجودن) تا سقفِ ۵تایی درست شمرده بشه؛ خودِ هشتگِ ترکیبی تیک
  // نمی‌خوره
  function mergeSelectedHashtags() {
    const known = new Set([...hashtagCandidates, ...customHashtags]);
    const parts = Array.from(selectedHashtags).filter((h) => known.has(h));
    if (parts.length < 2) return;
    const merged = parts.join("_");
    // اگه همین متن از قبل یه کاندیدِ خودکاره (مثلاً «کیف_دوشی» از دسته‌بندی)، دوباره
    // به‌عنوانِ هشتگِ دستی اضافه‌ش نمی‌کنیم -- چک‌باکسِ تکراری می‌شد
    setCustomHashtags((prev) => (prev.includes(merged) || hashtagCandidates.includes(merged) ? prev : [...prev, merged]));
    // هشتگِ ترکیبی خودکار تیک نمی‌خوره (طبقِ درخواستِ صریح -- ادمین خودش تصمیم
    // می‌گیره)؛ فقط تکه‌هایی که ادغام شدن از انتخاب برمی‌دارن و بقیه‌ی تیک‌ها دست‌نخورده می‌مونن
    setSelectedHashtags((prev) => new Set(Array.from(prev).filter((h) => !parts.includes(h))));
  }

  // حذفِ یه هشتگِ دستیِ ادغام‌شده -- اگه انتخاب هم بود، از انتخاب هم برداشته می‌شه
  function removeCustomHashtag(term: string) {
    setCustomHashtags((prev) => prev.filter((h) => h !== term));
    setSelectedHashtags((prev) => {
      if (!prev.has(term)) return prev;
      const next = new Set(prev);
      next.delete(term);
      return next;
    });
  }

  // ادغام به ترتیبِ تیک انجام می‌شه؛ اگه ترتیب برعکسِ دلخواه شد، همین‌جا جای
  // بخش‌ها عوض می‌شه. متنِ هشتگ کلیدِ انتخابه، پس جایگزینیِ هم‌زمان توی
  // selectedHashtags هم لازمه تا انتخاب‌شده بمونه
  // طبقِ درخواستِ صریح: وقتی ادمین ترتیبِ یه هشتگِ ترکیبی رو برعکس می‌کنه («مصنوعی_چرم»
  // -> «چرم_مصنوعی»)، یعنی ترجمه‌ی کلمه‌به‌کلمه ترتیبش غلط بوده -- همون لحظه یه
  // ردیفِ چندکلمه‌ای با اولویتِ بالا توی دیکشنری ثبت می‌کنیم (termTr = ترکیِ هر
  // کلمه به ترتیبِ *قبل* از برعکس، termFa = ترتیبِ درست) تا دفعه‌های بعد خودِ ترجمه
  // (عنوان/مشخصات) همین‌جوری بیاد، نه فقط این‌بارِ این هشتگ. چندکلمه‌ای‌ها توی
  // دیکشنری همیشه قبل از تک‌کلمه‌ای‌ها چک می‌شن
  async function registerReversedPhrase(oldParts: string[]) {
    if (oldParts.length < 2 || oldParts.length > 3) return;
    const reversedPhrase = [...oldParts].reverse().join(" ");
    try {
      const lookup = async (termFa: string) => {
        const res = await fetch(`/api/admin/trendyol-title-dictionary?q=${encodeURIComponent(termFa)}&exact=true&limit=8`);
        const data = await res.json();
        return (Array.isArray(data.results) ? data.results : []) as { termTr: string }[];
      };
      // اگه ترتیبِ فعلی (قبل از برعکس) خودش از قبل یه ترجمه‌ی ترکیبیِ ثبت‌شده‌ست، یعنی
      // ادمین داره ترتیبِ درست رو دوباره برعکس می‌کنه -- ردیفِ معکوس نساز
      if ((await lookup(oldParts.join(" "))).length > 0) return;
      const candidates: { termTr: string }[][] = [];
      for (const w of oldParts) {
        const rows = await lookup(w);
        if (rows.length === 0) {
          setHashtagNote(`«${w}» توی دیکشنری پیدا نشد -- ترجمه‌ی ترکیبی ثبت نشد`);
          return;
        }
        candidates.push(rows);
      }
      // اگه یه کلمه چند termTr داشت، ترکیبی رو انتخاب کن که توی عنوانِ ترکیِ خامِ همین محصول هست
      const rawTitle = foldTurkish(detail?.name ?? "");
      let chosen = candidates.map((rows) => rows[0].termTr);
      const combos = candidates.reduce<string[][]>((acc, rows) => acc.flatMap((c) => rows.map((r) => [...c, r.termTr])), [[]]);
      const inTitle = combos.find((c) => rawTitle.includes(c.join(" ")));
      if (inTitle) chosen = inTitle;
      const res = await fetch("/api/admin/trendyol-title-dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termTr: chosen.join(" "), termFa: reversedPhrase, priority: 10 }),
      });
      setHashtagNote(
        res.ok
          ? `ترجمه‌ی ترکیبی ثبت شد: «${chosen.join(" ")}» ← «${reversedPhrase}» (اولویتِ بالا) -- از بارگذاریِ بعدیِ محصول اعمال می‌شه`
          : "ثبتِ ترجمه‌ی ترکیبی توی دیکشنری ناموفق بود",
      );
    } catch {
      setHashtagNote("ثبتِ ترجمه‌ی ترکیبی توی دیکشنری ناموفق بود");
    }
  }

  function reverseCustomHashtag(term: string) {
    const parts = term.split("_");
    if (parts.length < 2) return;
    const reversed = [...parts].reverse().join("_");
    void registerReversedPhrase(parts);
    setCustomHashtags((prev) => prev.map((h) => (h === term ? reversed : h)));
    setSelectedHashtags((prev) => {
      if (!prev.has(term)) return prev;
      const next = new Set(prev);
      next.delete(term);
      next.add(reversed);
      return next;
    });
  }

  // تیک‌برداشتنِ یه مشخصه‌ی کلیدی -- هم از خودِ عکس حذف می‌شه هم از هشتگ‌ها
  function toggleAttr(name: string) {
    setExcludedAttrNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      // دفعه‌ی بعد (برای هر محصولِ دیگه‌ای) هم همین ترجیح یادش بمونه
      saveDefaultExcludedAttrNames(next);
      return next;
    });
  }

  // برعکس‌کردنِ ترتیبِ کلماتِ مقدارِ یه مشخصه (مثلاً «ایستاده یقه» -> «یقه
  // ایستاده») -- هم روی خودِ چک‌باکس هم روی متنِ کشیده‌شده روی پوستر اثر می‌ذاره
  function toggleAttrReverse(name: string) {
    setReversedAttrNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function effectiveAttrValue(a: { name: string; value: string }): string {
    if (!reversedAttrNames.has(a.name)) return a.value;
    const parts = a.value.trim().split(/\s+/);
    return parts.length < 2 ? a.value : [...parts].reverse().join(" ");
  }

  async function selectProduct(r: SearchResult) {
    // باکسِ لینکِ اصلی رو هم با همین لینک پر کن -- هم برای مرجع/بررسیِ دستی
    // (دکمه‌ی «باز کردن» کنارش)، هم اگه بعداً بخواد لینک رو دستی ویرایش/دوباره
    // بارگذاری کنه
    if (r.url) setDirectInput(r.url);
    await loadDetail(r.url ?? r.id);
  }

  // تخفیفِ حتمیِ سبدخرید (DiscountOnBasket) -- برخلافِ بقیه‌ی کمپین‌ها، دیگه
  // توی باکسِ نارنجی نمیاد، بلکه مستقیم روی قیمتِ نهایی و دایره‌ی درصدِ پوستر اثر می‌ذاره
  const basketDiscountPct = detail
    ? extractBasketDiscountPercent(detail.campaignBadges ?? [])
    : null;

  // مشخصاتِ کلیدیِ کاندید (قبل از حذفِ چک‌باکسی) و لیستِ نهاییِ نمایش‌داده‌شده
  // (بعدِ حذف) -- هم روی خودِ عکس کشیده می‌شه، هم به هشتگ‌ها نمی‌رسه اگه حذف بشه.
  // قبلاً سقفِ ۸تایی داشت -- طبقِ درخواستِ صریح («مشخصاتِ بیشتری هم بیاد») برداشته
  // شد، همه‌ی مشخصاتِ فیلترشده (نه فقط تاپ ۸) به‌عنوانِ چک‌باکس نشون داده می‌شن
  const allKeyAttrs = detail
    ? pickKeyAttributes(
        detail.attributes.filter(
          (a) =>
            !a.name.includes("رنگ") &&
            !a.name.includes("سایز") &&
            // کشور/مبدأ و بسته‌بندی برای مشتری مهم نیستن -- طبقِ درخواستِ صریح
            !a.name.includes("کشور") &&
            !a.name.includes("مبدا") &&
            !a.name.includes("مبدأ") &&
            !a.name.includes("بسته"),
        ),
        Number.POSITIVE_INFINITY,
      )
    : [];
  const visibleKeyAttrs = allKeyAttrs
    .filter((a) => !excludedAttrNames.has(a.name))
    .map((a) => ({ ...a, value: effectiveAttrValue(a) }));
  // ویژگی‌هایی که هشتگ‌سازی هم ازشون استفاده می‌کنه -- همون فیلترِ چک‌باکسیِ
  // مشخصاتِ کلیدی، چون طبقِ درخواستِ صریح باید هم‌زمان از عکس و هم از هشتگ‌ها حذف بشن
  const hashtagAttributes = detail
    ? detail.attributes.filter((a) => !excludedAttrNames.has(a.name))
    : [];
  // هشتگ‌ها دقیقاً از همونی ساخته می‌شن که بالا (کلماتِ عنوان/دسته‌بندی/مشخصات)
  // تیک خورده -- طبقِ درخواستِ صریح: «هرچی بالا تیک خورد توی هشتگ‌ها هم بیاد».
  // عمداً دیگه هیچ فیلترِ اضافیِ سطحِ-کلمه روش اعمال نمی‌شه: قبلاً یه کلمه‌ی
  // برداشته‌شده از عنوان (مثلاً «ست») رو حتی از منابعِ *تیک‌خورده*ی دیگه (مثلاً
  // دسته‌بندیِ «ست پیژامه») هم حذف می‌کرد -- که دقیقاً برعکسِ قاعده‌ست: هر
  // چک‌باکس مستقل عمل می‌کنه، و اگه کلمه‌ای از یه منبعِ تیک‌خورده میاد، باید
  // هشتگ بشه، حتی اگه همون کلمه از یه منبعِ دیگه (تیک‌نخورده) هم حذف شده باشه
  // جنسیت همیشه توی لیسته (حتی اگه ویژگیِ «جنسیت» از مشخصات برداشته شده باشه --
  // برای همین از *همه‌ی* ویژگی‌ها تشخیص داده می‌شه): ترکیبِ «نوعِ محصول + جنسیت»
  // (پالتو_زنانه) و خودِ جنسیتِ تنها. پیش‌فرض فقط ترکیب تیک می‌خوره، نه جنسیتِ تنها
  const genderHashtags = detail
    ? buildGenderHashtags({
        nameFa: detail.nameFa || detail.name,
        categoryName: categoryIncluded ? detail.categoryName : null,
        attributes: detail.attributes,
        genderFa: detail.genderFa,
      })
    : { combo: null, gender: null };
  const genderComboTokens = genderHashtags.combo ? [genderHashtags.combo] : [];
  const hashtagCandidates = detail
    ? Array.from(
        new Set([
          ...genderComboTokens,
          ...(genderHashtags.gender ? [genderHashtags.gender] : []),
          ...buildGeneratedHashtags({
            nameFa: detail.nameFa || detail.name,
            brand: detail.brand,
            brandFa: detail.brandFa,
            categoryName: categoryIncluded ? detail.categoryName : null,
            sizes: detail.sizes,
            attributes: hashtagAttributes,
          }),
        ]),
      )
    : [];
  // فقط هشتگ‌هایی که از خودِ دسته‌بندی میان -- طبقِ درخواستِ صریح، اگه
  // دسته‌بندی تیک‌خورده باشه، هشتگ‌هاش حتماً باید جزوِ انتخابِ پیش‌فرض باشن
  // (نه این‌که مثلاً برند/مشخصاتِ دیگه سهمیه‌ی ۵تاییِ هشتگ رو زودتر پر کنن و
  // نوبت به دسته‌بندی نرسه)
  const categoryHashtagTokens =
    detail && categoryIncluded && detail.categoryName
      ? buildGeneratedHashtags({ categoryName: detail.categoryName })
      : [];
  // برند (لاتین + فارسی) -- طبقِ درخواستِ صریح، فقط وقتی واقعاً ترجمه شده باشه
  // (brandFa با خودِ brand فرق کنه، نه این‌که translateTrendyolAttributeText
  // چون چیزی توی دیکشنری نبوده همون متنِ لاتین رو عیناً برگردونده باشه) با
  // اولویت (بالاتر از مشخصات) هشتگ می‌شه؛ وگرنه (هنوز ترجمه نشده) اصلاً
  // پیش‌فرض تیک نمی‌خوره -- فقط به‌عنوانِ یه گزینه‌ی دستیِ انتخاب‌نشده توی
  // لیستِ کاندیدها می‌مونه
  const brandHashtagTokens =
    detail && detail.brandFa && detail.brandFa !== detail.brand
      ? buildGeneratedHashtags({ brand: detail.brand, brandFa: detail.brandFa })
      : [];
  // مشخصاتِ تیک‌خورده -- دقیقاً همون‌هایی که روی خودِ عکس هم نوشته می‌شن
  // (hashtagAttributes) -- طبقِ درخواستِ صریح، این‌ها (نه فقط عنوان/برند) باید
  // با اولویت هشتگ بشن، چون کلماتِ خاص/پرجست‌وجوترِ محصولن (جنس/رنگ/مدل و...)
  const attrHashtagTokens =
    hashtagAttributes.length > 0 ? buildGeneratedHashtags({ attributes: hashtagAttributes }) : [];
  // کلیدِ پایدار برای افکتِ زیر -- خودِ آرایه‌ی hashtagAttributes هر رندر یه
  // رفرنسِ تازه‌ست، پس نمی‌شه مستقیم توی وابستگی‌های useEffect گذاشتش
  const includedAttrNamesKey = hashtagAttributes.map((a) => a.name).join("|");

  const renderPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !detail) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = POSTER_W;
    canvas.height = POSTER_H;

    setPosterError("");
    const img = newImage();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      drawPoster(ctx, {
        image: img,
        brand: detail.brand,
        categoryName: categoryIncluded ? detail.categoryName : null,
        colorCount: detail.colorCount,
        sizes: detail.sizes,
        keyAttrs: visibleKeyAttrs,
        priceTL: detail.priceTL,
        originalPriceTL: detail.originalPriceTL,
        basketDiscountPct,
        priceIncludesBasketDiscount: detail.priceIncludesBasketDiscount,
        minDiscountPercentToShow,
        tag,
        bulkPromoLines: [bulkPromoLine1, bulkPromoLine2],
        currencyLines,
        footerOnLeft,
        layoutMirrored,
      });
    };
    // بدونِ این، اگه عکس بارگذاری نشه (شبکه‌ی موبایلِ کند، خطای موقتِ پراکسی و
    // ...) کانواس بی‌صدا خالی/قدیمی می‌مونه و کاربر فکر می‌کنه دکمه کار نکرده
    img.onerror = () =>
      setPosterError(
        "بارگذاری عکس ناموفق بود -- دوباره امتحان کنید یا عکسِ دیگری انتخاب کنید",
      );
    img.src = selectedImage;
  }, [
    detail,
    selectedImage,
    tag,
    bulkPromoLine1,
    bulkPromoLine2,
    currencyLines,
    minDiscountPercentToShow,
    excludedAttrNames,
    reversedAttrNames,
    categoryIncluded,
    footerOnLeft,
    layoutMirrored,
  ]);

  // اصلیِ کل قابلیت: با زدنِ دکمه‌ی «اینستاگرام» زیرِ یک عکسِ خاص، همان عکس
  // «اصلی» (با تمام مشخصات) و بقیه‌ی عکس‌های محصول (فقط با تگِ گوشه) ساخته و
  // دانلود می‌شوند -- همه با هم توی پوشه‌ی دانلود مرورگر (یک مسیر) می‌نشینند.
  // کپشن اینستا هم خودکار توی کلیپ‌بورد می‌رود تا بشه مستقیم پیست کرد.
  async function generateAndDownloadAll(mainImageUrl: string) {
    if (!detail || generatingAll) return;
    if (!confirmIfAlreadyPosted()) return;
    setGeneratingAll(true);
    generatedFilesRef.current = [];
    const generated: { name: string; dataUrl: string }[] = [];
    const saveGenerated = (dataUrl: string, name: string) => {
      generated.push({ name, dataUrl });
      downloadDataUrl(dataUrl, name);
    };
    setGenerateStatus("در حال ساخت عکس‌ها...");
    setSelectedImage(mainImageUrl);
    try {
      const safeTag = tag || detail.tag || "post";

      const mainImg = await loadImageAsync(mainImageUrl);
      const mainDataUrl = renderOffscreenToDataUrl((ctx) =>
        drawPoster(ctx, {
          image: mainImg,
          brand: detail.brand,
          categoryName: categoryIncluded ? detail.categoryName : null,
          colorCount: detail.colorCount,
          sizes: detail.sizes,
          keyAttrs: visibleKeyAttrs,
          priceTL: detail.priceTL,
          originalPriceTL: detail.originalPriceTL,
          basketDiscountPct,
          priceIncludesBasketDiscount: detail.priceIncludesBasketDiscount,
          minDiscountPercentToShow,
          tag: safeTag,
          bulkPromoLines: [bulkPromoLine1, bulkPromoLine2],
          currencyLines,
          footerOnLeft,
          layoutMirrored,
        }),
      );
      saveGenerated(mainDataUrl, `${safeTag}-اصلی.png`);

      const otherImages = detail.images.filter((img) => img !== mainImageUrl);
      let i = 0;
      for (const src of otherImages) {
        i += 1;
        setGenerateStatus(
          `در حال ساخت عکس ${i + 1} از ${otherImages.length + 1}...`,
        );
        // یه فاصله‌ی کوچیک بین دانلودها -- وگرنه مرورگر چندتا دانلودِ پشت‌سرهم
        // رو مسدود/بلاک‌کننده می‌کند
        await sleep(350);
        try {
          const img = await loadImageAsync(src);
          const dataUrl = renderOffscreenToDataUrl((ctx) =>
            drawTagOnlyPoster(ctx, { image: img, tag: safeTag }),
          );
          saveGenerated(dataUrl, `${safeTag}-${i + 1}.png`);
        } catch {
          // یه عکس خاص شکست خورد (مثلاً بلاک CORS) -- بقیه رو ادامه بده
        }
      }

      // عکسِ اضافه‌ی «رنگ‌های دیگر موجود» -- فقط اگه واقعاً رنگِ دیگه‌ای باشه
      let colorPosterMade = false;
      if (detail.colorVariants.length > 0) {
        setGenerateStatus("در حال ساختِ عکسِ رنگ‌های دیگر...");
        await sleep(350);
        try {
          const colorImgs = await Promise.all(
            detail.colorVariants.map((v) => loadImageAsync(v.image)),
          );
          const colorDataUrl = renderOffscreenToDataUrl((ctx) =>
            drawColorVariantsPoster(ctx, {
              images: colorImgs,
              tag: safeTag,
            }),
          );
          saveGenerated(colorDataUrl, `${safeTag}-رنگ‌های‌دیگر.png`);
          colorPosterMade = true;
        } catch {
          // بارگذاریِ عکسِ یکی از رنگ‌ها شکست خورد -- بی‌اهمیت، بقیه‌ی روند ادامه پیدا کنه
        }
      }

      // به‌جز عکسِ ترکیبیِ بالا، برای هرکدوم از رنگ‌های دیگه یه عکسِ جداگونه‌ی
      // «عادی» هم می‌سازیم -- تگ + اسمِ رنگ بالاش (طبقِ درخواستِ صریح، جدا از
      // عکسِ گریدِ ترکیبی، نه به‌جاش)
      let colorPhotosCount = 0;
      if (detail.colorVariants.length > 0) {
        let ci = 0;
        for (const variant of detail.colorVariants) {
          ci += 1;
          setGenerateStatus(
            `در حال ساختِ عکسِ رنگِ ${ci} از ${detail.colorVariants.length}...`,
          );
          await sleep(350);
          try {
            const img = await loadImageAsync(variant.image);
            const dataUrl = renderOffscreenToDataUrl((ctx) =>
              drawColorPhotoPoster(ctx, {
                image: img,
                tag: safeTag,
                colorName: variant.colorName,
              }),
            );
            saveGenerated(dataUrl, `${safeTag}-رنگ${ci}.png`);
            colorPhotosCount += 1;
          } catch {
            // بارگذاریِ عکسِ این رنگ شکست خورد -- بی‌اهمیت، رنگ‌های بعدی ادامه پیدا کنن
          }
        }
      }

      await copyText(caption, "caption");
      const totalCount =
        otherImages.length + 1 + (colorPosterMade ? 1 : 0) + colorPhotosCount;
      setGenerateStatus(`✓ ${totalCount} عکس دانلود شد و کپشن کپی شد`);
      markAsPosted();

      // طبقِ درخواستِ صریح: روی موبایل، بعدِ ساخت، اینستاگرام آماده‌ی «پستِ جدید»
      // با همین عکس‌ها باشه. لینکِ مستقیم به اپ (intent/scheme) روی گوشیِ واقعی
      // کار نکرد -- پس عکس‌ها رو از منوی اشتراکِ گوشی (Web Share) می‌فرستیم که
      // به نامِ پکیج/لینکِ اپ وابسته نیست. مرورگر این منو رو فقط بعدِ لمسِ تازه‌ی
      // کاربر اجازه می‌ده (ساخت چند ثانیه طول کشیده)، پس یه تلاشِ خودکار می‌کنیم
      // و اگه بلاک شد، دکمه‌ی «اشتراک‌گذاری» با یه لمس همین کار رو می‌کنه
      // آمادگیِ اینستاگرام جداست -- شکستش نباید یه ساختِ موفق رو «خطا» نشون بده
      try {
        // فقط پوستر اصلی (اولین فایل) -- طبقِ درخواستِ صریح: نسبتِ کادر رو ادمین
        // خودش توی اینستاگرام عوض می‌کنه و بقیه‌ی عکس‌ها رو دستی از گالری برمی‌داره
        generatedFilesRef.current = dataUrlsToFiles(generated.slice(0, 1));
        if (isMobileDevice()) await shareFiles(generatedFilesRef.current);
      } catch {
        generatedFilesRef.current = [];
      }
    } catch {
      setGenerateStatus(
        "خطا در ساخت عکس‌ها -- احتمالاً CORS. از «دانلود PNG» تکی امتحان کنید",
      );
    } finally {
      setGeneratingAll(false);
    }
  }

  // ترتیبِ hashtagCandidates+customHashtags حفظ می‌شه (نه ترتیبِ انتخاب) --
  // برای نمایشِ پایدارِ چک‌باکس‌ها؛ سقفِ ۵تایی توی خودِ toggle (نه اینجا) اعمال
  // می‌شه. customHashtags (هشتگ‌های دستیِ ادغام‌شده) هم باید اینجا حساب بشن،
  // وگرنه با اینکه چک‌باکسشون تیک‌خورده، توی کپشنِ نهایی نمی‌اومدن
  // یکتا: یه هشتگ ممکنه هم کاندیدِ خودکار باشه هم همزمان هشتگِ دستیِ ادغام‌شده (مثلاً
  // «کیف_دوشی») -- هر دو چک‌باکس به یه عضوِ Set وصلن، پس تکراری نباید دوبار توی سقفِ
  // ۵تایی و کپشن حساب بشه
  const selectedHashtagsList = Array.from(new Set([...hashtagCandidates, ...customHashtags])).filter((h) =>
    selectedHashtags.has(h),
  );

  // «انتخاب همه»: سقفِ ۵تاییِ هشتگ (سیاستِ استیج) همچنان برقراره، پس «همه» یعنی
  // تا سقفِ مجاز -- اول همین‌هایی که الان تیک خوردن می‌مونن و بقیه‌ی جاها با
  // ترتیبِ نمایشی پر می‌شه. وقتی انتخاب پره، همون چک‌باکس همه رو خالی می‌کنه
  const allHashtagTerms = Array.from(new Set([...hashtagCandidates, ...customHashtags]));
  const hashtagSelectAllTarget = Math.min(MAX_TOTAL_HASHTAGS, allHashtagTerms.length);
  const allHashtagsSelected =
    hashtagSelectAllTarget > 0 && selectedHashtagsList.length >= hashtagSelectAllTarget;
  function toggleSelectAllHashtags() {
    if (allHashtagsSelected) {
      setSelectedHashtags(new Set());
      return;
    }
    const kept = allHashtagTerms.filter((h) => selectedHashtags.has(h));
    const fill = allHashtagTerms.filter((h) => !selectedHashtags.has(h));
    setSelectedHashtags(new Set([...kept, ...fill].slice(0, MAX_TOTAL_HASHTAGS)));
  }

  const caption = detail
    ? buildCaption({
        tag,
        nameFa: detail.nameFa || detail.name,
        brand: detail.brand,
        categoryName: detail.categoryName,
        sizes: detail.sizes,
        attributes: hashtagAttributes,
        genderFa: detail.genderFa,
        hashtags: selectedHashtagsList,
      })
    : "";

  const telegramNote = detail
    ? buildTelegramNote({ tag, url: detail.url })
    : "";

  // وقتی محصولِ *تازه‌ای* بارگذاری می‌شه، هشتگ‌های پیش‌فرض انتخاب می‌شن --
  // ادمین از همون‌جا می‌تونه با چک‌باکس تغییرشون بده. عمداً از خودِ
  // hashtagCandidates (نه buildDefaultHashtagSelection که با BASE_HASHTAGS
  // پر می‌کنه) انتخاب می‌شه -- وگرنه یه هشتگِ پایه‌ی نامرتبط که هیچ چک‌باکسی
  // براش نیست می‌تونست جای یکی از ۵ سهمیه رو بگیره، در نتیجه با اینکه
  // ظاهراً کمتر از ۵تا تیک خورده، امکانِ تیک‌زدنِ پنجمی نبود (باگِ گزارش‌شده).
  // فقط با تغییرِ contentId اجرا می‌شه، نه هر بار (مثلاً بعدِ ترجمه‌ی یه کلمه
  // که همین صفحه دوباره همون محصول رو بارگذاری می‌کنه)
  useEffect(() => {
    if (!detail) return;
    // اولویت: دسته‌بندی، بعد برند (فقط اگه ترجمه شده باشه)، بعد مشخصاتِ
    // تیک‌خورده -- طبقِ درخواستِ صریح. بعدش بقیه‌ی کاندیدها (عنوان/...) به‌اندازه‌ای که جا داره
    const guaranteed = Array.from(
      new Set([...genderComboTokens, ...categoryHashtagTokens, ...brandHashtagTokens, ...attrHashtagTokens]),
    ).slice(0, MAX_TOTAL_HASHTAGS);
    // جنسیتِ تنها پیش‌فرض انتخاب نمی‌شه (فقط ترکیبش) -- ادمین دستی می‌تونه تیکش بزنه
    const rest = hashtagCandidates.filter((h) => !guaranteed.includes(h) && !isGenderOnlyHashtag(h));
    setSelectedHashtags(new Set([...guaranteed, ...rest].slice(0, MAX_TOTAL_HASHTAGS)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.contentId]);

  // برخلافِ افکتِ بالا (که فقط موقعِ محصولِ *تازه* اجرا می‌شه)، این افکت با
  // خودِ تیک‌زدنِ چک‌باکسِ دسته‌بندی/مشخصات یا تازه‌ترجمه‌شدنِ برند هم دوباره
  // اجرا می‌شه -- طبقِ درخواستِ صریح، هرچی تیک بخوره (یا برندش تازه ترجمه
  // بشه) باید حتماً توی ۵ هشتگِ نهایی هم باشه، نه فقط یه گزینه‌ی انتخاب‌نشده.
  // به‌جای ریست‌کردنِ کلِ انتخاب‌های ادمین، فقط این‌ها رو با اولویت اضافه
  // می‌کنه (لازم شد، کم‌اولویت‌ترین موردِ قبلی رو برای جا باز کردن حذف می‌کنه
  // چون سقفِ ۵تایی جابه‌جایی‌ناپذیره) -- و هشتگِ هرچی که دیگه کاندید نیست
  // (مثلاً مشخصه‌ای که همین الان تیکش برداشته شد) خودش‌به‌خود از انتخاب می‌افته
  useEffect(() => {
    if (!detail) return;
    const guaranteed = [...genderComboTokens, ...categoryHashtagTokens, ...brandHashtagTokens, ...attrHashtagTokens];
    setSelectedHashtags((prev) => {
      const stillValid = Array.from(prev).filter(
        (t) => hashtagCandidates.includes(t) || customHashtags.includes(t),
      );
      const alreadyGood =
        guaranteed.every((t) => stillValid.includes(t)) && stillValid.length === prev.size;
      if (alreadyGood) return prev;
      const rest = stillValid.filter((t) => !guaranteed.includes(t));
      return new Set([...guaranteed, ...rest].slice(0, MAX_TOTAL_HASHTAGS));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIncluded, includedAttrNamesKey, detail?.brandFa]);

  // با تغییر محصول/عکس/تگ، پوستر خودکار دوباره ساخته می‌شود (صبر برای بارگذاری فونت)
  useEffect(() => {
    if (!detail) return;
    document.fonts?.ready
      ?.then(() => renderPoster())
      .catch(() => renderPoster());
  }, [detail, selectedImage, tag, renderPoster]);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      alert("کپی با شکست مواجه شد؛ متن را دستی کپی کنید");
    }
  }

  // منوی اشتراکِ گوشی -- ادمین «بله» (یا هر پیام‌رسانِ دیگه) و مخاطب رو از همون منو
  // انتخاب می‌کنه و متن آماده توی کادرِ پیام میاد. اگه مرورگر منوی اشتراک نداشت
  // (مثلاً دسکتاپ)، حداقل کپی می‌شه
  async function shareText(text: string) {
    // اول کپی -- اگه مخاطب/اپ متن رو نگرفت یا ادمین منو رو بست، متن توی کلیپ‌بورده.
    // کپی ساکت (بدونِ alert) چون شکستش نباید جلوی بازشدنِ منوی اشتراک رو بگیره
    try {
      await navigator.clipboard.writeText(text);
      setCopied("telegram");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // ادامه بده -- منوی اشتراک هنوز کار می‌کنه
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // کاربر منو رو بست -- خطا نیست
      }
      return;
    }
    alert("مرورگرِ شما منوی اشتراک‌گذاری نداره؛ متن کپی شد -- دستی پیست کنید");
  }

  function downloadPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!confirmIfAlreadyPosted()) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${detail?.tag || "poster"}.png`;
      a.click();
      markAsPosted();
    } catch {
      alert(
        "دانلود پوستر ممکن نیست؛ احتمالاً تصویر از دامنه‌ی خارجی اجازه‌ی خروجی نمی‌دهد. از اسکرین‌شات استفاده کنید.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">پوستر اینستاگرام</h1>
        {!focusedMode && (
          <p className="text-sm text-[var(--color-muted)]">
            در ترندیول جستجو کنید، محصول را انتخاب کنید و پوستر آماده را برای
            پست در اینستاگرام بگیرید.
          </p>
        )}
      </div>

      {/* جستجو + باکسِ دستیِ لینک -- توی حالتِ focusedMode (وقتی از اشتراک‌گذاری
          یا لینکِ آماده وارد شدیم) لازم نیست: کارِ ادمین از همون لینک شروع شده */}
      {!focusedMode && (
        <section className="border cut-line rounded-xl p-4 bg-white space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="نام محصول یا برند را جستجو کنید..."
              className="flex-1 min-w-0 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {searching ? "..." : "جستجو"}
            </button>
          </div>
          {searchError && <p className="text-xs text-red-600">{searchError}</p>}
          {searchDroppedWords.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ {searchDroppedWords.map((w) => `«${w}»`).join("، ")} توی
              دیکشنری پیدا نشد و از جستجو حذف شد -- نتیجه‌ها فقط بر اساسِ بقیه‌ی
              عبارت‌ان. اگه این کلمه اشتباه نیست، از «دیکشنری عنوانِ سایت‌های
              خارجی» می‌تونی معادلِ ترکی‌شو اضافه کنی.
            </p>
          )}

          {/* اگه جستجوی زنده در دسترس نبود یا لینک محصول از قبل دم دست بود --
            مستقیم لینک کامل ترندیول/میلا (یا فقط contentId عددی) رو بده */}
          <div className="flex flex-wrap gap-2 pt-1 border-t cut-line">
            <button
              type="button"
              onClick={pasteFromClipboard}
              disabled={loadingDetail}
              title="پیست از کلیپ‌بورد و بارگذاریِ خودکار -- وقتی لینک رو از ترندیول کپی کردی"
              className="flex items-center justify-center border cut-line rounded-lg px-3 py-2 text-sm bg-white hover:border-[var(--color-wine)] shrink-0 disabled:opacity-50"
            >
              📋
            </button>
            <input
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                directInput.trim() &&
                loadDetail(directInput.trim())
              }
              placeholder="یا لینک کامل محصول ترندیول/میلا را بچسبانید..."
              dir="ltr"
              className="flex-1 min-w-0 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
            />
            {/* لینکِ متنیِ داخلِ input رو نمی‌شه مستقیم کلیک کرد -- این دکمه‌ی
              کوچیک همون لینکِ فعلیِ باکس رو توی تبِ جدید باز می‌کنه، برای
              وقتی ادمین می‌خواد قبل از ساختِ پوستر، خودِ صفحه‌ی ترندیول رو
              دوباره چک کنه. فقط وقتی لینک واقعاً یه URL باشه فعاله (نه وقتی
              فقط contentIdِ خام واردشده) */}
            {/^https?:\/\//.test(directInput.trim()) && (
              <a
                href={directInput.trim()}
                target="_blank"
                rel="noopener noreferrer"
                title="باز کردنِ این لینک توی تبِ جدید"
                className="flex items-center justify-center border cut-line rounded-lg px-3 py-2 text-sm bg-white hover:border-[var(--color-wine)] shrink-0"
              >
                🔗
              </a>
            )}
            <button
              onClick={() =>
                directInput.trim() && loadDetail(directInput.trim())
              }
              disabled={!directInput.trim() || loadingDetail}
              className="border cut-line px-5 py-2 rounded-full text-sm font-medium bg-white disabled:opacity-50 shrink-0"
            >
              بارگذاری لینک
            </button>
          </div>

          {results.length > 0 && (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectProduct(r)}
                    disabled={loadingDetail}
                    className="w-full flex items-center gap-3 border cut-line rounded-lg p-2 bg-white hover:bg-[var(--color-linen-dim)] transition-colors text-right"
                  >
                    {r.image ? (
                      <div className="relative w-14 h-14 shrink-0 bg-[var(--color-linen-dim)] rounded overflow-hidden">
                        <Image
                          src={r.image}
                          alt={r.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 shrink-0 bg-[var(--color-linen-dim)] rounded" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">
                        {r.name}
                      </span>
                      <span className="block text-xs text-[var(--color-muted)]">
                        {r.category}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-[var(--color-wine)] shrink-0">
                      {priceToman(r.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loadingDetail && (
        <p className="text-sm text-[var(--color-muted)]">
          در حال دریافت جزئیات محصول...
        </p>
      )}
      {detailError && <p className="text-sm text-red-600">{detailError}</p>}

      {detail && detail.previousPosts && detail.previousPosts.length > 0 && (
        <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ این محصول رو قبلاً (
          {new Date(detail.previousPosts[0].postedAt).toLocaleDateString("fa-IR")}
          {detail.previousPosts.length > 1
            ? ` -- ${detail.previousPosts.length} بار`
            : ""}
          ) پوستر ساختی و دانلود کردی -- به‌نظر می‌رسه توی اینستاگرام گذاشته شده.
        </p>
      )}

      {detail && (
        <section className="grid md:grid-cols-2 gap-6">
          {/* پوستر */}
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={footerOnLeft}
                onChange={(e) => setFooterOnLeft(e.target.checked)}
              />
              توضیحات (تگ/ارسال از ترکیه) سمتِ چپِ عکس باشه
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={layoutMirrored}
                onChange={(e) => setLayoutMirrored(e.target.checked)}
              />
              نوشته‌ها (مشخصات/قیمت) سمتِ چپ و دایره‌ی تخفیف سمتِ راست باشه
            </label>
            <div className="border cut-line rounded-xl p-3 bg-white">
              {/* بزرگ‌نمایی با هاور/لمس: پوستر ۱۰۸۰x۱۳۵۰ توی این باکسِ کوچیک
                  فشرده می‌شه و نوشته‌های ریزِ روی عکس (باکس‌های اطلاعات، متنِ
                  پایین) به‌سختی خونده می‌شن -- با نگه‌داشتنِ موس (دسکتاپ) یا
                  انگشت (موبایل) روی هر ناحیه، همون ناحیه زوم می‌شه تا خوانا
                  بشه. touch-none که ژستِ لمس داخلِ همین باکس به‌جای اسکرولِ
                  صفحه، برای ردیابیِ خودِ زوم استفاده بشه */}
              <div
                className="relative overflow-hidden rounded-lg aspect-[4/5] touch-none"
                onMouseMove={(e) => {
                  zoomPosterAt(e.clientX, e.clientY, e.currentTarget);
                }}
                onMouseLeave={resetPosterZoom}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (t) zoomPosterAt(t.clientX, t.clientY, e.currentTarget);
                }}
                onTouchMove={(e) => {
                  const t = e.touches[0];
                  if (t) zoomPosterAt(t.clientX, t.clientY, e.currentTarget);
                }}
                onTouchEnd={resetPosterZoom}
                onTouchCancel={resetPosterZoom}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full rounded-lg transition-transform duration-100 ease-out"
                />
              </div>
            </div>
            {posterError && (
              <p className="text-sm text-red-600">{posterError}</p>
            )}
            {/* کلماتِ عنوان، دسته‌بندی، و مشخصات -- هرکدوم رو بردار، هم از خودِ
                عکس هم از هشتگ‌ها حذف می‌شه (طبقِ درخواستِ صریح) */}
            {(detail.categoryName || allKeyAttrs.length > 0) && (
              <div className="border cut-line rounded-xl p-3 bg-white space-y-3">
                {detail.categoryName && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold">دسته‌بندی</p>
                    <label className="inline-flex items-center gap-1 border cut-line rounded-full px-2 py-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={categoryIncluded}
                        onChange={() => setCategoryIncluded((v) => !v)}
                      />
                      {detail.categoryName}
                    </label>
                  </div>
                )}
                {allKeyAttrs.length > 0 && <p className="text-xs font-bold">مشخصات</p>}
                <div className="flex flex-wrap gap-2">
                  {allKeyAttrs.map((a) => {
                    const canReverse = a.value.trim().split(/\s+/).length >= 2;
                    return (
                      <span
                        key={a.name}
                        className="inline-flex items-center gap-1 border cut-line rounded-full px-2 py-1 text-xs"
                      >
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!excludedAttrNames.has(a.name)}
                            onChange={() => toggleAttr(a.name)}
                          />
                          {effectiveAttrValue(a)}
                        </label>
                        {canReverse && (
                          <button
                            type="button"
                            onClick={() => toggleAttrReverse(a.name)}
                            title="برعکس‌کردنِ ترتیبِ کلماتِ این مشخصه"
                            className="text-[var(--color-muted)] hover:text-[var(--color-wine)]"
                          >
                            🔄
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {/* برند باید یکجا (نه کلمه‌به‌کلمه) ترجمه بشه -- طبقِ درخواستِ صریح
                («u.s polo assn باید یکدفعه بیاد») -- برای همین از
                checkText/PosterUntranslatedTerms پایین‌تر (که هر متن رو تکه‌تکه
                می‌کنه) جدا نگه داشته شده و مستقیم با TranslatableRun (که
                coreWordsِ چندتایی رو یه عبارتِ واحد می‌سازه) نشون داده می‌شه */}
            {detail.brand && (
              <p className="text-xs flex items-center gap-1.5 flex-wrap">
                <span className="font-bold shrink-0">برند:</span>
                <span dir="ltr">
                  <TranslatableRun
                    displayText={detail.brand}
                    coreWords={brandCoreWords(detail.brand)}
                    onSaved={() => directInput.trim() && loadDetail(directInput.trim())}
                  />
                </span>
                {detail.brandFa && detail.brandFa !== detail.brand && (
                  <span className="text-[var(--color-muted)]">(الان: {detail.brandFa})</span>
                )}
              </p>
            )}
            {/* باکسِ نارنجیِ تخفیفِ خریدِ چندعددی دیگه ویرایش‌پذیر نیست -- طبقِ
                تصمیمِ صریح، فقط وقتی کمپینِ واقعیِ ترندیول پیدا بشه (loadDetail)
                خودکار پر می‌شه؛ ادمین قرار نیست دستی تغییرش بده */}
            <PosterUntranslatedTerms
              checkText={[
                detail.nameFa || detail.name,
                detail.categoryName,
                ...hashtagAttributes.map((a) => `${a.name} ${a.value}`),
                ...detail.colorVariants.map((v) => v.colorName),
                bulkPromoLine1,
                bulkPromoLine2,
              ]
                .filter(Boolean)
                .join(" ")}
              onTranslated={() => directInput.trim() && loadDetail(directInput.trim())}
            />

            {/* هر عکس یه دکمه‌ی «اینستاگرام» جدا دارد -- هرکدوم رو بزنی همون
                عکسِ «اصلی» (با تمام مشخصات) می‌شه، بقیه‌ی عکس‌ها فقط با تگِ
                گوشه ساخته و همه با هم دانلود می‌شن (کپشن هم خودکار کپی می‌شه) */}
            <div className="space-y-2">
              <span className="text-xs text-[var(--color-muted)]">
                عکس‌های محصول:
              </span>
              <div className="flex flex-wrap gap-3">
                {detail.images.map((img, idx) => (
                  <div key={img} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedImage(img)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        selectedImage === img
                          ? "border-[var(--color-wine)]"
                          : "border-transparent"
                      }`}
                      title="پیش‌نمایش این عکس به‌عنوان اصلی"
                    >
                      <Image
                        src={img}
                        alt=""
                        width={64}
                        height={64}
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndDownloadAll(img)}
                      disabled={generatingAll}
                      className="text-[10px] font-medium text-white bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-full px-2.5 py-1 disabled:opacity-50"
                      title={
                        idx === 0
                          ? "این عکس اصلی، بقیه فقط با تگ"
                          : "این عکس اصلی شود"
                      }
                    >
                      📷 اینستاگرام
                    </button>
                  </div>
                ))}
              </div>
              {generateStatus && (
                <p className="text-xs text-[var(--color-wine)] font-medium">
                  {generateStatus}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => generateAndDownloadAll(selectedImage)}
                disabled={generatingAll || !selectedImage}
                className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
              >
                {generatingAll ? "در حال ساخت..." : "ساخت پوستر (همه‌ی عکس‌ها)"}
              </button>
              <button
                onClick={downloadPoster}
                className="border cut-line px-5 py-2 rounded-full text-sm font-medium bg-white"
              >
                دانلود PNG (فقط همین عکس)
              </button>
              <button
                  disabled={generatingAll || !selectedImage}
                  onClick={async () => {
                    // هنوز چیزی ساخته نشده -- اول می‌سازه (که خودش اگه مرورگر اجازه بده
                    // منوی اشتراک رو هم باز می‌کنه)؛ وگرنه مستقیم عکس‌های آماده رو می‌فرسته
                    if (generatedFilesRef.current.length === 0) {
                      await generateAndDownloadAll(selectedImage);
                      return;
                    }
                    const ok = await shareFiles(generatedFilesRef.current);
                    if (!ok) {
                      setGenerateStatus(
                        "منوی اشتراک‌گذاریِ گوشی باز نشد -- از «باز کردن اپ اینستاگرام» استفاده کن",
                      );
                    }
                  }}
                  className="bg-gradient-to-l from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
                >
                  📲 ارسال پوستر اصلی به اینستاگرام
              </button>
              <a
                href={instagramHref}
                className="border cut-line px-5 py-2 rounded-full text-sm font-medium bg-white"
              >
                باز کردن اپ اینستاگرام
              </a>
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              «ارسال پوستر اصلی» (اگه هنوز نساخته‌ای اول می‌سازه) فقط عکسِ اصلی رو توی منوی اشتراکِ
              گوشی می‌ذاره -- اینستاگرام → «پست/Feed» رو بزن، نسبتِ کادر (Ratio) رو خودت عوض کن و بقیه‌ی
              عکس‌ها رو از گالری اضافه کن (همه توی گالری ذخیره شدن)؛ کپشن هم کپی شده، فقط پیست کن.
            </p>
          </div>

          {/* کپشن و لینک */}
          <div className="space-y-4">
            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <label className="block text-sm font-bold">
                تگ (منحصربه‌فرد، قابل جستجو در تلگرام)
              </label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                dir="ltr"
              />
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold">
                  کپشن اینستاگرام
                </label>
                <button
                  onClick={() => copyText(caption, "caption")}
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "caption" ? "کپی شد ✓" : "کپی کپشن"}
                </button>
              </div>
              <textarea
                value={caption}
                readOnly
                rows={14}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-[var(--color-linen-dim)]"
              />
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold">
                  هشتگ‌ها ({selectedHashtagsList.length} از {MAX_TOTAL_HASHTAGS})
                </span>
                <div className="flex items-center gap-3">
                  {/* فقط وقتی ۲تا یا بیشتر تیک خورده معنی داره -- برای چسبوندن‌شون
                      به هم و ساختِ یه هشتگِ ترکیبیِ جدید (طبقِ درخواستِ صریح) */}
                  {selectedHashtags.size >= 2 && (
                    <button
                      onClick={mergeSelectedHashtags}
                      className="text-xs text-[var(--color-ochre)] hover:underline"
                    >
                      🔗 ادغام به یک هشتگ
                    </button>
                  )}
                  <button
                    onClick={() =>
                      copyText(
                        selectedHashtagsList.map((h) => `#${h}`).join(" "),
                        "hashtags",
                      )
                    }
                    className="text-xs text-[var(--color-wine)] hover:underline"
                  >
                    {copied === "hashtags" ? "کپی شد ✓" : "کپی هشتگ‌ها"}
                  </button>
                </div>
              </div>
              {/* بازای هرکدوم چک‌باکس -- حداکثر ۵تا هم‌زمان قابلِ انتخابن. اول
                  کاندیدهای خودکار، بعد هشتگ‌های دستیِ ادغام‌شده (با دکمه‌ی حذف) */}
              {hashtagNote && <p className="text-[11px] text-emerald-700">{hashtagNote}</p>}
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={allHashtagsSelected}
                  disabled={hashtagSelectAllTarget === 0}
                  onChange={toggleSelectAllHashtags}
                />
                انتخاب همه (حداکثر {MAX_TOTAL_HASHTAGS.toLocaleString("fa-IR")} تا)
              </label>
              <div className="flex flex-wrap gap-2" dir="ltr">
                {hashtagCandidates.map((h) => {
                  const checked = selectedHashtags.has(h);
                  const disabled =
                    !checked &&
                    selectedHashtagsList.length >= MAX_TOTAL_HASHTAGS;
                  return (
                    <label
                      key={h}
                      className={`inline-flex items-center gap-1 border cut-line rounded-full px-2 py-1 text-xs ${
                        disabled ? "opacity-40" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleHashtag(h)}
                      />
                      #{h}
                    </label>
                  );
                })}
                {customHashtags.filter((h) => !hashtagCandidates.includes(h)).map((h) => {
                  const checked = selectedHashtags.has(h);
                  const disabled =
                    !checked &&
                    selectedHashtagsList.length >= MAX_TOTAL_HASHTAGS;
                  return (
                    <span
                      key={h}
                      className={`inline-flex items-center gap-1 border border-[var(--color-ochre)] rounded-full px-2 py-1 text-xs ${
                        disabled ? "opacity-40" : ""
                      }`}
                    >
                      <label className={`inline-flex items-center gap-1 ${disabled ? "" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleHashtag(h)}
                        />
                        #{h}
                      </label>
                      <button
                        type="button"
                        onClick={() => reverseCustomHashtag(h)}
                        title="برعکس‌کردنِ ترتیبِ بخش‌های این هشتگِ ترکیبی"
                        className="text-[var(--color-muted)] hover:text-[var(--color-wine)]"
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomHashtag(h)}
                        title="حذفِ این هشتگِ ترکیبی"
                        className="text-[var(--color-muted)] hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  متن تلگرام (تگ + لینک)
                </span>
                <span className="flex items-center gap-3">
                  <button
                    onClick={() => shareText(telegramNote)}
                    className="text-xs text-[var(--color-wine)] font-bold hover:underline"
                  >
                    📤 ارسال به بله/تلگرام
                  </button>
                  <button
                    onClick={() => copyText(telegramNote, "telegram")}
                    className="text-xs text-[var(--color-wine)] hover:underline"
                  >
                    {copied === "telegram" ? "کپی شد ✓" : "کپی متن تلگرام"}
                  </button>
                </span>
              </div>
              <textarea
                value={telegramNote}
                readOnly
                rows={3}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-[var(--color-linen-dim)]"
                dir="ltr"
              />
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">لینک اصلی ترندیول</span>
                <button
                  onClick={() => copyText(detail.url, "link")}
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "link" ? "کپی شد ✓" : "کپی لینک"}
                </button>
              </div>
              <p
                className="text-xs text-[var(--color-muted)] break-all"
                dir="ltr"
              >
                {detail.url}
              </p>
              <div className="flex items-center justify-between pt-2 border-t cut-line">
                <span className="text-sm font-bold">لینک معادل در مُداشاپ</span>
                <button
                  onClick={() =>
                    copyText(
                      siteUrl(`/products/trendyol/${detail.contentId}`),
                      "mudaLink",
                    )
                  }
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "mudaLink" ? "کپی شد ✓" : "کپی لینک"}
                </button>
              </div>
              <p
                className="text-xs text-[var(--color-muted)] break-all"
                dir="ltr"
              >
                {siteUrl(`/products/trendyol/${detail.contentId}`)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">تگ برای جستجو</span>
                <button
                  onClick={() => copyText(`#${tag}`, "tagcopy")}
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "tagcopy" ? "کپی شد ✓" : "کپی تگ"}
                </button>
              </div>
              <p className="text-xs text-[var(--color-muted)]" dir="ltr">
                #{tag}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
