"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  buildCaption,
  buildTelegramNote,
  buildGeneratedHashtags,
  getDiscountPercent,
  pickKeyAttributes,
  priceToman,
  toEnglishBrandName,
} from "@/lib/poster";

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
  categoryName: string | null;
  images: string[];
  attributes: { name: string; value: string }[];
  sizes: string[];
  colorCount: number;
  price: number | null;
  originalPrice: number | null;
  priceTL: number | null;
  originalPriceTL: number | null;
  inStock: boolean;
  url: string;
  tag: string;
  campaignBadges: { id: number; text: string }[];
};

// ۱۰۸۰x۱۳۵۰ (نسبت ۴:۵) -- سایزِ عمودیِ مجازِ اینستاگرام، نه مربع
const POSTER_W = 1080;
const POSTER_H = 1350;
// تقسیمِ عمودی: نیمه‌ی چپ = عکسِ کاملِ محصول (بدون کراپ)، نیمه‌ی راست = ستونِ
// اطلاعات -- چون متن فارسی از راست خوانده می‌شود، اطلاعات سمتِ راست منطقی‌تره
const PHOTO_W = 540;
const INFO_X = PHOTO_W;
const INFO_W = POSTER_W - PHOTO_W;
// فاصله‌ی چپِ ستون از خودِ عکس بیشتره (کمتر تصرفِ محتوای عکس، چون عکس گاهی تا
// اینجا هم سرریز می‌کند)، فاصله‌ی راست از لبه‌ی کانواس کمتره -- عرضِ کلیِ
// ستون هم به همین خاطر کمتر از قبل می‌شود
const COL_LEFT_INSET = 90;
const COL_RIGHT_INSET = 14;
const COL_X = INFO_X + COL_LEFT_INSET;
const COL_W = INFO_W - COL_LEFT_INSET - COL_RIGHT_INSET;
// بک‌گراندِ همه‌ی باکس‌های ستونِ اطلاعات کمی ترانسپارنته (نه کاملاً پُررنگ)
const BOX_BG_ALPHA = 0.86;

// رنگ‌های ردیف‌های اطلاعات
const C_PURPLE = "#6d4bc1";
const C_ORANGE = "#f97316";
const C_KHAKI = "#cbb488";
const C_KHAKI_TEXT = "#5b4522";
const C_RED = "#e11d48";
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
  r: number
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
function wrapLines(ctx: CanvasRenderingContext2D, lines: string[], maxWidth: number): string[] {
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
  }
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
    attributes: { name: string; value: string }[];
    priceTL: number | null;
    originalPriceTL: number | null;
    tag: string;
    bulkPromoLines: string[];
    currencyLines: string[];
  }
) {
  const {
    image,
    brand,
    categoryName,
    colorCount,
    sizes,
    attributes,
    priceTL: price,
    originalPriceTL,
    tag,
    bulkPromoLines,
    currencyLines,
  } = opts;

  // ===== عکسِ کاملِ محصول -- مبنا ارتفاعِ کامل (POSTER_H)، نه عرض؛ اگه عرضش
  // بیشتر از نیمه‌ی چپ شد، همون‌طور کشیده می‌شه (روی ستونِ اطلاعات هم بره اشکالی نداره) =====
  ctx.fillStyle = C_WHITE;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const scale = POSTER_H / image.height;
  const dw = image.width * scale;
  ctx.drawImage(image, 0, 0, dw, POSTER_H);

  const discountPct = getDiscountPercent(price, originalPriceTL);
  const hasDiscount = discountPct != null && discountPct > 0 && originalPriceTL != null;

  // دایره‌ی تخفیف و اسمِ برند هر دو روی همین محورِ افقی سنتر می‌شن -- کمی
  // فاصله‌گرفته از لبه‌ی چپ عکس تا اسمِ برندِ بلند هم جا داشته باشد
  const badgeCenterX = 150;

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

    ctx.textBaseline = "middle";
    const numText = faNum(discountPct);
    const gapPx = 8;
    // فونت رو تا جایی که جا بشه توی دایره بزرگ می‌کنیم (نه یه سایزِ ثابت) --
    // با گرد شدنِ درصدهای تک‌رقمی/دورقمی، عرضِ لازم فرق می‌کنه
    const maxTextWidth = 2 * r - 20;
    let glyphSize = 40;
    ctx.font = `bold ${glyphSize}px Vazirmatn, Tahoma, sans-serif`;
    while (glyphSize < 120) {
      ctx.font = `bold ${glyphSize + 2}px Vazirmatn, Tahoma, sans-serif`;
      const w = ctx.measureText(numText).width + ctx.measureText("٪").width + gapPx;
      if (w > maxTextWidth) break;
      glyphSize += 2;
    }
    ctx.font = `bold ${glyphSize}px Vazirmatn, Tahoma, sans-serif`;
    const numW = ctx.measureText(numText).width;
    const pctW = ctx.measureText("٪").width;
    const totalW = numW + pctW + gapPx;
    ctx.textAlign = "left";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText("٪", cx - totalW / 2, cy + 3);
    ctx.strokeText(numText, cx - totalW / 2 + pctW + gapPx, cy);
    ctx.fillStyle = C_RED;
    ctx.fillText("٪", cx - totalW / 2, cy + 3);
    ctx.fillText(numText, cx - totalW / 2 + pctW + gapPx, cy);
    ctx.restore();
  }

  // اسمِ برند -- سمتِ چپِ عکس (نه ستونِ اطلاعات)، سنتر جاستیفای‌شده با دایره‌ی
  // تخفیف، با حروفِ سفیدِ درشت و حاشیه‌ی مشکی تا روی هر رنگ عکسی خوانا بماند.
  // فونت خودکار کوچیک می‌شود تا برندهای بلند از لبه‌ی عکس بیرون نزنند (نه
  // این‌که نصفه‌ش کات شود، مثل قبل)
  if (brand) {
    const by = hasDiscount ? 270 : 70;
    ctx.save();
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#ffffff";
    const brandText = toEnglishBrandName(brand).toUpperCase();
    const maxBrandWidth = Math.min(badgeCenterX * 2 - 24, PHOTO_W - 40);
    let brandFontSize = 40;
    ctx.font = `bold ${brandFontSize}px Tahoma, sans-serif`;
    while (ctx.measureText(brandText).width > maxBrandWidth && brandFontSize > 20) {
      brandFontSize -= 2;
      ctx.font = `bold ${brandFontSize}px Tahoma, sans-serif`;
    }
    ctx.strokeText(brandText, badgeCenterX, by);
    ctx.fillText(brandText, badgeCenterX, by);
    ctx.restore();
  }

  // ===== ستونِ اطلاعات (نیمه‌ی راست) =====
  let y = 40;
  const gap = 8;

  // نرخ ارز + هزینه‌ی ارسال -- متنش قابل‌تغییر توسط ادمین (تنظیمات سایت)
  y +=
    drawMultilineBox(ctx, {
      x: COL_X,
      y,
      w: COL_W,
      bg: C_PURPLE,
      fg: "#ffffff",
      lines: currencyLines,
      fontSize: 30,
    }) + gap;

  // تخفیفِ خریدِ چندعددی -- یک باکسِ گروه‌بندی‌شده (نه ردیف‌های جدا)، اختیاری
  // (دستیِ ادمین -- کمپین‌های واقعیِ ترندیول توی HTMLِ ثابتِ صفحه نیستن، سمتِ
  // کلاینت لود می‌شن، پس نمی‌شه خودکار پیدا/ترجمه‌شون کرد)
  const promoLines = bulkPromoLines.filter(Boolean);
  if (promoLines.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: COL_X,
        y,
        w: COL_W,
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
        x: COL_X,
        y,
        w: COL_W,
        bg: C_GRAY_TINT,
        fg: C_GRAY_TINT_TEXT,
        lines: [categoryName],
        fontSize: 29,
      }) + gap;
  }

  // رنگ + سایزها -- یک باکسِ گروه‌بندی‌شده (نه دو باکسِ جدا)
  const colorSizeLines: string[] = [];
  if (colorCount > 1) colorSizeLines.push("چندرنگ");
  if (sizes.length > 0) colorSizeLines.push(sizes.slice(0, 8).join("  "));
  if (colorSizeLines.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: COL_X,
        y,
        w: COL_W,
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
  const keyAttrs = pickKeyAttributes(attributes.filter((a) => !a.name.includes("رنگ")), 4);
  if (keyAttrs.length > 0) {
    y +=
      drawMultilineBox(ctx, {
        x: COL_X,
        y,
        w: COL_W,
        bg: C_GRAY_TINT,
        fg: C_GRAY_TINT_TEXT,
        lines: keyAttrs.map((a) => a.value),
        fontSize: 24,
      }) + gap;
  }

  // قیمت -- یک باکس؛ در صورتِ تخفیف، قیمتِ اصلی با خطِ خورده + قیمتِ نهایی قرمز
  if (price != null) {
    const boxH = hasDiscount ? 116 : 78;
    ctx.save();
    ctx.globalAlpha = BOX_BG_ALPHA;
    ctx.fillStyle = C_PRICE_TINT;
    roundRect(ctx, COL_X, y, COL_W, boxH, 16);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (hasDiscount) {
      const origText = `${faNum(Math.round(originalPriceTL!))}TL`;
      ctx.font = "26px Vazirmatn, Tahoma, sans-serif";
      ctx.fillStyle = C_KHAKI_TEXT;
      const oy = y + 33;
      ctx.fillText(origText, COL_X + COL_W / 2, oy);
      const ow = ctx.measureText(origText).width;
      ctx.strokeStyle = C_KHAKI_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(COL_X + COL_W / 2 - ow / 2, oy);
      ctx.lineTo(COL_X + COL_W / 2 + ow / 2, oy);
      ctx.stroke();

      ctx.font = "bold 46px Vazirmatn, Tahoma, sans-serif";
      ctx.fillStyle = C_RED;
      ctx.fillText(`${faNum(Math.round(price))}TL`, COL_X + COL_W / 2, y + 82);
    } else {
      ctx.font = "bold 46px Vazirmatn, Tahoma, sans-serif";
      ctx.fillStyle = C_KHAKI_TEXT;
      ctx.fillText(`${faNum(Math.round(price))}TL`, COL_X + COL_W / 2, y + boxH / 2 + 2);
    }
    ctx.restore();
    y += boxH + gap;
  }

  // هندل/تگ/ارسال -- بدون باکس، وسط‌چین. چون ممکنه روی عکس بیفتد (وقتی عکس
  // به نیمه‌ی راست سرریز می‌کند)، یک هالوی سفید دورِ نوشته‌ها می‌کشیم تا خوانا بماند
  y += 12; // کمی فضا قبل از این بخش
  const centerX = COL_X + COL_W / 2;
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#111827";
  ctx.font = "bold 32px Tahoma, sans-serif";
  ctx.strokeText("@Shopping.Stage", centerX, y + 26);
  ctx.fillText("@Shopping.Stage", centerX, y + 26);
  y += 40;
  ctx.strokeText(`#${tag}`, centerX, y + 26);
  ctx.fillText(`#${tag}`, centerX, y + 26);
  y += 46;
  ctx.direction = "rtl";
  ctx.fillStyle = C_RED;
  ctx.font = "bold 32px Vazirmatn, Tahoma, sans-serif";
  ctx.strokeText("ارسال از ترکیه", centerX, y + 26);
  ctx.fillText("ارسال از ترکیه", centerX, y + 26);
  ctx.restore();
}

// کشیدن عکس‌های غیرِ اصلی -- فقط تصویر تمام‌قاب + یک تگ کوچک روی گوشه‌ی
// پایین-چپ (کافیه که مشتری بداند کدام پست/محصول است، بدون تکرار کل مشخصات)
function drawTagOnlyPoster(ctx: CanvasRenderingContext2D, opts: { image: HTMLImageElement; tag: string }) {
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
function renderOffscreenToDataUrl(draw: (ctx: CanvasRenderingContext2D) => void): string {
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

export default function PosterGeneratorPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
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
  const [currencyLines, setCurrencyLines] = useState<string[]>(["نرخ ارز روزانه و", "هزینه ارسال هوایی"]);

  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, string> | null) => {
        const text = data?.posterCurrencyText;
        if (text) setCurrencyLines(text.split("\n").filter(Boolean));
      })
      .catch(() => {});
  }, []);

  async function handleSearch() {
    setSearchError("");
    setResults([]);
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
      setDetail(d);
      setTag(d.tag);
      setSelectedImage(d.images[0] ?? "");
      // اگه کمپینِ واقعیِ ترندیول (مثلاً «۲ عدد و بیشتر ۴۰ لیر تخفیف») پیدا شده
      // بود، خودکار توی باکسِ نارنجی بنویس -- ادمین همچنان می‌تونه ویرایش/پاک کند
      setBulkPromoLine1(d.campaignBadges?.[0]?.text ?? "");
      setBulkPromoLine2(d.campaignBadges?.[1]?.text ?? "");
    } catch {
      setDetailError("خطای شبکه در دریافت جزئیات");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function selectProduct(r: SearchResult) {
    await loadDetail(r.url ?? r.id);
  }

  const renderPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !detail) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = POSTER_W;
    canvas.height = POSTER_H;

    const img = newImage();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      drawPoster(ctx, {
        image: img,
        brand: detail.brand,
        categoryName: detail.categoryName,
        colorCount: detail.colorCount,
        sizes: detail.sizes,
        attributes: detail.attributes,
        priceTL: detail.priceTL,
        originalPriceTL: detail.originalPriceTL,
        tag,
        bulkPromoLines: [bulkPromoLine1, bulkPromoLine2],
        currencyLines,
      });
    };
    img.src = selectedImage;
  }, [detail, selectedImage, tag, bulkPromoLine1, bulkPromoLine2, currencyLines]);

  // اصلیِ کل قابلیت: با زدنِ دکمه‌ی «اینستاگرام» زیرِ یک عکسِ خاص، همان عکس
  // «اصلی» (با تمام مشخصات) و بقیه‌ی عکس‌های محصول (فقط با تگِ گوشه) ساخته و
  // دانلود می‌شوند -- همه با هم توی پوشه‌ی دانلود مرورگر (یک مسیر) می‌نشینند.
  // کپشن اینستا هم خودکار توی کلیپ‌بورد می‌رود تا بشه مستقیم پیست کرد.
  async function generateAndDownloadAll(mainImageUrl: string) {
    if (!detail || generatingAll) return;
    setGeneratingAll(true);
    setGenerateStatus("در حال ساخت عکس‌ها...");
    setSelectedImage(mainImageUrl);
    try {
      const safeTag = tag || detail.tag || "post";

      const mainImg = await loadImageAsync(mainImageUrl);
      const mainDataUrl = renderOffscreenToDataUrl((ctx) =>
        drawPoster(ctx, {
          image: mainImg,
          brand: detail.brand,
          categoryName: detail.categoryName,
          colorCount: detail.colorCount,
          sizes: detail.sizes,
          attributes: detail.attributes,
          priceTL: detail.priceTL,
          originalPriceTL: detail.originalPriceTL,
          tag: safeTag,
          bulkPromoLines: [bulkPromoLine1, bulkPromoLine2],
          currencyLines,
        })
      );
      downloadDataUrl(mainDataUrl, `${safeTag}-اصلی.png`);

      const otherImages = detail.images.filter((img) => img !== mainImageUrl);
      let i = 0;
      for (const src of otherImages) {
        i += 1;
        setGenerateStatus(`در حال ساخت عکس ${i + 1} از ${otherImages.length + 1}...`);
        // یه فاصله‌ی کوچیک بین دانلودها -- وگرنه مرورگر چندتا دانلودِ پشت‌سرهم
        // رو مسدود/بلاک‌کننده می‌کند
        await sleep(350);
        try {
          const img = await loadImageAsync(src);
          const dataUrl = renderOffscreenToDataUrl((ctx) => drawTagOnlyPoster(ctx, { image: img, tag: safeTag }));
          downloadDataUrl(dataUrl, `${safeTag}-${i + 1}.png`);
        } catch {
          // یه عکس خاص شکست خورد (مثلاً بلاک CORS) -- بقیه رو ادامه بده
        }
      }

      await copyText(caption, "caption");
      setGenerateStatus(`✓ ${otherImages.length + 1} عکس دانلود شد و کپشن کپی شد`);
    } catch {
      setGenerateStatus("خطا در ساخت عکس‌ها -- احتمالاً CORS. از «دانلود PNG» تکی امتحان کنید");
    } finally {
      setGeneratingAll(false);
    }
  }

  const caption = detail
    ? buildCaption({
        tag,
        nameFa: detail.nameFa || detail.name,
        brand: detail.brand,
        categoryName: detail.categoryName,
        sizes: detail.sizes,
        attributes: detail.attributes,
      })
    : "";

  const generatedHashtags = detail
    ? buildGeneratedHashtags({
        nameFa: detail.nameFa || detail.name,
        brand: detail.brand,
        categoryName: detail.categoryName,
        sizes: detail.sizes,
        attributes: detail.attributes,
      })
    : [];

  const telegramNote = detail ? buildTelegramNote({ tag, url: detail.url }) : "";

  // با تغییر محصول/عکس/تگ، پوستر خودکار دوباره ساخته می‌شود (صبر برای بارگذاری فونت)
  useEffect(() => {
    if (!detail) return;
    document.fonts?.ready?.then(() => renderPoster()).catch(() => renderPoster());
  }, [detail, selectedImage, tag, renderPoster]);

  // اگه از صفحه‌ی محصول با لینک «ساخت پست اینستاگرام» (که input رو توی query
  // می‌فرسته) اومده باشیم، همون لینک رو خودکار بارگذاری کن -- بدون این‌که
  // کاربر دوباره مجبور شه لینک رو دستی پیست کند
  useEffect(() => {
    const input = new URLSearchParams(window.location.search).get("input");
    if (input) loadDetail(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      alert("کپی با شکست مواجه شد؛ متن را دستی کپی کنید");
    }
  }

  function downloadPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${detail?.tag || "poster"}.png`;
      a.click();
    } catch {
      alert("دانلود پوستر ممکن نیست؛ احتمالاً تصویر از دامنه‌ی خارجی اجازه‌ی خروجی نمی‌دهد. از اسکرین‌شات استفاده کنید.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">پوستر اینستاگرام</h1>
        <p className="text-sm text-[var(--color-muted)]">
          در ترندیول جستجو کنید، محصول را انتخاب کنید و پوستر آماده را برای پست در اینستاگرام بگیرید.
        </p>
      </div>

      {/* جستجو */}
      <section className="border cut-line rounded-xl p-4 bg-white space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="نام محصول یا برند را جستجو کنید..."
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
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

        {/* اگه جستجوی زنده در دسترس نبود یا لینک محصول از قبل دم دست بود --
            مستقیم لینک کامل ترندیول/میلا (یا فقط contentId عددی) رو بده */}
        <div className="flex gap-2 pt-1 border-t cut-line">
          <input
            value={directInput}
            onChange={(e) => setDirectInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && directInput.trim() && loadDetail(directInput.trim())}
            placeholder="یا لینک کامل محصول ترندیول/میلا را بچسبانید..."
            dir="ltr"
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={() => directInput.trim() && loadDetail(directInput.trim())}
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
                      <Image src={r.image} alt={r.name} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="w-14 h-14 shrink-0 bg-[var(--color-linen-dim)] rounded" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{r.name}</span>
                    <span className="block text-xs text-[var(--color-muted)]">{r.category}</span>
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

      {loadingDetail && <p className="text-sm text-[var(--color-muted)]">در حال دریافت جزئیات محصول...</p>}
      {detailError && <p className="text-sm text-red-600">{detailError}</p>}

      {detail && (
        <section className="grid md:grid-cols-2 gap-6">
          {/* پوستر */}
          <div className="space-y-3">
            <div className="border cut-line rounded-xl p-3 bg-white">
              <canvas ref={canvasRef} className="w-full rounded-lg aspect-[4/5]" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold">
                باکسِ نارنجیِ تخفیفِ خرید چندعددی (اگه کمپینِ واقعی روی محصول باشه،
                خودکار پیدا/ترجمه می‌شه؛ در غیر این صورت خالیه و می‌تونی دستی بنویسی یا خالی بگذاری)
              </label>
              <input
                value={bulkPromoLine1}
                onChange={(e) => setBulkPromoLine1(e.target.value)}
                placeholder="مثلاً ۳ عدد خرید = ۷۰ لیر تخفیف (خالی = نشون نده)"
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
              <input
                value={bulkPromoLine2}
                onChange={(e) => setBulkPromoLine2(e.target.value)}
                placeholder="مثلاً ۴ عدد خرید = ۱۲۰ لیر تخفیف (خالی = نشون نده)"
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>

            {/* هر عکس یه دکمه‌ی «اینستاگرام» جدا دارد -- هرکدوم رو بزنی همون
                عکسِ «اصلی» (با تمام مشخصات) می‌شه، بقیه‌ی عکس‌ها فقط با تگِ
                گوشه ساخته و همه با هم دانلود می‌شن (کپشن هم خودکار کپی می‌شه) */}
            <div className="space-y-2">
              <span className="text-xs text-[var(--color-muted)]">عکس‌های محصول:</span>
              <div className="flex flex-wrap gap-3">
                {detail.images.map((img, idx) => (
                  <div key={img} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedImage(img)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        selectedImage === img ? "border-[var(--color-wine)]" : "border-transparent"
                      }`}
                      title="پیش‌نمایش این عکس به‌عنوان اصلی"
                    >
                      <Image src={img} alt="" width={64} height={64} className="object-cover" unoptimized />
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndDownloadAll(img)}
                      disabled={generatingAll}
                      className="text-[10px] font-medium text-white bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-full px-2.5 py-1 disabled:opacity-50"
                      title={idx === 0 ? "این عکس اصلی، بقیه فقط با تگ" : "این عکس اصلی شود"}
                    >
                      📷 اینستاگرام
                    </button>
                  </div>
                ))}
              </div>
              {generateStatus && (
                <p className="text-xs text-[var(--color-wine)] font-medium">{generateStatus}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={renderPoster}
                className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium"
              >
                ساخت پوستر (پیش‌نمایش)
              </button>
              <button
                onClick={downloadPoster}
                className="border cut-line px-5 py-2 rounded-full text-sm font-medium bg-white"
              >
                دانلود PNG (فقط همین عکس)
              </button>
            </div>
          </div>

          {/* کپشن و لینک */}
          <div className="space-y-4">
            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <label className="block text-sm font-bold">تگ (منحصربه‌فرد، قابل جستجو در تلگرام)</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
                dir="ltr"
              />
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold">کپشن اینستاگرام</label>
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">هشتگ‌های ساخته‌شده از محصول</span>
                <button
                  onClick={() => copyText(generatedHashtags.map((h) => `#${h}`).join(" "), "hashtags")}
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "hashtags" ? "کپی شد ✓" : "کپی هشتگ‌ها"}
                </button>
              </div>
              <p className="text-xs text-[var(--color-muted)] break-words leading-relaxed">
                {generatedHashtags.map((h) => `#${h}`).join(" ")}
              </p>
            </div>

            <div className="border cut-line rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">متن تلگرام (تگ + لینک)</span>
                <button
                  onClick={() => copyText(telegramNote, "telegram")}
                  className="text-xs text-[var(--color-wine)] hover:underline"
                >
                  {copied === "telegram" ? "کپی شد ✓" : "کپی متن تلگرام"}
                </button>
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
              <p className="text-xs text-[var(--color-muted)] break-all" dir="ltr">
                {detail.url}
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