import { prisma } from "@/lib/prisma";

// متن‌های عمومی سایت که ادمین از پنل می‌تونه ویرایش کنه -- برای هرکدوم یه کلید ثابت
// و یه مقدار پیش‌فرض تعریف می‌کنیم؛ اگه هنوز توی دیتابیس ذخیره نشده باشه، همون پیش‌فرض برمی‌گرده
export const SITE_SETTING_KEYS = {
  RETURN_POLICY_TEXT: "returnPolicyText",
  // مراحلِ قابلِ خاموش‌کردنِ چرخه‌ی سفارش -- "true"/"false" (پیش‌فرض false یعنی
  // رفتارِ فعلی دست‌نخورده می‌مونه، مگر ادمین صراحتاً از تنظیمات روشنش کنه)
  //  - SKIP_ADMIN_REVIEW: سفارش بدونِ بررسیِ دستیِ ادمین، همون لحظه‌ی ثبت،
  //    مستقیم برای پرداخت به کارتِ پیش‌فرض (BankCard.isDefault) آماده می‌شه
  //  - SKIP_PAYMENT_VERIFICATION: به‌محضِ آپلودِ فیش (دورِ اول یا دوم)، خودِ
  //    سیستم PAID می‌کنه، بدونِ منتظرِ کلیکِ تأییدِ ادمین
  //  - SKIP_SHIPPING_CALCULATION: هزینه‌ی ارسال (سفارشِ مزون) و باربری
  //    (سفارشِ خارجی) همیشه صفر حساب می‌شه -- چون قبلاً توی قیمتِ کالا لحاظ شده
  SKIP_ADMIN_REVIEW: "skipAdminReview",
  SKIP_PAYMENT_VERIFICATION: "skipPaymentVerification",
  SKIP_SHIPPING_CALCULATION: "skipShippingCalculation",
  // هشدارِ موجودیِ کم -- پیش‌فرض خاموش (اختیاری، فقط اگه ادمین بخواد)؛ وقتی
  // روشنه، به‌ازای هر ترکیبی که موجودیش بین ۱ تا آستانه باشه، ادمین مطلع می‌شه
  LOW_STOCK_ALERT_ENABLED: "lowStockAlertEnabled",
  LOW_STOCK_ALERT_THRESHOLD: "lowStockAlertThreshold",
  // آستانه‌های هشدار سفارش‌های گیرکرده (به ساعت) -- هر مرحله دو آستانه دارد:
  // «نیمه‌هشدار» (زرد) و «هشدار» (قرمز)، برای داشبورد ادمین
  ALERT_FIRST_REVIEW_WARN_H: "alertFirstReviewWarnHours",
  ALERT_FIRST_REVIEW_ALERT_H: "alertFirstReviewAlertHours",
  ALERT_ITEM_PAYMENT_REVIEW_WARN_H: "alertItemPaymentReviewWarnHours",
  ALERT_ITEM_PAYMENT_REVIEW_ALERT_H: "alertItemPaymentReviewAlertHours",
  ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H: "alertShippingPaymentReviewWarnHours",
  ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H: "alertShippingPaymentReviewAlertHours",
  ALERT_AWAITING_PURCHASE_WARN_H: "alertAwaitingPurchaseWarnHours",
  ALERT_AWAITING_PURCHASE_ALERT_H: "alertAwaitingPurchaseAlertHours",
  ALERT_ADMIN_ITEMS_REVIEW_WARN_H: "alertAdminItemsReviewWarnHours",
  ALERT_ADMIN_ITEMS_REVIEW_ALERT_H: "alertAdminItemsReviewAlertHours",
  ALERT_SHIPPED_TOO_LONG_WARN_H: "alertShippedTooLongWarnHours",
  ALERT_SHIPPED_TOO_LONG_ALERT_H: "alertShippedTooLongAlertHours",
  ALERT_RETURN_REVIEW_WARN_H: "alertReturnReviewWarnHours",
  ALERT_RETURN_REVIEW_ALERT_H: "alertReturnReviewAlertHours",
  // آخرین نرخ باربری (تومان به ازای هر کیلوگرم) که ادمین وارد کرده -- فقط
  // به‌عنوان مقدار پیش‌فرضِ فرم بعدی استفاده می‌شه، نه یه قانون قطعی/مخفی؛
  // همیشه توی فرم دیده و قابل‌ویرایشه چون یه پارامتر مالی واقعیه که عوض می‌شه
  CARGO_RATE_PER_KG: "cargoRatePerKg",
  // بعد از چند ساعت بی‌حرکتی توی هر مرحله، یه پیام دلگرم‌کننده‌ی خودکار برای
  // مشتری ثبت بشه («هنوز در جریانه»)
  REASSURANCE_PING_AFTER_H: "reassurancePingAfterHours",
  // مهلت پرداخت: از زمان ورود سفارش به «در انتظار پرداخت/تأیید فیش» این ساعت
  // بعد اگر مشتری هنوز واریز نکرده باشد، سفارش به‌صورت خودکار لغو می‌شود
  PAYMENT_DEADLINE_H: "paymentDeadlineHours",
  // دنباله‌ی یادآوریِ سبدِ رهاشده -- سه مرحله: STAGE1 (یادآوریِ نرم)، STAGE2
  // (یادآوریِ فوریت/موجودی)، STAGE3 (دیگه به مشتری پیام نمی‌ره -- به ادمین
  // اطلاع داده می‌شه که موقعِ تصمیم برای کد تخفیفه). همه بر اساسِ ساعت از
  // آخرین تغییرِ سبد
  ABANDONED_CART_AFTER_H: "abandonedCartAfterHours",
  ABANDONED_CART_STAGE2_H: "abandonedCartStage2Hours",
  ABANDONED_CART_STAGE3_H: "abandonedCartStage3Hours",
  // پاداش کد معرفی -- وقتی اولین سفارشِ پرداخت‌شده‌ی کاربر معرفی‌شده ثبت شود، این مبلغ (تومان) به کیف‌پول معرف اضافه می‌شود
  REFERRAL_REWARD_AMOUNT: "referralRewardAmount",
  // متنِ باکسِ بنفشِ «نرخ ارز روزانه...» روی پوسترِ اینستاگرام -- چند خط با \n جدا می‌شن
  POSTER_CURRENCY_TEXT: "posterCurrencyText",
  // تخفیفِ خیلی ناچیز (مثلاً ۱٪) روی هیچ‌جای سایت/پوستر نشون داده نمی‌شه --
  // فقط قیمتِ خط‌خورده (بدونِ عدد) می‌مونه، طبقِ درخواستِ صریح («۱٪ مسخره‌ست»)
  MIN_DISCOUNT_PERCENT_TO_SHOW: "minDiscountPercentToShow",
  // بخشِ «پیشنهاد برای پوسترِ بعدی» ته‌ی صفحه‌ی پوستر اینستاگرام -- محصولی که
  // تخفیفش (یا تخفیفِ کمپینِ سبدخرید) به این درصد برسه، یا کمپینِ برجسته
  // داشته باشه، پیشنهاد می‌شه؛ فقط تا این تعداد نشون داده می‌شه
  POSTER_SUGGESTIONS_MIN_DISCOUNT_PERCENT: "posterSuggestionsMinDiscountPercent",
  POSTER_SUGGESTIONS_MAX_COUNT: "posterSuggestionsMaxCount",
  // نشانه‌ی اجتماعیِ لحظه‌ای روی صفحه‌ی محصول («N نفر همین چند دقیقه‌ی اخیر این
  // محصول رو دیدن») -- بازه‌ی زمانی و حداقلِ تعداد برای نمایش، هردو قابل‌تنظیم
  SOCIAL_PROOF_WINDOW_MINUTES: "socialProofWindowMinutes",
  SOCIAL_PROOF_MIN_COUNT: "socialProofMinCount",
  // چندتا محصول حداکثر توی بخشِ «این محصول رو خریدن، این‌ها رو هم خریدن» نشون داده بشه
  CROSS_SELL_MAX_ITEMS: "crossSellMaxItems",
  // دکمه‌ی سریعِ تماس (واتس‌اپ/تلگرام) کنارِ چتِ زنده -- خالی یعنی همون دکمه
  // نشون داده نمی‌شه. شماره باید فرمتِ بین‌المللیِ بدونِ + باشه (مثلِ wa.me)
  SUPPORT_WHATSAPP_NUMBER: "supportWhatsappNumber",
  SUPPORT_TELEGRAM_USERNAME: "supportTelegramUsername",
  // صفحه‌های اطلاعاتی/قانونی -- هر کدوم توی یه صفحه‌ی مستقل نشون داده می‌شن
  // (/about، /terms، /privacy، /faq) و از پنل ادمین قابل‌ویرایش‌اند
  ABOUT_TEXT: "aboutText",
  TERMS_TEXT: "termsText",
  PRIVACY_TEXT: "privacyText",
  FAQ_TEXT: "faqText",
  // پرداخت در محل -- سراسری خاموش/روشن؛ وقتی روشنه، مشتری موقع چک‌اوت می‌تونه
  // به‌جای کارت‌به‌کارت، «پرداخت نقدی موقع تحویل» رو انتخاب کنه
  CASH_ON_DELIVERY_ENABLED: "cashOnDeliveryEnabled",
  // غیرقابل‌بازگشت‌بودنِ بعضی محصولات -- سراسری خاموش/روشن؛ وقتی خاموشه، فلگِ
  // Product.isReturnable نادیده گرفته می‌شه و همه‌چیز طبق رفتار قبلی قابل‌مرجوعه
  NON_RETURNABLE_PRODUCTS_ENABLED: "nonReturnableProductsEnabled",
  // این یکی برایِ خودِ فرآیندِ مرجوعیه (نه مرجوع‌پذیرِ کدوم محصول -- اون یکی
  // بالاتره): وقتی روشنه (پیش‌فرض، رفتارِ فعلی)، مشتری از صفحه‌ی سفارش خودش
  // می‌تونه درخواستِ مرجوعی ثبت کنه؛ وقتی خاموشه، به‌جاش پیامِ «برای مرجوعی با
  // پشتیبانی تماس بگیرید» نشون داده می‌شه و مرجوعی کاملاً دستی/تلفنی می‌شه
  SELF_SERVICE_RETURN_ENABLED: "selfServiceReturnEnabled",
  // حالتِ «فقط-نمایش» -- فروشِ کلِ سایت موقتاً متوقفه: محصولات/صفحات عادی
  // دیده می‌شن، ولی نه دکمه‌ی افزودن‌به‌سبد/خریدِ فوری نشون داده می‌شه نه
  // ثبتِ سفارش ممکنه (چه از UI چه مستقیم API -- سدِ واقعی توی POST
  // /api/orders هست، UI فقط نمایشیه). پیام‌اش هم قابل‌ویرایشه (مثلاً دلیل
  // تعطیلیِ موقت یا زمانِ برگشت)
  SALES_PAUSED_ENABLED: "salesPausedEnabled",
  SALES_PAUSED_MESSAGE: "salesPausedMessage",
  // شفافیتِ هزینه/زمانِ ارسال کنارِ دکمه‌ی «افزودن به سبد» (نه فقط توی چک‌اوت) --
  // برای مزون عددِ واقعی (هزینه‌ی ثابت + آستانه‌ی رایگان + بازه‌ی روزِ تحویل)
  // نشون داده می‌شه؛ برای ترندیول چون هزینه‌ی باربری قبل از خرید معلوم نیست،
  // به‌جاش توضیحِ صادقانه + بازه‌ی تقریبیِ رسیدن نشون داده می‌شه
  SHIPPING_INFO_ENABLED: "shippingInfoEnabled",
  // نوارِ بج‌های اعتماد (پایینِ همه‌ی صفحات) -- ۴ بج ثابت، هرکدوم جدا
  // روشن/خاموش می‌شه و متنش دلخواهِ ادمینه
  TRUST_BADGE_1_ENABLED: "trustBadge1Enabled",
  TRUST_BADGE_1_TEXT: "trustBadge1Text",
  TRUST_BADGE_2_ENABLED: "trustBadge2Enabled",
  TRUST_BADGE_2_TEXT: "trustBadge2Text",
  TRUST_BADGE_3_ENABLED: "trustBadge3Enabled",
  TRUST_BADGE_3_TEXT: "trustBadge3Text",
  TRUST_BADGE_4_ENABLED: "trustBadge4Enabled",
  TRUST_BADGE_4_TEXT: "trustBadge4Text",
  // فلگ‌های «امکانات فروشگاه» -- هر قابلیتِ اختیاری (نه زیرساختِ اصلیِ
  // سفارش/پرداخت) از پنل ادمین جدا روشن/خاموش می‌شه؛ پیش‌فرضِ همه true یعنی
  // رفتارِ فعلیِ سایت دست‌نخورده می‌مونه مگر ادمین صراحتاً خاموشش کنه
  FEATURE_RECOMMENDED: "featureRecommendedEnabled",
  FEATURE_PERSONAL_CATEGORIES: "featurePersonalCategoriesEnabled",
  FEATURE_PHOTO_REVIEWS: "featurePhotoReviewsEnabled",
  FEATURE_VIDEO_WALL: "featureVideoWallEnabled",
  FEATURE_BRAND_CAMPAIGNS: "featureBrandCampaignsEnabled",
  FEATURE_TRENDYOL_CAMPAIGNS: "featureTrendyolCampaignsEnabled",
  FEATURE_TRENDYOL_TOP_DISCOUNTS: "featureTrendyolTopDiscountsEnabled",
  FEATURE_TRENDYOL_PRICE_DROPS: "featureTrendyolPriceDropsEnabled",
  FEATURE_TRENDYOL_BEST_SELLING: "featureTrendyolBestSellingEnabled",
  FEATURE_RECENTLY_VIEWED: "featureRecentlyViewedEnabled",
  FEATURE_DISCOVERABLE_TABS: "featureDiscoverableTabsEnabled",
  FEATURE_DISCOUNT_DISCOVERY: "featureDiscountDiscoveryEnabled",
  FEATURE_QUICK_VIEW: "featureQuickViewEnabled",
  FEATURE_SIZE_MEASUREMENTS: "featureSizeMeasurementsEnabled",
  FEATURE_PRODUCT_REVIEWS: "featureProductReviewsEnabled",
  FEATURE_PRODUCT_QA: "featureProductQaEnabled",
  FEATURE_SHOPPING_ASSISTANT: "featureShoppingAssistantEnabled",
  FEATURE_SUPPORT_CHAT: "featureSupportChatEnabled",
  FEATURE_COMPARE: "featureCompareEnabled",
  FEATURE_REVIEW_NUDGE: "featureReviewNudgeEnabled",
  FEATURE_DEFECTIVE_ITEMS: "featureDefectiveItemsEnabled",
  FEATURE_OCCASION_COLLECTIONS: "featureOccasionCollectionsEnabled",
  FEATURE_CHEAPER_PRICE_REPORT: "featureCheaperPriceReportEnabled",
  // بخشِ «این محصول رو خریدن، این‌ها رو هم خریدن» -- بر اساسِ هم‌خریدیِ واقعی
  // توی سفارش‌های پرداخت‌شده (نه چیزِ دستی/فرضی)، هم برای محصولاتِ مزون هم
  // ترندیول/میلا -- روی صفحه‌ی محصول
  FEATURE_FREQUENTLY_BOUGHT_TOGETHER: "featureFrequentlyBoughtTogetherEnabled",
  // کسراژِ وفاداری -- موتورِ اصلی از قبل توی giftCard.ts/loyaltyTier.ts پیاده‌سازی
  // شده (بعد از تحویلِ کاملِ سفارش، درصدی از مبلغ به کیفِ پول اضافه می‌شه)، این
  // کلیدها فقط پارامترهاش رو از هاردکد به تنظیماتِ قابل‌ویرایشِ ادمین می‌برن
  LOYALTY_CASHBACK_ENABLED: "loyaltyCashbackEnabled",
  LOYALTY_CASHBACK_PERCENT: "loyaltyCashbackPercent",
  LOYALTY_TOMAN_PER_POINT: "loyaltyTomanPerPoint",
  LOYALTY_SILVER_MIN_POINTS: "loyaltySilverMinPoints",
  LOYALTY_SILVER_BONUS_PERCENT: "loyaltySilverBonusPercent",
  LOYALTY_GOLD_MIN_POINTS: "loyaltyGoldMinPoints",
  LOYALTY_GOLD_BONUS_PERCENT: "loyaltyGoldBonusPercent",
  // مزیتِ باشگاه مشتریان -- ارسالِ رایگانِ نامحدود برای سطوحِ بالاتر (فقط
  // سفارش‌های بدونِ کالای خارجی؛ باربریِ کالای خارجی دستی و جداست)
  LOYALTY_SILVER_FREE_SHIPPING: "loyaltySilverFreeShipping",
  LOYALTY_GOLD_FREE_SHIPPING: "loyaltyGoldFreeShipping",
  // پرووایدرِ ارسالِ ایمیل -- "resend" (پیش‌فرض، از API کلیدِ زیر استفاده می‌کنه)
  // یا "smtp" (برای وصل‌کردنِ جیمیل یا هر سرورِ SMTPِ دیگه، با هاست/پورت/یوزر/پس)
  EMAIL_PROVIDER: "emailProvider",
  // اگه پر باشه، اولویت با این‌هاست؛ وگرنه رفتارِ فعلی (env varهای
  // RESEND_API_KEY/RESEND_FROM) دست‌نخورده می‌مونه. آدرسِ فرستنده بینِ هر دو
  // پرووایدر (Resend/SMTP) مشترکه
  EMAIL_PROVIDER_API_KEY: "emailProviderApiKey",
  EMAIL_PROVIDER_FROM_ADDRESS: "emailProviderFromAddress",
  // برای جیمیل: هاست smtp.gmail.com، پورت 587، رمز باید «رمزِ اپلیکیشن» (App
  // Password) باشه، نه رمزِ عبورِ خودِ اکانت -- گوگل ورودِ SMTP با رمزِ معمولی رو
  // مسدود کرده مگر این‌که ۲مرحله‌ای روشن و از App Password استفاده بشه
  SMTP_HOST: "smtpHost",
  SMTP_PORT: "smtpPort",
  SMTP_SECURE: "smtpSecure",
  SMTP_USER: "smtpUser",
  SMTP_PASSWORD: "smtpPassword",
} as const;

export const SITE_SETTING_DEFAULTS: Record<string, string> = {
  [SITE_SETTING_KEYS.RETURN_POLICY_TEXT]:
    "درخواست مرجوع کردن کالا با دلایل انصراف از خرید تنها در صورتی مورد قبول است که کالا در شرایط اولیه باشد و در صورت پلمپ شدن، پلمپ نباید باز شده باشد — تا ۷ روز از تحویل سفارش.",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_WARN_H]: "3",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_ALERT_H]: "7",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_WARN_H]: "30",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_ALERT_H]: "50",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_WARN_H]: "90",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_ALERT_H]: "130",
  [SITE_SETTING_KEYS.SKIP_ADMIN_REVIEW]: "false",
  [SITE_SETTING_KEYS.SKIP_PAYMENT_VERIFICATION]: "false",
  [SITE_SETTING_KEYS.SKIP_SHIPPING_CALCULATION]: "false",
  [SITE_SETTING_KEYS.LOW_STOCK_ALERT_ENABLED]: "false",
  [SITE_SETTING_KEYS.LOW_STOCK_ALERT_THRESHOLD]: "5",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_WARN_H]: "30",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_ALERT_H]: "50",
  [SITE_SETTING_KEYS.CARGO_RATE_PER_KG]: "0",
  [SITE_SETTING_KEYS.REASSURANCE_PING_AFTER_H]: "48",
  [SITE_SETTING_KEYS.PAYMENT_DEADLINE_H]: "48",
  [SITE_SETTING_KEYS.ABANDONED_CART_AFTER_H]: "24",
  [SITE_SETTING_KEYS.ABANDONED_CART_STAGE2_H]: "72",
  [SITE_SETTING_KEYS.ABANDONED_CART_STAGE3_H]: "168",
  [SITE_SETTING_KEYS.REFERRAL_REWARD_AMOUNT]: "50000",
  [SITE_SETTING_KEYS.POSTER_CURRENCY_TEXT]: "نرخ ارز روزانه و\nهزینه ارسال هوایی",
  [SITE_SETTING_KEYS.MIN_DISCOUNT_PERCENT_TO_SHOW]: "2",
  [SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MIN_DISCOUNT_PERCENT]: "50",
  [SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MAX_COUNT]: "6",
  [SITE_SETTING_KEYS.SOCIAL_PROOF_WINDOW_MINUTES]: "10",
  [SITE_SETTING_KEYS.SOCIAL_PROOF_MIN_COUNT]: "2",
  [SITE_SETTING_KEYS.CROSS_SELL_MAX_ITEMS]: "4",
  [SITE_SETTING_KEYS.ABOUT_TEXT]:
    "مُداشاپ فروشگاه آنلاین پوشاک و مد است. علاوه بر محصولات اختصاصی خودمان (مزون)، امکان سفارش مستقیم از کاتالوگ ترندیول و میلا را هم فراهم کرده‌ایم؛ یعنی می‌توانید بدون دردسر گمرک و واسطه، محصولات این دو سایت را هم از همین‌جا سفارش دهید.\n\nتیم ما هر سفارش خارجی را به‌صورت دستی و با دقت پیگیری می‌کند تا کالای درست، با کیفیت درست، به دستتان برسد.",
  [SITE_SETTING_KEYS.TERMS_TEXT]:
    "۱. ثبت سفارش در مُداشاپ به معنای پذیرش این قوانین است.\n۲. پرداخت به‌صورت کارت‌به‌کارت انجام می‌شود؛ بعد از واریز، تصویر رسید را در همان صفحه‌ی سفارش بارگذاری کنید تا ادمین بررسی کند.\n۳. برای کالاهای خارجی (ترندیول/میلا)، هزینه‌ی ارسال/باربری واقعی معمولاً بعد از خرید و وزن‌کشی نهایی مشخص می‌شود.\n۴. در صورت نبود کالا یا مغایرت (سایز/رنگ اشتباه، آسیب در حمل)، مطابق «قوانین مرجوعی» مبلغ به کیف پول شما بازگردانده می‌شود.\n۵. مُداشاپ حق دارد در صورت مغایرت آشکار قیمت (خطای فنی) سفارش را قبل از پرداخت لغو و اطلاع‌رسانی کند.",
  [SITE_SETTING_KEYS.PRIVACY_TEXT]:
    "مُداشاپ اطلاعات هویتی (نام، آدرس، شماره تماس) و اطلاعات سفارش شما را فقط برای پردازش و ارسال سفارش، و اطلاع‌رسانی درباره‌ی وضعیت آن استفاده می‌کند.\n\nاین اطلاعات با هیچ شخص ثالثی جز آنچه برای ارسال کالا (شرکت‌های پستی/باربری) لازم است، به اشتراک گذاشته نمی‌شود. رمز عبور حساب شما به‌صورت هش‌شده ذخیره می‌شود و حتی تیم مُداشاپ هم به آن دسترسی ندارد.\n\nدر صورت تمایل به حذف کامل اطلاعات حساب خود، از طریق پشتیبانی با ما در ارتباط باشید.",
  [SITE_SETTING_KEYS.FAQ_TEXT]:
    "س: چطور پرداخت کنم؟\nج: بعد از ثبت سفارش، شماره کارت نمایش داده می‌شود؛ واریز کنید و تصویر رسید را در همان صفحه بارگذاری کنید.\n\nس: خریدهای ترندیول/میلا چقدر طول می‌کشد؟\nج: چون این کالاها بعد از سفارش شما از سایت اصلی خریداری می‌شوند، معمولاً کمی بیشتر از کالاهای مزون طول می‌کشد؛ وضعیت دقیق را در صفحه‌ی سفارش می‌بینید.\n\nس: اگر سایز/رنگ اشتباه بود چه؟\nج: طبق «قوانین مرجوعی»، هزینه‌ی کالا به کیف پول شما بازگردانده می‌شود.\n\nس: کیف پول برای چیست؟\nج: مبلغ رفاندهای شما (لغو، مرجوعی، پاداش معرفی و...) به کیف پول واریز می‌شود و می‌توانید در خریدهای بعدی از آن استفاده کنید یا درخواست برداشت بدهید.",
  [SITE_SETTING_KEYS.CASH_ON_DELIVERY_ENABLED]: "false",
  [SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED]: "false",
  // پیش‌فرض روشن -- رفتارِ فعلی (فرمِ درخواستِ مرجوعیِ خودخدمت) دست‌نخورده می‌مونه
  [SITE_SETTING_KEYS.SELF_SERVICE_RETURN_ENABLED]: "true",
  // پیش‌فرض روشن -- شفافیتِ هزینه/زمانِ ارسال کنارِ دکمه‌ی خرید نشون داده بشه
  [SITE_SETTING_KEYS.SHIPPING_INFO_ENABLED]: "true",
  // پیش‌فرض خاموش -- رفتارِ فعلی (فروش فعال) دست‌نخورده می‌مونه
  [SITE_SETTING_KEYS.SALES_PAUSED_ENABLED]: "false",
  [SITE_SETTING_KEYS.SALES_PAUSED_MESSAGE]:
    "فروش سایت موقتاً متوقف شده است. می‌توانید محصولات را مشاهده کنید؛ برای اطلاعات بیشتر با پشتیبانی در تماس باشید.",
  [SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT]: "ضمانت اصالت کالا",
  [SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT]: "ارسال سریع و مطمئن",
  [SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT]: "۷ روز فرصت بازگشت کالا",
  [SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT]: "ضمانت بازگشت وجه",
  [SITE_SETTING_KEYS.FEATURE_RECOMMENDED]: "true",
  [SITE_SETTING_KEYS.FEATURE_PERSONAL_CATEGORIES]: "true",
  [SITE_SETTING_KEYS.FEATURE_PHOTO_REVIEWS]: "true",
  [SITE_SETTING_KEYS.FEATURE_VIDEO_WALL]: "true",
  [SITE_SETTING_KEYS.FEATURE_BRAND_CAMPAIGNS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_TOP_DISCOUNTS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_PRICE_DROPS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_BEST_SELLING]: "true",
  [SITE_SETTING_KEYS.FEATURE_RECENTLY_VIEWED]: "true",
  [SITE_SETTING_KEYS.FEATURE_DISCOVERABLE_TABS]: "true",
  [SITE_SETTING_KEYS.FEATURE_DISCOUNT_DISCOVERY]: "true",
  [SITE_SETTING_KEYS.FEATURE_QUICK_VIEW]: "true",
  [SITE_SETTING_KEYS.FEATURE_SIZE_MEASUREMENTS]: "true",
  [SITE_SETTING_KEYS.FEATURE_PRODUCT_REVIEWS]: "true",
  [SITE_SETTING_KEYS.FEATURE_PRODUCT_QA]: "true",
  [SITE_SETTING_KEYS.FEATURE_SHOPPING_ASSISTANT]: "true",
  [SITE_SETTING_KEYS.FEATURE_SUPPORT_CHAT]: "true",
  [SITE_SETTING_KEYS.FEATURE_COMPARE]: "true",
  [SITE_SETTING_KEYS.FEATURE_REVIEW_NUDGE]: "true",
  [SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS]: "true",
  [SITE_SETTING_KEYS.FEATURE_OCCASION_COLLECTIONS]: "true",
  [SITE_SETTING_KEYS.FEATURE_CHEAPER_PRICE_REPORT]: "true",
  [SITE_SETTING_KEYS.FEATURE_FREQUENTLY_BOUGHT_TOGETHER]: "true",
  // این مقادیر دقیقاً همون پیش‌فرض‌هایی‌ان که قبلاً هاردکد بودن -- یعنی اضافه‌شدنِ
  // این تنظیمات، رفتارِ فعلیِ زنده‌ی قابلیتِ کسراژِ وفاداری رو دست‌نخورده نگه می‌داره
  [SITE_SETTING_KEYS.LOYALTY_CASHBACK_ENABLED]: "true",
  [SITE_SETTING_KEYS.LOYALTY_CASHBACK_PERCENT]: "2",
  [SITE_SETTING_KEYS.LOYALTY_TOMAN_PER_POINT]: "10000",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_MIN_POINTS]: "500",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_BONUS_PERCENT]: "1",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_MIN_POINTS]: "2000",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_BONUS_PERCENT]: "2",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_FREE_SHIPPING]: "false",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_FREE_SHIPPING]: "false",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER]: "resend",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER_API_KEY]: "",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER_FROM_ADDRESS]: "",
  [SITE_SETTING_KEYS.SMTP_HOST]: "",
  [SITE_SETTING_KEYS.SMTP_PORT]: "587",
  [SITE_SETTING_KEYS.SMTP_SECURE]: "false",
  [SITE_SETTING_KEYS.SMTP_USER]: "",
  [SITE_SETTING_KEYS.SMTP_PASSWORD]: "",
};

export async function getSiteSetting(key: string): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? SITE_SETTING_DEFAULTS[key] ?? "";
}

export async function getSiteSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = map.get(key) ?? SITE_SETTING_DEFAULTS[key] ?? "";
  }
  return result;
}

export async function getSiteSettingBool(key: string): Promise<boolean> {
  return (await getSiteSetting(key)) === "true";
}

// نوارِ بج‌های اعتماد -- ۴ بج ثابت (آیکنِ هرکدوم ثابته)، هرکدوم جدا از تنظیمات
// روشن/خاموش می‌شه و متنش دلخواهِ ادمینه. قبلاً فقط توی layout.tsx (فوتر) بود؛
// این‌جا استخراج شده تا صفحه‌ی محصول/چک‌اوت هم بتونن همون بج‌ها رو (بدونِ
// تعریفِ دوباره‌ی منطق) نزدیکِ دکمه‌ی خرید نشون بدن -- طبقِ درخواستِ صریح،
// چون فوتر معمولاً دیده نمی‌شه/اسکرول‌نشده می‌مونه
export async function fetchTrustBadges(): Promise<{ icon: string; text: string }[]> {
  const settings = await getSiteSettings([
    SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT,
  ]);
  const TRUST_BADGE_ICONS = ["🛡️", "🚚", "↩️", "💰"];
  return [1, 2, 3, 4]
    .filter((n) => settings[`trustBadge${n}Enabled`] === "true")
    .map((n) => ({ icon: TRUST_BADGE_ICONS[n - 1], text: settings[`trustBadge${n}Text`] }));
}
