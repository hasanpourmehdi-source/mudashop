// جنسیتِ محصول از دیتای خودِ صفحه‌ی ترندیول (ld+json: audience.suggestedGender، و
// فیلدهای gender/webGender توی state صفحه) -- برای محصولاتی که توی عنوان/مشخصاتشون
// هیچ کلمه‌ی جنسیتی نیست (مثلاً «Trendyolmilla Man ... Kazak»). خروجی یکی از
// GENDER_WORDS ی poster.ts یا null
export function genderFaFromTrendyolValue(raw: string): string | null {
  const v = raw.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
  if (!v) return null;
  if (/(erkek|male|boy).*(cocuk|çocuk|child|kid)|^boy/.test(v) && !v.includes("female")) return "پسرانه";
  if (/(kiz|kız|girl).*(cocuk|çocuk|child|kid)|^girl/.test(v)) return "دخترانه";
  if (/bebek|baby|infant/.test(v)) return "نوزادی";
  if (/cocuk|çocuk|child|kid/.test(v)) return "بچگانه";
  if (/unisex/.test(v)) return "یونیسکس";
  if (/female|kadin|kadın|woman|women/.test(v)) return "زنانه";
  if (/erkek|male|man\b/.test(v)) return "مردانه";
  return null;
}

export function extractGenderFaFromHtml(html: string): string | null {
  const patterns = [
    /"suggestedGender"\s*:\s*"([^"]+)"/,
    /"gender"\s*:\s*\{\s*"id"\s*:\s*\d+\s*,\s*"name"\s*:\s*"([^"]+)"/,
    /"gender"\s*:\s*"([^"]+)"/,
    /"webGender"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    const g = m ? genderFaFromTrendyolValue(m[1]) : null;
    if (g) return g;
  }
  return null;
}
