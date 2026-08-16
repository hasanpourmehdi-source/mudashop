import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

// آپلود عکس نظر توسط کاربر عادی (لاگین‌کرده) -- برخلاف /api/admin/upload که فقط
// مخصوص ادمینه، اینجا هر کاربری که وارد حساب شده می‌تونه برای نظرش عکس آپلود کنه.
// هر بار یه فایل می‌گیره؛ چندتا عکس یعنی چندبار صدا زدن این اندپوینت از کلاینت.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "برای آپلود عکس ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  }

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

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "reviews");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/reviews/${filename}` }, { status: 201 });
}
