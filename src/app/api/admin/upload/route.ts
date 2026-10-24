import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { saveUpload } from "@/lib/uploadStorage";
import { fileMatchesDeclaredType } from "@/lib/fileSignature";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

// آپلود فایل واقعی روی public/uploads -- برای عکس راهنمای سایز و مشابه.
// برخلاف ImageListEditor (که فقط URL می‌گیره)، اینجا فایل واقعی از دستگاه ادمین آپلود می‌شه.
export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "فرمت فایل مجاز نیست (فقط jpg, png, webp, gif)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!fileMatchesDeclaredType(buffer, file.type)) {
    return NextResponse.json({ error: "فایل ارسالی معتبر نیست" }, { status: 400 });
  }

  const url = await saveUpload("misc", buffer, ext, file.type);
  return NextResponse.json({ url }, { status: 201 });
}
