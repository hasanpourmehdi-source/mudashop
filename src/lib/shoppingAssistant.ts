import { prisma } from "@/lib/prisma";
import { parseTrackingCodes } from "@/lib/trackingCodes";

// ================= دستیارِ خریدِ هوش‌مصنوعی =================
// جست‌وجوی ساده‌ی محصولاتِ کاتالوگِ مزون بر اساسِ کلیدواژه‌های پیامِ مشتری، به‌
// همراهِ یه پاسخِ متنی. اگه ANTHROPIC_API_KEY تنظیم شده باشه، همون پاسخ توسطِ
// مدلِ زبانی (با context محصولاتِ پیداشده) طبیعی‌تر نوشته می‌شه؛ وگرنه یه پاسخِ
// قاعده‌محورِ ساده (بدون هیچ وابستگیِ بیرونی) کار می‌کند -- دقیقاً همون الگوی
// «بدون کلید = fallback» که برای ایمیل/پیامک (outboundNotify.ts) استفاده شده.

const STOPWORDS = new Set(["و", "به", "از", "با", "برای", "در", "یا", "می", "خوام", "میخوام", "لطفا", "سلام"]);

function tokenize(text: string): string[] {
  return text
    .normalize("NFKC")
    .split(/[\s،,.!؟?]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export type AssistantProduct = {
  slug: string;
  title: string;
  basePrice: number;
  discount: number;
  image: string;
};

// جست‌وجوی کلیدواژه‌ایِ ساده روی عنوان/توضیح محصولاتِ فعال -- بدون هیچ زیرساختِ
// جست‌وجوی متنِ کاملِ اضافه (مطابق با مقیاسِ فعلیِ کاتالوگِ مزون)
export async function searchAssistantProducts(message: string, limit = 5): Promise<AssistantProduct[]> {
  const terms = tokenize(message);
  if (terms.length === 0) return [];

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: terms.flatMap((term) => [{ title: { contains: term } }, { description: { contains: term } }]),
    },
    select: { slug: true, title: true, basePrice: true, discount: true, images: true },
    take: limit,
  });

  return products.map((p) => {
    let image = "";
    try {
      const parsed = JSON.parse(p.images);
      image = Array.isArray(parsed) ? parsed[0] ?? "" : "";
    } catch {
      // بی‌اهمیت -- عکس خالی نمایش داده می‌شه
    }
    return { slug: p.slug, title: p.title, basePrice: p.basePrice, discount: p.discount, image };
  });
}

// پاسخِ قاعده‌محور -- بدون هیچ وابستگیِ بیرونی، همیشه کار می‌کند
export function buildFallbackReply(products: AssistantProduct[]): string {
  if (products.length === 0) {
    return "چیزی با این مشخصات پیدا نکردم. می‌تونی دقیق‌تر بگی دنبال چه نوع لباسی هستی (مثلاً رنگ، سایز یا نوع پوشاک)؟ یا از جستجوی بالای سایت هم می‌تونی توی محصولاتِ ترندیول جست‌وجو کنی.";
  }
  return `${products.length.toLocaleString("fa-IR")} مورد پیدا کردم که ممکنه دوست داشته باشی:`;
}

async function callClaude(message: string, products: AssistantProduct[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const productContext = products
    .map((p) => `- ${p.title} (${p.basePrice.toLocaleString("fa-IR")} تومان${p.discount > 0 ? `، ${p.discount}% تخفیف` : ""})`)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system:
          "تو دستیارِ خریدِ فروشگاهِ آنلاینِ مُداشاپی. فقط به فارسی و خیلی کوتاه (حداکثر ۳-۴ جمله) و دوستانه جواب بده. اگه محصولی زیر لیست شده، به همون‌ها اشاره کن (اسمشون رو دوباره کامل تکرار نکن چون جدا نمایش داده می‌شن) و توضیح کوتاه بده کدوم به نظرت مناسب‌تره. اگه لیست خالیه، فقط پیشنهاد بده که دقیق‌تر توضیح بدهد.",
        messages: [
          {
            role: "user",
            content: `پیامِ مشتری: «${message}»\n\nمحصولاتِ پیداشده:\n${productContext || "(هیچی پیدا نشد)"}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

// ================= پیگیریِ سفارش از توی چت =================
// کاملاً قاعده‌محور و بدونِ عبور از مدلِ زبانی -- این یه دادهٔ دقیقِ حساب‌داریِ
// مشتریه (وضعیت/کدِ رهگیری)، نه یه پیشنهادِ محصول؛ نباید دستِ یه مدلِ زبانی
// بیفته که ممکنه در بازنویسی چیزی رو اشتباه بگه یا قاطی کنه

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار پردازش",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  CANCELLED: "لغو شده",
  RETURNED: "مرجوع شده",
};

const ORDER_STATUS_SUBJECT_WORDS = ["سفارش", "خریدم", "بسته"];
const ORDER_STATUS_TRIGGER_WORDS = [
  "کجاست",
  "کجاس",
  "وضعیت",
  "پیگیری",
  "رسیده",
  "میرسه",
  "می‌رسه",
  "می رسه",
];

// تشخیصِ سبکِ کلیدواژه‌ای (همون سطحِ سادگیِ جست‌وجوی محصول بالا) -- نیازی به
// مدلِ زبانی یا لیستِ intent پیچیده نیست
export function isOrderStatusQuery(message: string): boolean {
  const normalized = message.normalize("NFKC");
  const hasSubject = ORDER_STATUS_SUBJECT_WORDS.some((w) => normalized.includes(w));
  const hasTrigger = ORDER_STATUS_TRIGGER_WORDS.some((w) => normalized.includes(w));
  return hasSubject && hasTrigger;
}

export type AssistantOrderLink = { id: string; label: string; href: string };

// سه سفارشِ اخیرِ کاربر رو با وضعیت/کدِ رهگیری خلاصه می‌کنه -- برای پاسخِ سریع
// توی چت، بدونِ نیاز به باز کردنِ صفحه‌ی سفارش‌ها
export async function fetchRecentOrdersSummary(
  userId: string
): Promise<{ text: string; orders: AssistantOrderLink[] }> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, status: true, trackingCode: true },
  });

  if (orders.length === 0) {
    return { text: "هنوز سفارشی از این حساب ثبت نشده.", orders: [] };
  }

  const lines = orders.map((o) => {
    const label = ORDER_STATUS_LABELS[o.status] ?? o.status;
    const codes = parseTrackingCodes(o.trackingCode);
    const trackingText = codes.length > 0 ? ` -- کدِ رهگیری: ${codes[0]}` : "";
    return `سفارش #${o.id.slice(-8)}: ${label}${trackingText}`;
  });

  return {
    text: lines.join("\n"),
    orders: orders.map((o) => ({ id: o.id, label: `#${o.id.slice(-8)}`, href: `/orders/${o.id}` })),
  };
}

export async function buildAssistantResponse(
  message: string,
  userId?: string
): Promise<{ reply: string; products: AssistantProduct[]; orders?: AssistantOrderLink[] }> {
  if (isOrderStatusQuery(message)) {
    if (!userId) {
      return {
        reply: "برای پیگیریِ سفارش، اول باید وارد حسابت بشی.",
        products: [],
      };
    }
    const { text, orders } = await fetchRecentOrdersSummary(userId);
    return { reply: text, products: [], orders };
  }

  const products = await searchAssistantProducts(message);
  const aiReply = await callClaude(message, products);
  return { reply: aiReply ?? buildFallbackReply(products), products };
}
