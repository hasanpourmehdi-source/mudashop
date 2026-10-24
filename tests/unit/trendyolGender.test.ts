import { describe, it, expect } from "vitest";
import { genderFaFromTrendyolValue, extractGenderFaFromHtml } from "@/lib/trendyolGender";

describe("genderFaFromTrendyolValue", () => {
  it.each([
    ["Erkek", "مردانه"],
    ["male", "مردانه"],
    ["Kadın", "زنانه"],
    ["female", "زنانه"],
    ["Erkek Çocuk", "پسرانه"],
    ["Kız Çocuk", "دخترانه"],
    ["Çocuk", "بچگانه"],
    ["Bebek", "نوزادی"],
    ["Unisex", "یونیسکس"],
    ["bilinmiyor", null],
    ["", null],
  ])("%s -> %s", (input, expected) => {
    expect(genderFaFromTrendyolValue(input)).toBe(expected);
  });
});

describe("extractGenderFaFromHtml", () => {
  it("اول ld+json (محصولِ خودِ صفحه) را می‌خواند", () => {
    const html = '"audience": {"@type":"PeopleAudience","suggestedGender": "male"} ... "gender":{"id":1,"name":"Kadın"}';
    expect(extractGenderFaFromHtml(html)).toBe("مردانه");
  });
  it("بدون audience از gender استفاده می‌کند", () => {
    expect(extractGenderFaFromHtml('x "gender":{"id":2,"name":"Erkek"} y')).toBe("مردانه");
    expect(extractGenderFaFromHtml('x "gender":"Kadın" y')).toBe("زنانه");
  });
  it("اگر چیزی نبود null", () => {
    expect(extractGenderFaFromHtml("<html></html>")).toBeNull();
  });
});
