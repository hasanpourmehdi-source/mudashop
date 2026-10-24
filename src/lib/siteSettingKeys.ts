// عمداً بدونِ هیچ importی (مخصوصاً prisma) -- کامپوننت‌های کلاینتی (مثلِ ProductCard)
// فقط همین کلیدها رو لازم دارن، و import از siteSettings.ts کلِ کلاینتِ prisma
// (~۷۰کیلوبایت) رو توی باندلِ مرورگر می‌کشید
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
  // نشانه‌ی اجتماعیِ لحظه‌ای روی صفحه‌ی محصول («N نفر همین چند دقیقه‌ی اخیر این
  // محصول رو دیدن») -- بازه‌ی زمانی و حداقلِ تعداد برای نمایش، هردو قابل‌تنظیم
  SOCIAL_PROOF_WINDOW_MINUTES: "socialProofWindowMinutes",
  SOCIAL_PROOF_MIN_COUNT: "socialProofMinCount",
  // چندتا محصول حداکثر توی بخشِ «این محصول رو خریدن، این‌ها رو هم خریدن» نشون داده بشه
  CROSS_SELL_MAX_ITEMS: "crossSellMaxItems",
  // هر چند ثانیه بجِ پیام‌ها، پیام‌های سفارش و وضعیتِ سفارش خودکار به‌روز بشن
  // (فقط وقتی تبِ مرورگر باز و دیده‌می‌شه) -- هر به‌روزرسانی یه درخواست به سرور و دیتابیسه
  CLIENT_POLL_INTERVAL_SECONDS: "clientPollIntervalSeconds",
  // وقتی ترندیول (Cloudflare) درخواستِ زنده رو بلاک می‌کنه، آخرین نتیجه‌ی ذخیره‌شده
  // تا حداکثر چند ساعت بعد از واکشی‌اش (با برچسبِ «ممکنه به‌روز نباشه») نشون داده بشه.
  // ۰ یعنی خاموش (همون پیامِ خطای قبلی)
  TRENDYOL_STALE_FALLBACK_HOURS: "trendyolStaleFallbackHours",
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
