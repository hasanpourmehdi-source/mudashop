import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { FILES_ROUTE_PREFIX, UPLOAD_FOLDERS, presignedReadUrl, type UploadFolder } from "@/lib/uploadStorage";

// لینکِ امضاشده‌ی Blob این‌قدر معتبره؛ پاسخِ ریدایرکتِ فایل‌های عمومی نصفِ این مدت
// کش می‌شه تا لینکِ کش‌شده هیچ‌وقت منقضی‌شده تحویل داده نشه
const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

// فیش‌ها: فقط ادمین/کارمندِ مالی-سفارش، یا صاحبِ همون سفارش/درخواستِ برداشت.
// سفارشِ مهمان سشن نداره -- خودِ آدرسِ ۱۲۸بیتیِ تصادفی (مثلِ authorityِ پرداخت) کافیه
async function canViewReceipt(url: string): Promise<boolean> {
  if ((await requireAdmin("PAYMENTS")).ok || (await requireAdmin("ORDERS")).ok) return true;

  const [order, shipping, withdrawal] = await Promise.all([
    prisma.order.findFirst({
      where: { receiptImage: url },
      select: { userId: true, user: { select: { isGuest: true } } },
    }),
    prisma.shippingPayment.findFirst({
      where: { receiptImage: url },
      select: { order: { select: { userId: true, user: { select: { isGuest: true } } } } },
    }),
    prisma.walletWithdrawalRequest.findFirst({ where: { receiptImage: url }, select: { userId: true } }),
  ]);
  const owner = order ?? shipping?.order ?? null;
  if (owner?.user.isGuest) return true;

  const ownerId = owner?.userId ?? withdrawal?.userId;
  if (!ownerId) return false;
  const session = await auth();
  return session?.user?.id === ownerId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ folder: string; name: string }> }) {
  const { folder, name } = await params;
  if (!UPLOAD_FOLDERS.includes(folder as UploadFolder) || !/^[A-Za-z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  }

  const isReceipt = folder === "receipts";
  if (isReceipt && !(await canViewReceipt(`${FILES_ROUTE_PREFIX}${folder}/${name}`))) {
    return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  }

  const target = await presignedReadUrl(`${folder}/${name}`, SIGNED_URL_TTL_MS);
  const res = NextResponse.redirect(target, 302);
  res.headers.set(
    "Cache-Control",
    isReceipt ? "private, no-store" : `public, max-age=${SIGNED_URL_TTL_MS / 2000}, s-maxage=${SIGNED_URL_TTL_MS / 2000}`
  );
  return res;
}
