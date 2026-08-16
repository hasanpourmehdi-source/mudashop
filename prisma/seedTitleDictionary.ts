import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// دیکشنری اولیه‌ی اصطلاحات پرتکرار مد ترکی -- بر اساس عنوان‌های واقعی که تا الان
// از ترندیول دیدیم (پیراهن، لباس مردانه/زنانه). این لیست کامل نیست؛ به‌مرور که
// عنوان‌های جدید ترجمه می‌شن، ادمین از پنل چیزهای جدید رو اضافه می‌کنه.
// عبارت‌های چندکلمه‌ای (priority بالاتر) قبل از تک‌کلمه‌ای‌های داخلشون امتحان می‌شن.
const TERMS: { termTr: string; termFa: string; priority?: number }[] = [
  // -- جنسیت / دسته‌ی کلی --
  { termTr: "erkek", termFa: "مردانه" },
  { termTr: "kadın", termFa: "زنانه" },
  { termTr: "kadin", termFa: "زنانه" },
  { termTr: "çocuk", termFa: "بچگانه" },
  { termTr: "unisex", termFa: "یونیسکس" },

  // -- انواع پوشاک --
  { termTr: "gömlek", termFa: "پیراهن" },
  { termTr: "tişört", termFa: "تی‌شرت" },
  { termTr: "t-shirt", termFa: "تی‌شرت" },
  { termTr: "pantolon", termFa: "شلوار" },
  { termTr: "kot pantolon", termFa: "شلوار جین", priority: 5 },
  { termTr: "şort", termFa: "شلوارک" },
  { termTr: "ceket", termFa: "کت" },
  { termTr: "mont", termFa: "بارانی" },
  { termTr: "kaban", termFa: "پالتو" },
  { termTr: "hırka", termFa: "ژاکت" },
  { termTr: "kazak", termFa: "پلیور" },
  { termTr: "sweatshirt", termFa: "سویشرت" },
  { termTr: "elbise", termFa: "پیراهن زنانه" },
  { termTr: "etek", termFa: "دامن" },
  { termTr: "atlet", termFa: "زیرپیراهنی" },
  { termTr: "yelek", termFa: "جلیقه" },
  { termTr: "eşofman", termFa: "گرمکن" },
  { termTr: "takım", termFa: "ست" },

  // -- فیت / برش --
  { termTr: "slim fit", termFa: "اسلیم‌فیت", priority: 5 },
  { termTr: "regular fit", termFa: "فیت معمولی", priority: 5 },
  { termTr: "oversize", termFa: "اورسایز" },
  { termTr: "yarım oversize", termFa: "نیمه‌اورسایز", priority: 5 },
  { termTr: "bol kalıp", termFa: "برش گشاد", priority: 5 },
  { termTr: "dar kalıp", termFa: "برش تنگ", priority: 5 },
  { termTr: "rahat kalıp", termFa: "برش راحت", priority: 5 },
  { termTr: "salaş", termFa: "گشاد و راحت" },
  { termTr: "kalıp", termFa: "برش" },

  // -- آستین / یقه --
  { termTr: "uzun kol", termFa: "آستین‌بلند", priority: 5 },
  { termTr: "uzun kollu", termFa: "آستین‌بلند", priority: 5 },
  { termTr: "kısa kol", termFa: "آستین‌کوتاه", priority: 5 },
  { termTr: "kısa kollu", termFa: "آستین‌کوتاه", priority: 5 },
  { termTr: "kolsuz", termFa: "بدون آستین" },
  { termTr: "kollu", termFa: "آستین‌دار" },
  { termTr: "kol", termFa: "آستین" },
  { termTr: "yaka", termFa: "یقه" },
  { termTr: "yakalı", termFa: "یقه‌دار" },
  { termTr: "polo yaka", termFa: "یقه‌پولو", priority: 5 },
  { termTr: "bisiklet yaka", termFa: "یقه‌گرد", priority: 5 },
  { termTr: "v yaka", termFa: "یقه‌هفت", priority: 5 },
  { termTr: "düğmeli yaka", termFa: "یقه‌دکمه‌دار", priority: 5 },
  { termTr: "düğmeli", termFa: "دکمه‌دار" },
  { termTr: "kravatlık", termFa: "مناسب کراوات" },

  // -- جنس / پارچه --
  { termTr: "pamuklu", termFa: "پنبه‌ای" },
  { termTr: "pamuk", termFa: "پنبه" },
  { termTr: "keten", termFa: "کتان" },
  { termTr: "keten görünümlü", termFa: "شبیه کتان", priority: 5 },
  { termTr: "müslin kumaş", termFa: "پارچه موسلین", priority: 5 },
  { termTr: "kumaş", termFa: "پارچه" },
  { termTr: "polyester", termFa: "پلی‌استر" },
  { termTr: "yünlü", termFa: "پشمی" },
  { termTr: "deri", termFa: "چرم" },
  { termTr: "dokulu", termFa: "بافت‌دار" },
  { termTr: "örme", termFa: "بافتنی" },

  // -- ویژگی‌های عملکردی --
  { termTr: "nefes alabilir", termFa: "قابل‌تنفس", priority: 5 },
  { termTr: "nefes alan", termFa: "قابل‌تنفس", priority: 5 },
  { termTr: "terletmeyen", termFa: "ضدعرق" },
  { termTr: "teri emen", termFa: "جاذب عرق", priority: 5 },
  { termTr: "kolay ütülenebilir", termFa: "به‌سختی چروک می‌شود", priority: 5 },
  { termTr: "kolay ütülenebilen", termFa: "به‌سختی چروک می‌شود", priority: 5 },
  { termTr: "ütü gerektirmeyen", termFa: "نیازی به اتو ندارد", priority: 5 },
  { termTr: "su geçirmez", termFa: "ضدآب", priority: 5 },
  { termTr: "rüzgarlık", termFa: "بادگیر" },

  // -- فصل --
  { termTr: "yazlık", termFa: "تابستانی" },
  { termTr: "kışlık", termFa: "زمستانی" },
  { termTr: "dört mevsim", termFa: "چهارفصل", priority: 5 },
  { termTr: "4 mevsim", termFa: "چهارفصل", priority: 5 },
  { termTr: "mevsim", termFa: "فصل" },

  // -- رنگ --
  { termTr: "siyah", termFa: "مشکی" },
  { termTr: "beyaz", termFa: "سفید" },
  { termTr: "lacivert", termFa: "سرمه‌ای" },
  { termTr: "gri", termFa: "خاکستری" },
  { termTr: "antrasit", termFa: "دودی" },
  { termTr: "kahve", termFa: "قهوه‌ای" },
  { termTr: "bej", termFa: "بژ" },
  { termTr: "kırmızı", termFa: "قرمز" },
  { termTr: "mavi", termFa: "آبی" },
  { termTr: "yeşil", termFa: "سبز" },
  { termTr: "sarı", termFa: "زرد" },
  { termTr: "pembe", termFa: "صورتی" },
  { termTr: "mor", termFa: "بنفش" },
  { termTr: "turuncu", termFa: "نارنجی" },
  { termTr: "bordo", termFa: "زرشکی" },
  { termTr: "krem", termFa: "کرم" },
  { termTr: "somon", termFa: "صورتی‌کم‌رنگ" },

  // -- طرح/الگو --
  { termTr: "çizgili", termFa: "راه‌راه" },
  { termTr: "dik çizgili", termFa: "راه‌راه عمودی", priority: 5 },
  { termTr: "desenli", termFa: "طرح‌دار" },
  { termTr: "düz", termFa: "ساده" },
  { termTr: "ekoseli", termFa: "چهارخانه" },

  // -- سایر اصطلاحات پرتکرار --
  { termTr: "modelleri", termFa: "مدل‌ها" },
  { termTr: "fiyatları", termFa: "قیمت‌ها" },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const term of TERMS) {
    const termTrNormalized = term.termTr.toLocaleLowerCase("tr-TR");
    const result = await prisma.trendyolTitleTermDictionary.upsert({
      where: { termTr: termTrNormalized },
      create: {
        termTr: termTrNormalized,
        termFa: term.termFa,
        priority: term.priority ?? 0,
      },
      update: {
        termFa: term.termFa,
        priority: term.priority ?? 0,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
  }
  console.log(`✅ دیکشنری seed شد: ${created} مورد جدید، ${updated} مورد آپدیت‌شده (مجموع ${TERMS.length}).`);
}

main()
  .catch((err) => {
    console.error("خطا در seed دیکشنری:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
