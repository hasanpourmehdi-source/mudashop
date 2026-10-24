import { describe, it, expect } from "vitest";
import {
  RECEIPT_UPLOAD_SPEC,
  REVIEW_UPLOAD_SPEC,
  validateUploadFile,
  specForKind,
  DIRECT_UPLOAD_NAME_RE,
} from "@/lib/uploadSpecs";

const MB = 1024 * 1024;

describe("validateUploadFile", () => {
  it("فیشِ عکس تا ۵ مگ مجازه، بیشترش نه", () => {
    expect(validateUploadFile(RECEIPT_UPLOAD_SPEC, { type: "image/jpeg", size: 5 * MB })).toBeNull();
    expect(validateUploadFile(RECEIPT_UPLOAD_SPEC, { type: "image/jpeg", size: 5 * MB + 1 })).toMatch(/۵ مگابایت/);
  });

  it("ویدیو برای فیش مجاز نیست", () => {
    expect(validateUploadFile(RECEIPT_UPLOAD_SPEC, { type: "video/mp4", size: MB })).toBe(RECEIPT_UPLOAD_SPEC.typeError);
  });

  it("ویدیوی نظر تا ۳۰ مگ، عکسِ نظر تا ۵ مگ", () => {
    expect(validateUploadFile(REVIEW_UPLOAD_SPEC, { type: "video/mp4", size: 30 * MB })).toBeNull();
    expect(validateUploadFile(REVIEW_UPLOAD_SPEC, { type: "video/mp4", size: 30 * MB + 1 })).toMatch(/۳۰/);
    expect(validateUploadFile(REVIEW_UPLOAD_SPEC, { type: "image/png", size: 6 * MB })).toMatch(/۵/);
  });

  it("نوعِ آپلود پوشه‌ی درست رو انتخاب می‌کنه", () => {
    expect(specForKind("review").folder).toBe("reviews");
    expect(specForKind("payment-receipt").folder).toBe("receipts");
    expect(specForKind("withdrawal-receipt").folder).toBe("receipts");
  });
});

describe("DIRECT_UPLOAD_NAME_RE", () => {
  const hex = "0123456789abcdef0123456789abcdef";
  it("فقط اسمِ ساخته‌شده با الگوی خودمون رو قبول می‌کنه", () => {
    expect(DIRECT_UPLOAD_NAME_RE.test(`reviews/1792594251743-${hex}.mp4`)).toBe(true);
    expect(DIRECT_UPLOAD_NAME_RE.test(`receipts/1792594251743-${hex}.jpg`)).toBe(true);
  });
  it("مسیرِ دلخواه، پوشه‌ی دیگه یا path traversal رد می‌شه", () => {
    expect(DIRECT_UPLOAD_NAME_RE.test(`misc/1792594251743-${hex}.jpg`)).toBe(false);
    expect(DIRECT_UPLOAD_NAME_RE.test(`receipts/../misc/1792594251743-${hex}.jpg`)).toBe(false);
    expect(DIRECT_UPLOAD_NAME_RE.test(`receipts/1792594251743-short.jpg`)).toBe(false);
    expect(DIRECT_UPLOAD_NAME_RE.test(`receipts/1792594251743-${hex}.jpg.html`)).toBe(false);
  });
});
