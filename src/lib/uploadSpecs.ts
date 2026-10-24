// قوانینِ نوع/حجمِ فایل‌های آپلودی -- مشترک بین سرور (چکِ نهایی) و مرورگر (چکِ قبل از
// آپلودِ مستقیم به Blob، تا پیامِ خطای فارسیِ درست نشون داده بشه). هیچ import سروری نداره.
const MB = 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type UploadSpec = {
  folder: "receipts" | "reviews";
  types: Record<string, string>; // MIME -> پسوند
  maxBytes: (mimeType: string) => number;
  typeError: string;
  sizeError: (mimeType: string) => string;
};

export const RECEIPT_UPLOAD_SPEC: UploadSpec = {
  folder: "receipts",
  types: IMAGE_TYPES,
  maxBytes: () => 5 * MB,
  typeError: "فرمت فایل مجاز نیست (فقط jpg, png, webp, gif)",
  sizeError: () => "حجم فایل نباید بیشتر از ۵ مگابایت باشد",
};

export const REVIEW_UPLOAD_SPEC: UploadSpec = {
  folder: "reviews",
  types: { ...IMAGE_TYPES, ...VIDEO_TYPES },
  maxBytes: (t) => (t in VIDEO_TYPES ? 30 * MB : 5 * MB),
  typeError: "فرمت فایل مجاز نیست (فقط jpg, png, webp, gif, mp4, webm, mov)",
  sizeError: (t) => `حجم فایل نباید بیشتر از ${t in VIDEO_TYPES ? "۳۰" : "۵"} مگابایت باشد`,
};

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType in VIDEO_TYPES;
}

// پیامِ خطای فارسی، یا null اگه فایل از نظرِ نوع/حجم مجازه
export function validateUploadFile(spec: UploadSpec, file: { type: string; size: number }): string | null {
  if (!spec.types[file.type]) return spec.typeError;
  if (file.size > spec.maxBytes(file.type)) return spec.sizeError(file.type);
  return null;
}

// نوعِ آپلودِ مستقیم -- سرور بر اساسش دسترسی رو چک می‌کنه (src/app/api/uploads/presign)
export type DirectUploadKind = "review" | "payment-receipt" | "shipping-receipt" | "withdrawal-receipt";

export function specForKind(kind: DirectUploadKind): UploadSpec {
  return kind === "review" ? REVIEW_UPLOAD_SPEC : RECEIPT_UPLOAD_SPEC;
}

// <folder>/<زمان>-<۳۲ رقمِ hex>.<پسوند> -- اسم رو مرورگر می‌سازه، سرور فقط همین الگو رو قبول می‌کنه
export const DIRECT_UPLOAD_NAME_RE = /^(receipts|reviews)\/\d{13}-[0-9a-f]{32}\.([a-z0-9]{2,4})$/;
