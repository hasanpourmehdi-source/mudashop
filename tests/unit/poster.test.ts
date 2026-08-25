// پوستر اینستاگرام: پارس ورودی، ساخت تگ و کپشن
import { describe, expect, it } from "vitest";
import {
  parseTrendyolInput,
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
} from "@/lib/poster";

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
    expect(note).toBe("#Guessمانتو123456\nhttps://www.trendyol.com/x-p1");
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
    expect(tags).toContain("شومیز_زنانه_گلدوزی");
    expect(tags).toContain("گلدوزی");
    expect(tags).toContain("defacto");
    expect(tags).toContain("آستین");
    expect(tags).toContain("کوتاه");
    expect(tags).toContain("رگولار");
    expect(tags).toContain("نخی");
    // اعداد سایز هشتگ نمی‌شوند
    expect(tags).not.toContain("36");
  });

  it("با ورودی خالی آرایه خالی می‌دهد", () => {
    expect(buildGeneratedHashtags({})).toEqual([]);
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

    expect(caption.startsWith("#شومیزگلدوزی123456")).toBe(true);
    expect(caption).toContain("قیمت نهایی اجناس در دایرکت مشخص میشه");
    expect(caption).toContain("هزینه باربری بعد از وزنکشی محاسبه و اعلام خواهد شد");
    expect(caption).toContain("#shoppingstage");
    expect(caption).toContain("*امکان تعویض یا کنسلی نداریم چون اجناس فقط برای شما سفارشی خریده شده*");
    expect(caption).toContain("#شلوار");
    expect(caption).toContain("#پانچو");
    expect(caption).toContain("#شومیز_زنانه_گلدوزی");
    expect(caption).toContain("#defacto");
  });

  it("بدنه‌ی ثابت حاوی بخش‌های کلیدی است", () => {
    expect(CAPTION_BODY).toContain("زمان حدودی تحویل سفارشات:");
    expect(CAPTION_BODY).toContain("ترکیه، هوایی حدودا سه هفته");
    expect(CAPTION_BODY).toContain("ما کارگزار شما هستیم");
    expect(CAPTION_BODY).toContain("آمازون نکست شین زارا منگو");
    expect(BASE_HASHTAGS).toContain("بلوزاستیج");
  });

  it("جمعِ هشتگ‌ها هرگز از ۳۰ بیشتر نمی‌شود", () => {
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
    expect(count).toBeLessThanOrEqual(30);
  });

  it("بدون تگ، خط اول تگ حذف می‌شود", () => {
    const caption = buildCaption({ tag: "", nameFa: "پیراهن" });
    expect(caption.startsWith("#")).toBe(false);
    expect(caption).toContain("قیمت نهایی اجناس");
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