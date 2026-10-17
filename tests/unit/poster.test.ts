// پوستر اینستاگرام: پارس ورودی، ساخت تگ و کپشن
import { describe, expect, it } from "vitest";
import {
  parseTrendyolInput,
  cleanTrendyolUrl,
  isAllowedTrendyolUrl,
  extractContentIdFromSlugPath,
  buildTag,
  buildTelegramNote,
  pickKeyAttributes,
  priceToman,
  priceTL,
  getDiscountPercent,
  buildGeneratedHashtags,
  buildCaption,
  CAPTION_BODY,
  BASE_HASHTAGS,
  toEnglishBrandName,
  resolveShareTargetInput,
  isCouponCodeCampaign,
  extractTrendyolLinkFromText,
  buildDefaultHashtagSelection,
  MAX_TOTAL_HASHTAGS,
  extractBasketDiscountPercent,
  isTrendyolShortLink,
  resolveTrendyolShortLink,
  translateAgeSizeLabel,
} from "@/lib/poster";

describe("translateAgeSizeLabel", () => {
  it("«Yaş» و «Ay» رو (با بازه یا عددِ تنها) به سال/ماه ترجمه می‌کنه", () => {
    expect(translateAgeSizeLabel("2-4 Yaş")).toBe("2-4 سال");
    expect(translateAgeSizeLabel("12 YAŞ")).toBe("12 سال");
    expect(translateAgeSizeLabel("6 - 9 Ay")).toBe("6-9 ماه");
  });

  it("سایزهایی که سنی نیستن رو دست نمی‌زنه", () => {
    expect(translateAgeSizeLabel("S")).toBeNull();
    expect(translateAgeSizeLabel("36")).toBeNull();
    expect(translateAgeSizeLabel("Standart")).toBeNull();
    expect(translateAgeSizeLabel("Yaş Mendil")).toBeNull();
  });
});

describe("parseTrendyolInput", () => {
  it("لینک کامل ترندیول را می‌پذیرد", () => {
    const p = parseTrendyolInput("https://www.trendyol.com/guess/man-to-p123456789?boutiqueId=1");
    expect(p).toEqual({ type: "url", url: "https://www.trendyol.com/guess/man-to-p123456789?boutiqueId=1", hostname: "www.trendyol.com" });
  });

  it("contentId عددی را می‌پذیرد", () => {
    const p = parseTrendyolInput("123456789");
    expect(p).toEqual({ type: "contentId", contentId: "123456789" });
  });

  it("دامنه‌ی غیرمجاز را رد می‌کند", () => {
    expect(parseTrendyolInput("https://evil.com/x")).toBeNull();
    expect(isAllowedTrendyolUrl("https://amazon.com/p1")).toBe(false);
  });

  it("ورودی خالی را رد می‌کند", () => {
    expect(parseTrendyolInput("")).toBeNull();
    expect(parseTrendyolInput("   ")).toBeNull();
  });

  it("لینکِ کوتاهِ ty.gl (اپِ موبایل ترندیول) را هم می‌پذیرد", () => {
    const p = parseTrendyolInput("https://ty.gl/q76wlxaxro571");
    expect(p).toEqual({ type: "url", url: "https://ty.gl/q76wlxaxro571", hostname: "ty.gl" });
  });

  it("پارامترهای ردیابیِ لینکِ اشتراک‌گذاری (utm_*/adjust_*/link_contentid) را پاک می‌کند، ولی boutiqueId/merchantId را نگه می‌دارد", () => {
    const messy =
      "https://www.trendyol.com/adidas/kk4297-response-runner-kosu-ve-yuruyus-ayakkabi-p-1166449185?boutiqueId=691106&merchantId=968&adjust_t=mk12x3o_m4o2h83&adjust_tracker_limit=999999999&utm_medium=product_free&link_contentid=1166449185&utm_campaign=1166449185&adjust_campaign=product_free&utm_source=share";
    const p = parseTrendyolInput(messy);
    expect(p).toEqual({
      type: "url",
      url: "https://www.trendyol.com/adidas/kk4297-response-runner-kosu-ve-yuruyus-ayakkabi-p-1166449185?boutiqueId=691106&merchantId=968",
      hostname: "www.trendyol.com",
    });
  });
});

describe("cleanTrendyolUrl", () => {
  it("پارامترهای ردیابی رو حذف می‌کند، بقیه رو دست‌نخورده نگه می‌دارد", () => {
    expect(
      cleanTrendyolUrl(
        "https://www.trendyol.com/x-p123?boutiqueId=1&merchantId=2&utm_source=share&adjust_t=abc&link_contentid=123",
      ),
    ).toBe("https://www.trendyol.com/x-p123?boutiqueId=1&merchantId=2");
  });

  it("لینکِ بدونِ پارامترِ ردیابی رو دست‌نخورده برمی‌گرداند", () => {
    const clean = "https://www.trendyol.com/x-p123?boutiqueId=1";
    expect(cleanTrendyolUrl(clean)).toBe(clean);
  });

  it("ورودیِ نامعتبر رو بدونِ کرش عیناً برمی‌گرداند", () => {
    expect(cleanTrendyolUrl("not a url")).toBe("not a url");
  });
});

describe("isTrendyolShortLink", () => {
  it("ty.gl را تشخیص می‌دهد", () => {
    expect(isTrendyolShortLink("https://ty.gl/abc123")).toBe(true);
  });

  it("لینکِ عادی/دامنه‌ی دیگر را رد می‌کند", () => {
    expect(isTrendyolShortLink("https://www.trendyol.com/x")).toBe(false);
    expect(isTrendyolShortLink("not a url")).toBe(false);
  });
});

describe("resolveTrendyolShortLink", () => {
  it("وقتی لینکِ نهایی مستقیم صفحه‌ی محصوله، همونو برمی‌گردونه", async () => {
    const fetchMock = async () =>
      ({ url: "https://www.trendyol.com/brand/product-p123456789" }) as Response;
    const original = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    try {
      const result = await resolveTrendyolShortLink("https://ty.gl/abc123");
      expect(result).toBe("https://www.trendyol.com/brand/product-p123456789");
    } finally {
      global.fetch = original;
    }
  });

  it("cbِ صفحه‌ی میانیِ select-country را دیکود و به لینکِ کامل تبدیل می‌کند", async () => {
    const cb = encodeURIComponent(
      "/springstore/kahve-ustu-krep-alti-saten-tek-omuz-abiye-p-983990949?boutiqueId=61&merchantId=115754",
    );
    const fetchMock = async () =>
      ({ url: `https://www.trendyol.com/en/select-country?cb=${cb}` }) as Response;
    const original = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    try {
      const result = await resolveTrendyolShortLink("https://ty.gl/abc123");
      expect(result).toBe(
        "https://www.trendyol.com/springstore/kahve-ustu-krep-alti-saten-tek-omuz-abiye-p-983990949?boutiqueId=61&merchantId=115754",
      );
    } finally {
      global.fetch = original;
    }
  });

  it("وقتی fetch شکست بخوره، null برمی‌گردونه", async () => {
    const original = global.fetch;
    global.fetch = (async () => {
      throw new Error("network fail");
    }) as typeof fetch;
    try {
      const result = await resolveTrendyolShortLink("https://ty.gl/abc123");
      expect(result).toBeNull();
    } finally {
      global.fetch = original;
    }
  });
});

describe("resolveShareTargetInput", () => {
  it("اگه input صریح باشه، بدونِ اعتبارسنجی همونو برمی‌گردونه", () => {
    const params = new URLSearchParams({ input: "هرچیزی" });
    expect(resolveShareTargetInput(params)).toBe("هرچیزی");
  });

  it("پارامترِ url که خودش لینکِ مجاز باشه رو می‌پذیره", () => {
    const params = new URLSearchParams({ url: "https://www.trendyol.com/x-p123456" });
    expect(resolveShareTargetInput(params)).toBe("https://www.trendyol.com/x-p123456");
  });

  it("لینک را از وسطِ متنِ اشتراک‌گذاری‌شده استخراج می‌کند", () => {
    const params = new URLSearchParams({
      text: "این لباسو ببین: https://www.trendyol.com/guess/man-to-p123456789?boutiqueId=1 نظرت چیه؟",
    });
    expect(resolveShareTargetInput(params)).toBe("https://www.trendyol.com/guess/man-to-p123456789?boutiqueId=1");
  });

  it("url غیرمجاز را نادیده می‌گیرد ولی سراغِ text می‌رود", () => {
    const params = new URLSearchParams({
      url: "https://evil.com/x",
      text: "https://www.trendyol.com/x-p123456",
    });
    expect(resolveShareTargetInput(params)).toBe("https://www.trendyol.com/x-p123456");
  });

  it("وقتی هیچ‌کدام لینکِ ترندیول/میلا ندارند null برمی‌گرداند", () => {
    const params = new URLSearchParams({ title: "سلام", text: "بدونِ لینک", url: "https://evil.com/x" });
    expect(resolveShareTargetInput(params)).toBeNull();
  });

  it("وقتی هیچ پارامتری نیست null برمی‌گرداند", () => {
    expect(resolveShareTargetInput(new URLSearchParams())).toBeNull();
  });
});

describe("extractTrendyolLinkFromText", () => {
  it("خودِ لینکِ تمیز را می‌پذیرد", () => {
    expect(extractTrendyolLinkFromText("https://www.trendyol.com/x-p123456")).toBe(
      "https://www.trendyol.com/x-p123456"
    );
  });

  it("contentId عددیِ تنها را می‌پذیرد", () => {
    expect(extractTrendyolLinkFromText("123456789")).toBe("123456789");
  });

  it("لینک را از وسطِ متنِ کپی‌شده از کلیپ‌بورد استخراج می‌کند", () => {
    expect(
      extractTrendyolLinkFromText("این لباسو ببین: https://www.trendyol.com/x-p123456 نظرت چیه؟")
    ).toBe("https://www.trendyol.com/x-p123456");
  });

  it("متنِ بدونِ لینکِ مجاز null برمی‌گرداند", () => {
    expect(extractTrendyolLinkFromText("سلام چطوری")).toBeNull();
    expect(extractTrendyolLinkFromText("https://evil.com/x")).toBeNull();
    expect(extractTrendyolLinkFromText("")).toBeNull();
  });
});

describe("extractContentIdFromSlugPath", () => {
  it("contentId را از اسلاگ استخراج می‌کند", () => {
    expect(extractContentIdFromSlugPath("/guess/man-to-p123456789")).toBe("123456789");
    expect(extractContentIdFromSlugPath("man-to-p9876543?boutiqueId=2")).toBe("9876543");
  });

  it("وقتی contentId نباشد null می‌دهد", () => {
    expect(extractContentIdFromSlugPath("/category/man-to")).toBeNull();
  });
});

describe("buildTag", () => {
  it("برند و نام را بدون فاصله ترکیب می‌کند", () => {
    expect(buildTag({ brand: "Guess", nameFa: "مانتو شلوار" })).toBe("Guessمانتوشلوار");
  });

  it("با seed (contentId) تگ منحصربه‌فرد می‌شود", () => {
    const a = buildTag({ brand: "Guess", nameFa: "مانتو", seed: "123456789" });
    const b = buildTag({ brand: "Guess", nameFa: "مانتو", seed: "987654321" });
    expect(a).toContain("456789");
    expect(b).toContain("654321");
    expect(a).not.toBe(b);
  });

  it("خالی بودن را مدیریت می‌کند", () => {
    expect(buildTag({})).toBe("");
  });
});

describe("buildTelegramNote", () => {
  it("تگ و لینک را می‌سازد", () => {
    const note = buildTelegramNote({ tag: "Guessمانتو123456", url: "https://www.trendyol.com/x-p1" });
    // تگ با LRI/PDI ایزوله می‌شه تا توی کانتینرِ RTL (یا بعدِ کپی‌شدن توی
    // تلگرام) جهتش برعکس نشه -- src/lib/poster.ts::ltrIsolate
    expect(note).toBe("⁦#Guessمانتو123456⁩\nhttps://www.trendyol.com/x-p1");
  });
});

describe("pickKeyAttributes", () => {
  it("جنس را در اولویت می‌آورد", () => {
    const attrs = [
      { name: "نوع", value: "کتان" },
      { name: "جنس", value: "پنبه" },
      { name: "سایز", value: "M" },
    ];
    const picked = pickKeyAttributes(attrs, 2);
    expect(picked[0]).toEqual({ name: "جنس", value: "پنبه" });
  });

  it("با ورودی خالی آرایه خالی می‌دهد", () => {
    expect(pickKeyAttributes([], 3)).toEqual([]);
  });

  it("دو ویژگیِ مختلف با مقدارِ عینِ‌هم را تکراری حساب می‌کند (فقط یکی برداشته می‌شود)", () => {
    const attrs = [
      { name: "جنسِ رویه", value: "مصنوعی چرم" },
      { name: "جنسِ آستر", value: "مصنوعی چرم" },
      { name: "یقه", value: "گرد" },
    ];
    const picked = pickKeyAttributes(attrs, 5);
    const values = picked.map((a) => a.value);
    expect(values.filter((v) => v === "مصنوعی چرم")).toHaveLength(1);
    expect(values).toContain("گرد");
  });
});

describe("priceToman", () => {
  it("مبلغ را با ارقام فارسی و «تومان» برمی‌گرداند", () => {
    expect(priceToman(1250000)).toBe("۱٬۲۵۰٬۰۰۰ تومان");
  });

  it("null را مدیریت می‌کند", () => {
    expect(priceToman(null)).toBe("—");
  });
});

describe("priceTL", () => {
  it("مبلغ را با پسوند TL برمی‌گرداند", () => {
    expect(priceTL(650)).toBe("650TL");
    expect(priceTL(1290.4)).toBe("1290TL");
  });

  it("null را مدیریت می‌کند", () => {
    expect(priceTL(null)).toBe("—");
  });
});

describe("getDiscountPercent", () => {
  it("درصد تخفیف را محاسبه می‌کند", () => {
    expect(getDiscountPercent(900, 1000)).toBe(10);
    expect(getDiscountPercent(650, 1300)).toBe(50);
  });

  it("بدون تخفیف null می‌دهد", () => {
    expect(getDiscountPercent(1000, 1000)).toBeNull();
    expect(getDiscountPercent(1100, 1000)).toBeNull();
    expect(getDiscountPercent(null, 1000)).toBeNull();
  });
});

describe("buildGeneratedHashtags", () => {
  it("از عنوان و مشخصات محصول هشتگ می‌سازد", () => {
    const tags = buildGeneratedHashtags({
      nameFa: "شومیز زنانه گلدوزی",
      brand: "DeFacto",
      categoryName: "بلوز",
      attributes: [
        { name: "رگولار", value: "رگولار" },
        { name: "آستین", value: "آستین کوتاه" },
        { name: "جنس", value: "نخی" },
      ],
      sizes: ["36", "40", "44", "48"],
    });
    // تگِ ترکیبیِ کلمات (با «_») دیگه ساخته نمی‌شه -- طبقِ درخواستِ صریح
    expect(tags).not.toContain("شومیز_زنانه_گلدوزی");
    expect(tags).toContain("شومیز");
    expect(tags).toContain("گلدوزی");
    expect(tags).toContain("آستین");
    expect(tags).toContain("کوتاه");
    expect(tags).toContain("رگولار");
    expect(tags).toContain("نخی");
    // اعداد سایز هشتگ نمی‌شوند
    expect(tags).not.toContain("36");
    // اسمِ لاتینِ برند هم هشتگ می‌شود -- طبقِ درخواستِ صریحِ جدید (برخلافِ
    // بقیه‌ی منابع که همچنان فقط معادلِ فارسی‌شون هشتگ می‌شه)
    expect(tags).toContain("defacto");
  });

  it("معادلِ فارسیِ برند (brandFa) هم کنارِ خودِ برند هشتگ می‌شود", () => {
    const tags = buildGeneratedHashtags({
      brand: "Rowenta",
      brandFa: "روونتا",
    });
    expect(tags).toContain("rowenta");
    expect(tags).toContain("روونتا");
  });

  it("برندِ چندکلمه‌ای: اسمِ کاملِ به‌هم‌چسبیده (لاتین) و با زیرخط (فارسی) هم کنارِ تکه‌ها هشتگ می‌شود", () => {
    const tags = buildGeneratedHashtags({
      brand: "U.S. Polo Assn.",
      brandFa: "یو اس پولو آسن",
    });
    expect(tags).toContain("uspoloassn");
    expect(tags).toContain("یو_اس_پولو_آسن");
    // تکه‌های جدا هنوز هستن
    expect(tags).toContain("polo");
    // اسمِ کامل قبلِ تکه‌ها میاد
    expect(tags.indexOf("uspoloassn")).toBeLessThan(tags.indexOf("polo"));
  });

  it("برندِ تک‌کلمه‌ای هشتگِ تکراری نمی‌سازد", () => {
    const tags = buildGeneratedHashtags({ brand: "Rowenta" });
    expect(tags.filter((t) => t === "rowenta")).toHaveLength(1);
  });

  it("با ورودی خالی آرایه خالی می‌دهد", () => {
    expect(buildGeneratedHashtags({})).toEqual([]);
  });

  it("خط‌تیره‌ی داخلِ یه اسمِ ترکیبی (مثلاً دسته‌بندی) به زیرخط تبدیل می‌شه، نه اینکه خام بمونه", () => {
    const tags = buildGeneratedHashtags({
      categoryName: "سویشرت-شلوار",
    });
    expect(tags).toContain("سویشرت_شلوار");
    expect(tags).not.toContain("سویشرت-شلوار");
  });

  it("دسته‌بندیِ چندکلمه‌ای (با فاصله) یه هشتگِ ترکیبیِ واحد می‌سازد، نه هشتگ‌های جدا -- چون توی UI هم با هم تیک می‌خورد", () => {
    const tags = buildGeneratedHashtags({
      categoryName: "شلوار گرمکن",
    });
    expect(tags).toContain("شلوار_گرمکن");
    expect(tags).not.toContain("شلوار");
    expect(tags).not.toContain("گرمکن");
  });
});

describe("buildCaption", () => {
  it("کپشن با تگ پیگیری، بدنه‌ی ثابت و هشتگ‌ها می‌سازد", () => {
    const caption = buildCaption({
      tag: "شومیزگلدوزی123456",
      nameFa: "شومیز زنانه گلدوزی",
      brand: "DeFacto",
      categoryName: "بلوز",
      sizes: ["36", "40", "44", "48"],
      attributes: [{ name: "جنس", value: "نخی" }],
    });

    // تگ دیگه # نداره (جزوِ سقفِ ۵تاییِ هشتگ‌های اینستاگرام حساب نشه) ولی هنوز
    // با LRI/PDI ایزوله می‌شه (src/lib/poster.ts::ltrIsolate) -- جلوگیریِ
    // برعکس‌شدنِ بایدایِ متنِ لاتین/عددی توی کانتینرِ RTL
    expect(caption.startsWith("⁦شومیزگلدوزی123456⁩")).toBe(true);
    expect(caption).toContain("قیمت نهایی اجناس در دایرکت مشخص میشه");
    expect(caption).toContain("هزینه باربری بعد از وزنکشی محاسبه و اعلام خواهد شد");
    // «شاپینگ استیج» هم دیگه # نداره -- به‌جاش منشن (@) که اصلاً جزوِ سقفِ
    // هشتگ‌ها حساب نمی‌شه
    expect(caption).toContain("⁦@Shopping.Stage⁩");
    expect(caption).not.toContain("#shoppingstage");
    expect(caption).toContain("*امکان تعویض یا کنسلی نداریم چون اجناس فقط برای شما سفارشی خریده شده*");
    expect(caption).toContain("#شومیز");
    // تگِ ترکیبی دیگه ساخته نمی‌شه
    expect(caption).not.toContain("#شومیز_زنانه_گلدوزی");
    // اسمِ لاتینِ برند هم هشتگ می‌شه -- طبقِ درخواستِ صریحِ جدید
    expect(caption).toContain("#defacto");
  });

  it("بدنه‌ی ثابت حاوی بخش‌های کلیدی است", () => {
    expect(CAPTION_BODY).toContain("زمان حدودی تحویل سفارشات:");
    expect(CAPTION_BODY).toContain("ترکیه، هوایی حدودا سه هفته");
    expect(CAPTION_BODY).toContain("ما کارگزار شما هستیم");
    expect(CAPTION_BODY).toContain("آمازون نکست شین زارا منگو");
    expect(BASE_HASHTAGS).toContain("بلوزاستیج");
  });

  it("جمعِ هشتگ‌ها هرگز از ۵ بیشتر نمی‌شود", () => {
    const caption = buildCaption({
      tag: "تست123",
      nameFa: "شومیز زنانه گلدوزی نخی آستین کوتاه رگولار",
      brand: "DeFacto",
      categoryName: "بلوز",
      sizes: ["36", "40", "44"],
      attributes: [
        { name: "جنس", value: "نخی" },
        { name: "یقه", value: "گرد" },
        { name: "آستین", value: "کوتاه" },
      ],
    });
    const hashtagLine = caption.trim().split("\n").pop() ?? "";
    const count = hashtagLine.split(/\s+/).filter((t) => t.startsWith("#")).length;
    expect(count).toBeLessThanOrEqual(5);
  });

  it("وقتی هشتگ‌های ساخته‌شده کمتر از ۵تاست، از هشتگ‌های پایه پر می‌شود", () => {
    const caption = buildCaption({ tag: "", nameFa: "" });
    const hashtagLine = caption.trim().split("\n").pop() ?? "";
    const count = hashtagLine.split(/\s+/).filter((t) => t.startsWith("#")).length;
    expect(count).toBe(5);
  });

  it("بدون تگ، خط اول تگ حذف می‌شود", () => {
    const caption = buildCaption({ tag: "", nameFa: "پیراهن" });
    expect(caption.startsWith("#")).toBe(false);
    expect(caption).toContain("قیمت نهایی اجناس");
  });

  it("وقتی hashtags داده بشه، دقیقاً همون‌ها استفاده می‌شن (نه انتخابِ خودکار)", () => {
    const caption = buildCaption({
      tag: "تست123",
      nameFa: "شومیز زنانه گلدوزی",
      hashtags: ["دلخواه_یک", "دلخواه_دو"],
    });
    expect(caption).toContain("#دلخواه_یک");
    expect(caption).toContain("#دلخواه_دو");
    expect(caption).not.toContain("#شومیز");
  });

  it("hashtags هم هرگز از سقفِ MAX_TOTAL_HASHTAGS بیشتر نمی‌شه", () => {
    const caption = buildCaption({
      tag: "تست",
      hashtags: ["یک", "دو", "سه", "چهار", "پنج", "شش", "هفت"],
    });
    const hashtagLine = caption.trim().split("\n").pop() ?? "";
    const count = hashtagLine.split(/\s+/).filter((t) => t.startsWith("#")).length;
    expect(count).toBe(MAX_TOTAL_HASHTAGS);
  });
});

describe("buildDefaultHashtagSelection", () => {
  it("همون منطقِ قبلیِ خودکار (ساخته‌شده + پرکننده‌ی پایه، حداکثر ۵تا) را برمی‌گرداند", () => {
    const defaults = buildDefaultHashtagSelection({
      nameFa: "شومیز زنانه گلدوزی",
      categoryName: "بلوز",
    });
    expect(defaults.length).toBeLessThanOrEqual(MAX_TOTAL_HASHTAGS);
    expect(defaults).toContain("شومیز");
  });

  it("با ورودیِ خالی، فقط از هشتگ‌های پایه پر می‌شود", () => {
    const defaults = buildDefaultHashtagSelection({});
    expect(defaults.length).toBe(MAX_TOTAL_HASHTAGS);
    for (const h of defaults) expect(BASE_HASHTAGS).toContain(h);
  });
});

describe("isCouponCodeCampaign", () => {
  it("کمپینِ کدتخفیفی (کد+لاتین/رقم چسبیده) را تشخیص می‌دهد", () => {
    expect(isCouponCodeCampaign("کدFIRSAT5PY0999TLye5 تخفیف")).toBe(true);
  });

  it("کمپینِ کدتخفیفی با فاصله را هم تشخیص می‌دهد", () => {
    expect(isCouponCodeCampaign("کد تخفیف ویژه")).toBe(true);
  });

  it("کلماتِ فارسیِ دیگری که با «کد» شروع می‌شوند را کمپینِ کد حساب نمی‌کند", () => {
    expect(isCouponCodeCampaign("کدو تنبل")).toBe(false);
    expect(isCouponCodeCampaign("کدام مورد")).toBe(false);
  });

  it("کمپینِ واقعی (بدونِ کد) را کمپینِ کد حساب نمی‌کند", () => {
    expect(isCouponCodeCampaign("۲ عدد و بیشتر ۴۰ لیر تخفیف")).toBe(false);
    expect(isCouponCodeCampaign("سبدخرید ۷۰ تخفیف")).toBe(false);
  });
});

describe("extractBasketDiscountPercent", () => {
  it("درصد را از کمپینِ DiscountOnBasket با فرمتِ ٪قبلِ‌عدد درمی‌آورد", () => {
    const pct = extractBasketDiscountPercent([
      { rawNameTr: "Sepette %20 İndirim", discountType: "DiscountOnBasket" },
    ]);
    expect(pct).toBe(20);
  });

  it("فرمتِ عدد٪بعد را هم می‌پذیرد", () => {
    const pct = extractBasketDiscountPercent([
      { rawNameTr: "Sepette 15% Indirim", discountType: "DiscountOnBasket" },
    ]);
    expect(pct).toBe(15);
  });

  it("کمپینِ غیرِ DiscountOnBasket را نادیده می‌گیرد", () => {
    const pct = extractBasketDiscountPercent([
      { rawNameTr: "3 Al 2 Öde", discountType: "MultiBuy" },
      { rawNameTr: "Sepette %20 İndirim", discountType: null },
    ]);
    expect(pct).toBeNull();
  });

  it("وقتی هیچ کمپینی نیست null برمی‌گرداند", () => {
    expect(extractBasketDiscountPercent([])).toBeNull();
  });
});

describe("toEnglishBrandName", () => {
  it("حروفِ خاصِ ترکی را به معادلِ انگلیسیِ ساده تبدیل می‌کند", () => {
    expect(toEnglishBrandName("SIYAH İNCİ")).toBe("SIYAH INCI");
  });

  it("حروفِ بزرگ را دست‌نخورده نگه می‌دارد (برای toUpperCase بعدی)", () => {
    expect(toEnglishBrandName("Combine Michaİl")).toBe("Combine MichaIl");
  });

  it("بدونِ حروفِ ترکی، ورودی را دست‌نخورده برمی‌گرداند", () => {
    expect(toEnglishBrandName("DeFacto")).toBe("DeFacto");
  });
});