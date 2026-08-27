// نوع یکپارچه محصول که هم مزون و هم ترندیول رو پوشش می‌ده
export type UnifiedProduct = {
  id: string; // برای مزون: cuid ، برای ترندیول: "trendyol-<id>"
  source: "MAZON" | "TRENDYOL";
  slugOrId: string; // برای لینک به صفحه جزئیات -- ممکنه شاملِ اسلاگِ سئو هم باشه (مثلاً "928069663-...")
  // فقط وقتی slugOrId خودِ externalId خام نیست (مثلاً وقتی شاملِ اسلاگِ سئو هم
  // شده) پر می‌شه -- برای ویشلیست/سبد که به contentId خامِ ترندیول نیاز دارن،
  // نه به اسلاگِ کاملِ آدرس. وقتی خالیه، همون slugOrId به‌عنوان externalId خام
  // استفاده می‌شه (رفتار قبلی، برای محصولات دموی قدیمی)
  externalId?: string;
  title: string;
  brand?: string | null;
  price: number; // قیمت نهایی (با تخفیف اعمال‌شده) به تومان
  originalPrice: number;
  discount: number; // درصد
  image: string;
  images: string[];
  categorySlug?: string;
  categoryName?: string;
  description?: string;
  rating?: number;
  reviewCount?: number; // تعداد نظرات تاییدشده -- برای نمایش کنار ستاره امتیاز
  wishlistCount?: number; // تعداد کاربرانی که این محصول رو به علاقه‌مندی اضافه کردن
  viewCount24h?: number; // تعداد بازدید صفحه‌ی محصول در ۲۴ ساعت اخیر (فقط مزون)
  isLowestPrice10d?: boolean; // آیا قیمت فعلی کمترین قیمت ۱۰ روز اخیره؟ (فقط مزون)
  createdAt: string; // ISO date - برای مرتب‌سازی جدیدترین
  // فقط برای source=TRENDYOL: لینک کامل اصلی trendyol.com -- برای این‌که دکمه‌ی
  // علاقه‌مندی از صفحه‌ی wishlist هم بتونه (در صورت نیاز) دوباره اضافه کنه
  sourceUrl?: string;
  fastShipping?: boolean; // بج «ارسال فوری» -- فقط محصولات مزون معنی داره
  isReturnable?: boolean; // فقط محصولات مزون معنی داره -- undefined/true یعنی قابل‌مرجوع
  careInstructions?: string | null; // فقط مزون
  videoUrl?: string | null; // فقط مزون
  // مجموع موجودیِ همه‌ی ترکیب‌ها -- فقط مزون، چون موجودیِ واقعیِ ترندیول رو
  // نداریم (فیلدِ product_quantity خودِ ترندیول هم غیرقابل‌اعتماده، جزئیاتش
  // توی products/trendyol/[slug]/page.tsx توضیح داده شده)
  totalStock?: number;
  colorImages?: Record<string, string[]>; // مقدار رنگ -> عکس‌های اختصاصی همون رنگ (فقط مزون)
  flashSale?: {
    id: string;
    endsAt: string;
    stock: number;
    discountPercent: number;
  };
};
