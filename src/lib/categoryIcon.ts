// آیکون و رنگ تقریبی برای هر دسته‌بندی -- چون اسم دسته‌ها دستی و متغیره (نه از پیش مشخص)،
// از روی کلیدواژه‌های رایج فارسی حدس می‌زنیم؛ اگه چیزی مچ نشد یه آیکون عمومی برمی‌گردونیم
const RULES: { keywords: string[]; icon: string; color: string }[] = [
  { keywords: ["بچگانه", "کودک", "نوزاد"], icon: "🧒", color: "#fde68a" },
  { keywords: ["دخترانه"], icon: "👧", color: "#fbcfe8" },
  { keywords: ["پسرانه"], icon: "🧑", color: "#bfdbfe" },
  { keywords: ["زنانه", "بانوان"], icon: "👩", color: "#fbcfe8" },
  { keywords: ["مردانه", "آقایان"], icon: "🧔", color: "#bfdbfe" },
  { keywords: ["کفش"], icon: "👟", color: "#fed7aa" },
  { keywords: ["کیف", "چنته"], icon: "👜", color: "#e9d5ff" },
  { keywords: ["عطر", "ادکلن"], icon: "🌸", color: "#fbcfe8" },
  { keywords: ["آرایش", "بهداشت", "زیبایی"], icon: "💄", color: "#fecdd3" },
  { keywords: ["ورزش"], icon: "⚽", color: "#bbf7d0" },
  { keywords: ["الکترونیک", "موبایل", "لپ‌تاپ"], icon: "📱", color: "#c7d2fe" },
  { keywords: ["خانه", "آشپزخانه", "دکوراسیون"], icon: "🏠", color: "#fde68a" },
  { keywords: ["خودرو", "موتور", "روغن"], icon: "🚗", color: "#e5e7eb" },
  { keywords: ["کتاب", "تحریر", "لوازم‌التحریر"], icon: "📚", color: "#fed7aa" },
  { keywords: ["سوپرمارکت", "خوراکی", "غذا"], icon: "🛒", color: "#bbf7d0" },
  { keywords: ["جواهر", "اکسسوری", "زیورآلات"], icon: "💍", color: "#e9d5ff" },
  { keywords: ["پت", "حیوان"], icon: "🐾", color: "#fde68a" },
  { keywords: ["هدیه"], icon: "🎁", color: "#fecaca" },
  { keywords: ["سفر", "چمدان"], icon: "🧳", color: "#c7d2fe" },
];

const DEFAULT_ICON = { icon: "🏷️", color: "#e5e7eb" };

export function categoryIcon(name: string): { icon: string; color: string } {
  for (const rule of RULES) {
    if (rule.keywords.some((k) => name.includes(k))) {
      return { icon: rule.icon, color: rule.color };
    }
  }
  return DEFAULT_ICON;
}

// یه پالت آماده برای انتخاب دستی آیکون توی پنل ادمین (دسته‌بندی‌ها)
export const ICON_PALETTE = [
  "👩", "🧔", "🧑", "👧", "🧒", "👶",
  "👟", "👜", "🌸", "💄", "💍", "🧳",
  "⚽", "📱", "🏠", "🚗", "📚", "🛒",
  "🐾", "🎁", "👗", "🕶️", "⌚", "🧴",
  "🧦", "🧤", "🧢", "👔", "👖", "🩳",
  "💻", "🎮", "🍔", "🥗", "🧸", "🪑",
  "🛋️", "🚲", "✈️", "⛺", "🎨", "🏋️",
];
