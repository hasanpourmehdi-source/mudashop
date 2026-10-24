import { put, head, del, issueSignedToken, presignUrl } from "@vercel/blob";
import { fileMatchesDeclaredType } from "@/lib/fileSignature";
import { DIRECT_UPLOAD_NAME_RE, validateUploadFile, type UploadSpec } from "@/lib/uploadSpecs";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// دیسکِ Vercel فقط‌خواندنیه -- نوشتن توی public/uploads اونجا EROFS می‌داد. روی
// Vercel (وقتی BLOB_STORE_ID ست شده) فایل‌ها توی Vercel Blob (استورِ Private) می‌رن
// و از مسیرِ /api/files/<folder>/<name> سرو می‌شن (همون‌جا دسترسیِ فیش‌ها چک می‌شه).
// توی توسعه‌ی محلی (بدون استور) همون رفتارِ قبلی: public/uploads
export const UPLOAD_FOLDERS = ["misc", "receipts", "reviews"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const FILES_ROUTE_PREFIX = "/api/files/";

export function blobConfigured(): boolean {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveUpload(
  folder: UploadFolder,
  buffer: Buffer,
  ext: string,
  contentType: string
): Promise<string> {
  // ۱۲۸ بیت تصادفی -- آدرسِ فیشِ سفارشِ مهمان قابلِ حدس‌زدن نباشه
  const filename = `${Date.now()}-${randomBytes(16).toString("hex")}.${ext}`;

  if (blobConfigured()) {
    await put(`${folder}/${filename}`, buffer, {
      access: "private",
      contentType,
      addRandomSuffix: false,
    });
    return `${FILES_ROUTE_PREFIX}${folder}/${filename}`;
  }

  const subdir = folder === "misc" ? [] : [folder];
  const dir = path.join(process.cwd(), "public", "uploads", ...subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${[...subdir, filename].join("/")}`;
}

// لینکِ امضاشده‌ی کوتاه‌مدت برای خوندنِ مستقیم از CDNِ Blob (Range هم پشتیبانی می‌شه،
// که برای پخشِ ویدیو روی iOS لازمه)
export async function presignedReadUrl(pathname: string, ttlMs: number): Promise<string> {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({ pathname, operations: ["get", "head"], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });
  return presignedUrl;
}

// هم آدرس‌های قدیمیِ /uploads/... (توسعه‌ی محلی) هم /api/files/... (Blob)
export function isInternalUploadUrl(url: string, folder?: UploadFolder): boolean {
  if (folder) {
    const legacy = folder === "misc" ? "/uploads/" : `/uploads/${folder}/`;
    return url.startsWith(legacy) || url.startsWith(`${FILES_ROUTE_PREFIX}${folder}/`);
  }
  return url.startsWith("/uploads/") || url.startsWith(FILES_ROUTE_PREFIX);
}

// فایلی که مرورگر مستقیم به Blob فرستاده (بدونِ عبور از سرور، که سقفِ ۴.۵ مگابایتیِ
// Vercel رو نداشته باشه) -- چون سرور خودِ فایل رو ندیده، این‌جا همون چک‌های روشِ قدیمی
// (نوع، حجم، magic bytes) رو روی نسخه‌ی ذخیره‌شده انجام می‌ده و اگه رد شد پاکش می‌کنه
async function finalizeDirectUpload(blobPath: string, spec: UploadSpec): Promise<{ url: string } | { error: string }> {
  const match = DIRECT_UPLOAD_NAME_RE.exec(blobPath);
  if (!blobConfigured() || !match || match[1] !== spec.folder) return { error: "فایلِ آپلودشده معتبر نیست" };

  const meta = await head(blobPath).catch(() => null);
  if (!meta) return { error: "فایلِ آپلودشده پیدا نشد، دوباره امتحان کنید" };

  const reject = async (error: string) => {
    await del(blobPath).catch(() => {});
    return { error };
  };
  const invalid = validateUploadFile(spec, { type: meta.contentType, size: meta.size });
  if (invalid) return reject(invalid);
  if (spec.types[meta.contentType] !== match[2]) return reject("فایل ارسالی معتبر نیست");

  const signed = await presignedReadUrl(blobPath, 5 * 60 * 1000);
  const firstBytes = await fetch(signed, { headers: { Range: "bytes=0-63" } })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  if (!firstBytes || !fileMatchesDeclaredType(Buffer.from(firstBytes), meta.contentType)) {
    return reject("فایل ارسالی معتبر نیست");
  }
  return { url: `${FILES_ROUTE_PREFIX}${blobPath}` };
}

export function formHasUpload(formData: FormData): boolean {
  const blobPath = formData.get("blobPath");
  return formData.get("file") instanceof File || (typeof blobPath === "string" && blobPath.length > 0);
}

// هر دو حالت: فیلدِ blobPath (آپلودِ مستقیم از مرورگر) یا فیلدِ file (روشِ قدیمی --
// توسعه‌ی محلیِ بدونِ Blob، یا وقتی مرورگر آپلودِ مستقیم رو نتونست)
export async function acceptUpload(
  formData: FormData,
  spec: UploadSpec,
  missingError = "فایلی ارسال نشده است"
): Promise<{ url: string } | { error: string }> {
  const blobPath = formData.get("blobPath");
  if (typeof blobPath === "string" && blobPath) return finalizeDirectUpload(blobPath, spec);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { error: missingError };
  const invalid = validateUploadFile(spec, file);
  if (invalid) return { error: invalid };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!fileMatchesDeclaredType(buffer, file.type)) return { error: "فایل ارسالی معتبر نیست" };
  return { url: await saveUpload(spec.folder, buffer, spec.types[file.type], file.type) };
}
