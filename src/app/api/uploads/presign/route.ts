import { NextResponse } from "next/server";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { rateLimitOrNull } from "@/lib/rateLimit";
import { blobConfigured } from "@/lib/uploadStorage";
import { DIRECT_UPLOAD_NAME_RE, specForKind, type DirectUploadKind } from "@/lib/uploadSpecs";

// آپلودِ مستقیم از مرورگر به Vercel Blob (ویدیوی نظر و فیش‌ها) -- فایل از سرورِ ما رد
// نمی‌شه، پس سقفِ ۴.۵ مگابایتیِ بدنه‌ی درخواستِ Vercel روش اثر نداره. این‌جا فقط دسترسی
// چک می‌شه و یه لینکِ PUTِ چنددقیقه‌ای فقط برای همون اسم/نوع/حجم صادر می‌شه؛ چکِ نهاییِ
// محتوای فایل (magic bytes) موقعِ ثبت توی روتِ خودِ همون فرم انجام می‌شه (acceptUpload)
const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;
const KINDS: DirectUploadKind[] = ["review", "payment-receipt", "shipping-receipt", "withdrawal-receipt"];

class UploadDenied extends Error {}

// همون شرط‌های روتِ نهاییِ هر فرم -- این فقط دروازه‌ی جلوگیری از آپلودِ بی‌صاحب/سوءاستفاده‌ست
async function authorize(req: Request, kind: DirectUploadKind, payload: Record<string, unknown>) {
  if (kind === "review") {
    if (rateLimitOrNull(req, "REVIEW_UPLOAD_PRESIGN")) throw new UploadDenied("تعداد آپلودها زیاد است");
    const session = await auth();
    if (!session?.user?.id) throw new UploadDenied("ابتدا وارد حساب کاربری شوید");
    return;
  }
  if (kind === "withdrawal-receipt") {
    if (!(await requireAdmin("PAYMENTS")).ok) throw new UploadDenied("دسترسی غیرمجاز");
    return;
  }
  if (kind === "payment-receipt") {
    const authority = typeof payload.authority === "string" ? payload.authority : "";
    const order = authority
      ? await prisma.order.findUnique({
          where: { paymentAuthority: authority },
          select: { userId: true, paymentStatus: true, user: { select: { isGuest: true } } },
        })
      : null;
    if (!order || order.paymentStatus !== "AWAITING_PAYMENT") throw new UploadDenied("تراکنش یافت نشد");
    if (!order.user.isGuest) {
      const session = await auth();
      if (session?.user?.id !== order.userId) throw new UploadDenied("تراکنش یافت نشد");
    }
    return;
  }
  // shipping-receipt
  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  const session = await auth();
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: { userId: true, shippingPayment: { select: { status: true } } },
      })
    : null;
  if (!session?.user?.id || !order || order.userId !== session.user.id || order.shippingPayment?.status !== "AWAITING_PAYMENT") {
    throw new UploadDenied("سفارش یافت نشد");
  }
}

// مرورگر قبل از آپلود می‌پرسه آپلودِ مستقیم در دسترسه یا نه (توی توسعه‌ی محلیِ بدونِ Blob
// نیست و همون روشِ قدیمیِ ارسالِ فایل به روتِ فرم استفاده می‌شه)
export async function GET() {
  return NextResponse.json({ direct: blobConfigured() });
}

export async function POST(req: Request) {
  if (!blobConfigured()) return NextResponse.json({ error: "آپلودِ مستقیم فعال نیست" }, { status: 501 });
  const body = (await req.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });

  try {
    const result = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname, clientPayload) => {
        const payload = (() => {
          try {
            return JSON.parse(clientPayload ?? "{}") as Record<string, unknown>;
          } catch {
            return {};
          }
        })();
        const kind = payload.kind as DirectUploadKind;
        if (!KINDS.includes(kind)) throw new UploadDenied("نوعِ آپلود نامعتبر است");
        const spec = specForKind(kind);

        const match = DIRECT_UPLOAD_NAME_RE.exec(pathname);
        const contentType = match ? Object.keys(spec.types).find((t) => spec.types[t] === match[2]) : undefined;
        if (!match || match[1] !== spec.folder || !contentType) throw new UploadDenied("نامِ فایل نامعتبر است");

        await authorize(req, kind, payload);

        const validUntil = Date.now() + UPLOAD_URL_TTL_MS;
        const maximumSizeInBytes = spec.maxBytes(contentType);
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil,
          allowedContentTypes: [contentType],
          maximumSizeInBytes,
        });
        return { token, urlOptions: { validUntil, allowedContentTypes: [contentType], maximumSizeInBytes } };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UploadDenied) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[uploads/presign] خطا:", err);
    return NextResponse.json({ error: "خطا در آماده‌سازیِ آپلود" }, { status: 500 });
  }
}
