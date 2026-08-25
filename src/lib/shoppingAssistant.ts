import { prisma } from "@/lib/prisma";

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

export async function buildAssistantResponse(
  message: string
): Promise<{ reply: string; products: AssistantProduct[] }> {
  const products = await searchAssistantProducts(message);
  const aiReply = await callClaude(message, products);
  return { reply: aiReply ?? buildFallbackReply(products), products };
}
