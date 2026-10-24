import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { acceptUpload } from "@/lib/uploadStorage";
import { REVIEW_UPLOAD_SPEC } from "@/lib/uploadSpecs";
import { rateLimitOrNull, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

// آپلود عکس نظر توسط کاربر عادی (لاگین‌کرده) -- برخلاف /api/admin/upload که فقط
// مخصوص ادمینه، اینجا هر کاربری که وارد حساب شده می‌تونه برای نظرش عکس آپلود کنه.
// هر بار یه فایل می‌گیره؛ چندتا عکس یعنی چندبار صدا زدن این اندپوینت از کلاینت.
export async function POST(req: Request) {
  const limited = rateLimitOrNull(req, "REVIEW_UPLOAD");
  if (limited) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE(limited.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "برای آپلود عکس ابتدا وارد حساب کاربری شوید" }, { status: 401 });
  }

  const formData = await req.formData();
  const uploaded = await acceptUpload(formData, REVIEW_UPLOAD_SPEC);
  if ("error" in uploaded) return NextResponse.json({ error: uploaded.error }, { status: 400 });
  const isVideo = /\.(mp4|webm|mov)$/.test(uploaded.url);
  return NextResponse.json({ url: uploaded.url, type: isVideo ? "video" : "image" }, { status: 201 });
}
