import { describe, expect, it } from "vitest";
import { parseAttrsQuery } from "@/lib/attrsQuery";

describe("parseAttrsQuery", () => {
  it("توکن‌های «نام~مقدار» به Record تبدیل می‌شوند", () => {
    expect(parseAttrsQuery("سایز~M,رنگ~مشکی")).toEqual({
      سایز: "M",
      رنگ: "مشکی",
    });
  });

  it("برای هر نام ویژگی فقط اولین مقدار معتبر است", () => {
    expect(parseAttrsQuery("سایز~M,سایز~L")).toEqual({ سایز: "M" });
  });

  it("توکن بدون ~ یا خالی نادیده گرفته می‌شود", () => {
    expect(parseAttrsQuery("سایز")).toEqual({});
    expect(parseAttrsQuery("سایز~M,,جنس~نخ")).toEqual({
      سایز: "M",
      جنس: "نخ",
    });
  });

  it("ورودی null/undefined/empty خالی برمی‌گرداند", () => {
    expect(parseAttrsQuery(null)).toEqual({});
    expect(parseAttrsQuery(undefined)).toEqual({});
    expect(parseAttrsQuery("")).toEqual({});
  });
});