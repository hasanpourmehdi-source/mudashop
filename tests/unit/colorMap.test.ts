import { describe, expect, it } from "vitest";
import { colorForValue, COLOR_MAP } from "@/lib/colorMap";

const EXPECTED_VALUES: Record<string, string> = {
  قرمز: "#DC2626",
  مشکی: "#111111",
  سیاه: "#111111",
  سفید: "#FFFFFF",
  آبی: "#1E3A8A",
  خاکستری: "#6B7280",
};

describe("colorForValue", () => {
  it("رنگ‌های شناخته‌شده کد درست دارند", () => {
    for (const [name, hex] of Object.entries(EXPECTED_VALUES)) {
      expect(colorForValue(name)).toBe(hex);
    }
  });

  it("فضای اطراف مقدار نادیده گرفته می‌شود", () => {
    expect(colorForValue("  قرمز ")).toBe("#DC2626");
  });

  it("رنگ ناشناخته یا مقدار خالی null برمی‌گرداند", () => {
    expect(colorForValue("فیروزه‌ای")).toBeNull();
    expect(colorForValue("")).toBeNull();
    expect(colorForValue("   ")).toBeNull();
  });

  it("مترادف‌ها یکدست نگاشت شده‌اند؛ سرمه‌ای با آبی تیره فرق دارد", () => {
    expect(colorForValue("آبی")).toBe(colorForValue("آبی تیره"));
    expect(colorForValue("سیاه")).toBe(colorForValue("مشکی"));
    expect(colorForValue("سرمه‌ای")).toBe("#1E293B");
    expect(colorForValue("سرمه‌ای")).not.toBe(colorForValue("آبی تیره"));
  });

  it("هر مقداری که مقدارگیری می‌کند در COLOR_MAP هست و برعکس", () => {
    for (const name of Object.keys(COLOR_MAP)) {
      expect(colorForValue(name)).toBe(COLOR_MAP[name]);
    }
  });
});