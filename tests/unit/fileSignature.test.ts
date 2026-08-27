import { describe, expect, it } from "vitest";
import { fileMatchesDeclaredType } from "@/lib/fileSignature";

// نمونه‌های واقعیِ حداقلی از هر فرمت -- فقط magic bytes/هدرِ لازم برای عبور
// از چک، نه یه فایلِ کاملاً معتبر (که برای این چک لازم هم نیست)
const REAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const REAL_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const REAL_GIF = Buffer.from("GIF89a" + "xxxx", "ascii");
const REAL_WEBP = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP", "ascii")]);
const REAL_MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42", "ascii")]);
const REAL_WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]);
const FAKE_TEXT = Buffer.from("<?php system($_GET['c']); ?>", "ascii");

describe("fileMatchesDeclaredType -- تشخیص نوعِ واقعیِ فایل از رویِ magic bytes", () => {
  it("فایل‌های واقعیِ هر فرمت با MIME درستشون تطبیق دارند", () => {
    expect(fileMatchesDeclaredType(REAL_JPEG, "image/jpeg")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_PNG, "image/png")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_GIF, "image/gif")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_WEBP, "image/webp")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_MP4, "video/mp4")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_MP4, "video/quicktime")).toBe(true);
    expect(fileMatchesDeclaredType(REAL_WEBM, "video/webm")).toBe(true);
  });

  it("فایلِ جعلی (مثلاً متن/اسکریپت) با هیچ MIMEِ مجازی تطبیق ندارد", () => {
    expect(fileMatchesDeclaredType(FAKE_TEXT, "image/jpeg")).toBe(false);
    expect(fileMatchesDeclaredType(FAKE_TEXT, "image/png")).toBe(false);
    expect(fileMatchesDeclaredType(FAKE_TEXT, "video/mp4")).toBe(false);
  });

  it("فایلِ واقعی با MIMEِ اعلام‌شده‌ی غلط (جعلِ file.type) رد می‌شود", () => {
    // مثلاً یه PNGِ واقعی که کلاینت ادعا کرده jpeg هست
    expect(fileMatchesDeclaredType(REAL_PNG, "image/jpeg")).toBe(false);
    expect(fileMatchesDeclaredType(REAL_JPEG, "image/png")).toBe(false);
  });

  it("MIMEِ ناشناخته همیشه false برمی‌گرداند", () => {
    expect(fileMatchesDeclaredType(REAL_JPEG, "application/octet-stream")).toBe(false);
  });

  it("بافرِ خیلی کوتاه باعثِ کرش نمی‌شود، فقط false برمی‌گرداند", () => {
    expect(fileMatchesDeclaredType(Buffer.from([0xff]), "image/jpeg")).toBe(false);
    expect(fileMatchesDeclaredType(Buffer.alloc(0), "image/png")).toBe(false);
  });
});
