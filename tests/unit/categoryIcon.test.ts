import { describe, expect, it } from "vitest";
import { categoryIcon, ICON_PALETTE } from "@/lib/categoryIcon";

describe("categoryIcon -- حدس آیکون از روی اسم دسته", () => {
  it("اولین قانونِ مچ‌شده برنده است (ترتیب قوانین مهم است)", () => {
    // «زنانه» زودتر از «کفش» در لیست قوانین است
    expect(categoryIcon("کفش زنانه")).toEqual({ icon: "👩", color: "#fbcfe8" });
  });

  it("تطبیق زیررشته (نه کلمه‌ی کامل) کار می‌کند", () => {
    expect(categoryIcon("لوازم‌التحریر و کتابفروشی").icon).toBe("📚");
    expect(categoryIcon("کیف اداری").icon).toBe("👜");
  });

  it("اسم‌های ترکیبی از سرگروه‌ها قانون درست را می‌گیرند", () => {
    expect(categoryIcon("پیراهن مردانه")).toEqual({ icon: "🧔", color: "#bfdbfe" });
    expect(categoryIcon("شورت بچگانه")).toEqual({ icon: "🧒", color: "#fde68a" });
  });

  it("بدون مچ، آیکون پیش‌فرض عمومی برمی‌گردد", () => {
    expect(categoryIcon("گوناگون")).toEqual({ icon: "🏷️", color: "#e5e7eb" });
    expect(categoryIcon("")).toEqual({ icon: "🏷️", color: "#e5e7eb" });
  });
});

describe("ICON_PALETTE", () => {
  it("پالت کامل و بدون تکرار است", () => {
    expect(ICON_PALETTE.length).toBeGreaterThan(20);
    expect(new Set(ICON_PALETTE).size).toBe(ICON_PALETTE.length);
  });
});