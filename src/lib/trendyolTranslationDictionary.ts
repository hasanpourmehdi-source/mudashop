import { prisma } from "@/lib/prisma";
import { translateTurkishPhrase } from "@/lib/trendyolTitleTranslation";
import { foldTurkish } from "@/lib/turkishText";

// این فایل قبلاً یه دیکشنری استاتیک ~۱۸۰۰ رکوردیِ جداگونه برای اسم
// دسته‌بندی/فیلتر بود -- طبق تصمیم صریح («ترجمه‌شده‌ها باید یه‌جا باشند»)، همه‌ی
// آن رکوردها یه‌بار به TrendyolTitleTermDictionary (همون دیکشنری مشترکی که
// عنوان محصولات ازش استفاده می‌کنه) منتقل شدن. از این به بعد این فایل فقط یه
// wrapper نازکه؛ خودِ suggestTranslation از همون یک دیکشنری مشترک می‌خونه --
// یعنی اگه یه کلمه رو هرجا (صفحه‌ی دیکشنری عنوان، دسته‌بندی، یا فیلتر) ترجمه
// کنی، همه‌جا همون لحظه در دسترس می‌شه.
//
// چون tokenizeAndTranslate کلمه‌به‌کلمه کار می‌کنه، اسم دسته‌بندی/مقدار فیلتر
// فقط وقتی «پیشنهاد» حساب می‌شه که *همه‌ی* کلمات آن عبارت شناخته‌شده باشن --
// وگرنه (طبق فلسفه‌ی همیشگی این پروژه) بهتره خالی بمونه تا نصفه‌ناقص/غلط باشه.
export async function suggestTranslation(nameTr: string): Promise<string | null> {
  const { translated, unknownTerms } = await translateTurkishPhrase(nameTr);
  if (unknownTerms.length > 0) return null;
  return translated;
}

// وقتی یه اصطلاح توی دیکشنری مشترک اضافه/ویرایش می‌شه (از هرکدوم از سه‌جا:
// دیکشنری عنوان، دسته‌بندی، یا فیلتر)، دو جور ردیفِ دیگرِ دسته‌بندی/فیلتر
// ممکنه نیاز به به‌روزرسانیِ همین لحظه داشته باشن، نه فقط سرِ sync بعدی:
//
// ۱. تطبیق دقیق -- مثلاً خودِ دیکشنری «bebek» عوض شده، و یه ردیف دسته‌بندیِ
//    دقیقاً به اسم «Bebek» هم هست. این‌جا معنایی نداره که ردیف دسته‌بندی
//    ترجمه‌ی متفاوتی از خودِ دیکشنری داشته باشه -- پس *همیشه* (حتی اگه قبلاً
//    ادمین دستی یه چیز دیگه زده بود) با معادل تازه‌ی دیکشنری هم‌سو می‌شه؛
//    وگرنه دقیقاً همون مشکلی پیش میاد که مهدی گزارش داد: «الان کلمه Bebek
//    چند جا ترجمه‌های مختلف داره؟» -- یعنی همون یه کلمه، دو منبع ترجمه‌ی جدا.
// ۲. تطبیق جزئی (این اصطلاح بخشی از یه عبارت طولانی‌تره، مثلاً «Bebek
//    Sabunları») -- این‌جا کل عبارت باید از نو کلمه‌به‌کلمه ترجمه بشه، ولی
//    فقط اگه ادمین قبلاً دستی روی این عبارتِ ترکیبی چیز دیگه‌ای تأیید نکرده
//    باشه (nameFaSuggested=true، یعنی هنوز پیشنهادی/تأییدنشده‌ست) -- تا یه
//    ترجمه‌ی ترکیبیِ عمداً دستی‌شده‌ی ادمین بی‌دلیل بازنویسی نشه.
export async function refreshUntranslatedRowsContaining(termTr: string, termFa: string): Promise<void> {
  if (!termTr) return;
  try {
    const categoryRows = await prisma.trendyolCategoryCache.findMany({
      select: { id: true, nameTr: true, nameFaSuggested: true },
    });
    for (const row of categoryRows) {
      const folded = foldTurkish(row.nameTr);
      if (folded === termTr) {
        await prisma.trendyolCategoryCache.update({
          where: { id: row.id },
          data: { nameFa: termFa, nameFaSuggested: true },
        });
      } else if (folded.includes(termTr) && row.nameFaSuggested) {
        const suggested = await suggestTranslation(row.nameTr);
        if (suggested !== null) {
          await prisma.trendyolCategoryCache.update({
            where: { id: row.id },
            data: { nameFa: suggested, nameFaSuggested: true },
          });
        }
      }
    }

    const filterRows = await prisma.trendyolFilterCache.findMany({
      select: { id: true, nameTr: true, nameFaSuggested: true },
    });
    for (const row of filterRows) {
      const folded = foldTurkish(row.nameTr);
      if (folded === termTr) {
        await prisma.trendyolFilterCache.update({
          where: { id: row.id },
          data: { nameFa: termFa, nameFaSuggested: true },
        });
      } else if (folded.includes(termTr) && row.nameFaSuggested) {
        const suggested = await suggestTranslation(row.nameTr);
        if (suggested !== null) {
          await prisma.trendyolFilterCache.update({
            where: { id: row.id },
            data: { nameFa: suggested, nameFaSuggested: true },
          });
        }
      }
    }
  } catch (err) {
    console.error("خطا در به‌روزرسانیِ ردیف‌های دسته‌بندی/فیلتر بعد از تغییر دیکشنری:", err);
  }
}
