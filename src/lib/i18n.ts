// پشتیبانی زبان (fa/en/tr) -- پایه‌ای و سبک: فقط متن‌های «فریم» سایت (هدر/فوتر
// و چند برچسب مشترک) ترجمه می‌شوند؛ محتوای کالاها و صفحات عمیق همچنان فارسی
// است. ترکی هم اضافه شده چون کاتالوگ ترندیول/میلا (منبع اصلی محصولات خارجی)
// ترکیه‌ای است. ساختار دیکشنری طوری است که می‌توان کلیدها را کم‌کم به صفحات
// دیگر هم گسترش داد.

export const LANGS = ["fa", "en", "tr"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "fa";
export const LANG_COOKIE = "mudashop_lang";

export function isLang(value: string | undefined | null): value is Lang {
  return (LANGS as readonly string[]).includes(value ?? "");
}

export const DICT = {
  mazon: { fa: "✦ موجود در مزون", en: "✦ In Mazon", tr: "✦ Mazon'da" },
  wallet: { fa: "کیف پول", en: "Wallet", tr: "Cüzdan" },
  myOrders: { fa: "سفارش‌های من", en: "My Orders", tr: "Siparişlerim" },
  adminPanel: { fa: "پنل ادمین", en: "Admin panel", tr: "Yönetici paneli" },
  messages: { fa: "پیام‌ها", en: "Messages", tr: "Mesajlar" },
  logout: { fa: "خروج", en: "Log out", tr: "Çıkış yap" },
  login: { fa: "ورود", en: "Log in", tr: "Giriş yap" },
  profile: { fa: "پروفایل", en: "Profile", tr: "Profil" },
  wishlist: { fa: "علاقه‌مندی‌ها", en: "Wishlist", tr: "Favorilerim" },
  cart: { fa: "سبد خرید", en: "Cart", tr: "Sepetim" },
  installApp: { fa: "نصب اپ", en: "Install app", tr: "Uygulamayı yükle" },
  installAppHint: {
    fa: "برای دسترسی سریع‌تر، اپ را روی صفحه‌ی اصلی نصب کن.",
    en: "Install the app on your home screen for faster access.",
    tr: "Daha hızlı erişim için uygulamayı ana ekranınıza yükleyin.",
  },
  installNow: { fa: "نصب", en: "Install", tr: "Yükle" },
  later: { fa: "بعداً", en: "Later", tr: "Daha sonra" },
  howToInstallTitle: { fa: "چطور نصب کنم؟", en: "How to install?", tr: "Nasıl yüklenir?" },
  aboutUs: { fa: "درباره مُداشاپ", en: "About Mudashop", tr: "Mudashop Hakkında" },
  account: { fa: "حساب کاربری", en: "My Account", tr: "Hesabım" },
  contactUs: { fa: "ارتباط با مُداشاپ", en: "Contact Mudashop", tr: "Mudashop İletişim" },
  myProfile: { fa: "پروفایل من", en: "My Profile", tr: "Profilim" },
  mazonProducts: { fa: "محصولات مزون", en: "Mazon products", tr: "Mazon ürünleri" },
  flashSale: { fa: "حراج فلش", en: "Flash sale", tr: "Flaş indirim" },
  social: { fa: "شبکه‌های اجتماعی", en: "Social media", tr: "Sosyal medya" },
  copyright: { fa: "همه حقوق محفوظ است", en: "All rights reserved", tr: "Tüm hakları saklıdır" },
  close: { fa: "بستن", en: "Close", tr: "Kapat" },
  offlineRetry: { fa: "تلاش دوباره", en: "Retry", tr: "Yeniden dene" },
  language: { fa: "زبان", en: "Language", tr: "Dil" },
} as const satisfies Record<string, Record<Lang, string>>;

export type I18nKey = keyof typeof DICT;

// ترجمه‌ی یک کلید به زبان خواسته‌شده -- خالص و قابل تست
export function t(lang: Lang, key: I18nKey): string {
  return DICT[key][lang];
}

// خواندن زبان از کوکی/پارامتر با سقوط به پیش‌فرض
export function resolveLang(value: string | undefined | null): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}