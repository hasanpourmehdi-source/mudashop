import { uploadPresigned } from "@vercel/blob/client";
import { specForKind, validateUploadFile, type DirectUploadKind } from "@/lib/uploadSpecs";

// سمتِ مرورگر: فایل رو مستقیم به Vercel Blob می‌فرسته (سرورِ /api/uploads/presign فقط
// دسترسی رو چک می‌کنه و لینکِ آپلود می‌ده). خروجی: فیلدهایی که باید به فرمِ نهایی اضافه
// بشن -- blobPath (آپلودِ مستقیم موفق) یا خودِ file (توسعه‌ی محلیِ بدونِ Blob، روشِ قدیمی)
let directAvailable: Promise<boolean> | null = null;
function isDirectAvailable(): Promise<boolean> {
  directAvailable ??= fetch("/api/uploads/presign")
    .then((r) => (r.ok ? r.json() : { direct: false }))
    .then((d: { direct?: boolean }) => !!d.direct)
    .catch(() => false);
  return directAvailable;
}

function randomFileName(ext: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now()}-${hex}.${ext}`;
}

const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

export class UploadValidationError extends Error {}

export async function prepareUpload(
  file: File,
  kind: DirectUploadKind,
  context: Record<string, string> = {},
  onProgress?: (percent: number) => void
): Promise<{ blobPath: string } | { file: File }> {
  const spec = specForKind(kind);
  const invalid = validateUploadFile(spec, file);
  if (invalid) throw new UploadValidationError(invalid);

  if (!(await isDirectAvailable())) return { file };

  const blobPath = `${spec.folder}/${randomFileName(spec.types[file.type])}`;
  try {
    await uploadPresigned(blobPath, file, {
      access: "private",
      contentType: file.type,
      handleUploadUrl: "/api/uploads/presign",
      clientPayload: JSON.stringify({ kind, ...context }),
      multipart: file.size > MULTIPART_THRESHOLD_BYTES,
      onUploadProgress: onProgress ? ({ percentage }) => onProgress(Math.round(percentage)) : undefined,
    });
  } catch {
    throw new UploadValidationError("آپلودِ فایل انجام نشد، اتصال رو بررسی کن و دوباره امتحان کن");
  }
  return { blobPath };
}

// هر دو حالتِ خروجیِ prepareUpload رو به FormDataِ فرم اضافه می‌کنه
export function appendUpload(formData: FormData, prepared: { blobPath: string } | { file: File }) {
  if ("blobPath" in prepared) formData.append("blobPath", prepared.blobPath);
  else formData.append("file", prepared.file);
}

// فایل‌های آپلودشده‌ای که هیچ‌وقت توی فرمِ ثبت‌شده‌ای به کار نرفتن رو همون لحظه از Blob
// پاک می‌کنه (سرور فقط فایلی رو پاک می‌کنه که توی هیچ سفارش/نظری ثبت نشده باشه).
// beacon: برای لحظه‌ی بستن/ترکِ صفحه، که fetchِ معمولی ممکنه نیمه‌کاره قطع بشه
export function discardUploads(urls: string[], { beacon = false }: { beacon?: boolean } = {}) {
  const blobUrls = urls.filter((u) => u.startsWith("/api/files/"));
  if (blobUrls.length === 0) return;
  const body = JSON.stringify({ urls: blobUrls });
  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/uploads/discard", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/uploads/discard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// وقتی ثبتِ فرمِ فیش خطا داد، فایلی که همین الان مستقیم آپلود شده بود دیگه به کار نمیاد
export function discardPrepared(prepared: { blobPath: string } | { file: File } | null) {
  if (prepared && "blobPath" in prepared) discardUploads([`/api/files/${prepared.blobPath}`]);
}
