import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { blobConfigured, FILES_ROUTE_PREFIX } from "@/lib/uploadStorage";
import { DIRECT_UPLOAD_NAME_RE } from "@/lib/uploadSpecs";

const MAX_URLS = 10;

// فایلی که آپلود شده ولی فرمش ثبت نشده (کاربر عکس/ویدیو رو از نظرش برداشت، صفحه رو بست،
// یا ثبتِ فیش خطا داد) همون لحظه پاک می‌شه. اسم‌ها ۱۲۸بیتیِ تصادفی‌ان و فقط سازنده‌ی
// همون آپلود می‌دونتشون؛ و فایلی که توی هر سفارش/درخواستِ برداشت/نظرِ ثبت‌شده‌ای به کار
// رفته باشه هیچ‌وقت پاک نمی‌شه -- پس این مسیر نمی‌تونه به فایلِ واقعیِ کسی آسیب بزنه
async function isReferenced(url: string, folder: string): Promise<boolean> {
  if (folder === "reviews") {
    return !!(await prisma.review.findFirst({ where: { images: { contains: url } }, select: { id: true } }));
  }
  const [order, shipping, withdrawal] = await Promise.all([
    prisma.order.findFirst({ where: { receiptImage: url }, select: { id: true } }),
    prisma.shippingPayment.findFirst({ where: { receiptImage: url }, select: { id: true } }),
    prisma.walletWithdrawalRequest.findFirst({ where: { receiptImage: url }, select: { id: true } }),
  ]);
  return !!(order || shipping || withdrawal);
}

export async function POST(req: Request) {
  if (!blobConfigured()) return NextResponse.json({ discarded: 0 });
  // sendBeacon بدنه رو با هر content-typeی ممکنه بفرسته -- متن رو خودمون parse می‌کنیم
  const parsed = await req
    .text()
    .then((t) => JSON.parse(t) as { urls?: unknown })
    .catch(() => null);
  const urls = Array.isArray(parsed?.urls)
    ? parsed.urls.filter((u): u is string => typeof u === "string").slice(0, MAX_URLS)
    : [];

  let discarded = 0;
  for (const url of urls) {
    if (!url.startsWith(FILES_ROUTE_PREFIX)) continue;
    const pathname = url.slice(FILES_ROUTE_PREFIX.length);
    const match = DIRECT_UPLOAD_NAME_RE.exec(pathname);
    if (!match) continue;
    if (await isReferenced(url, match[1])) continue;
    await del(pathname).catch(() => {});
    discarded++;
  }
  return NextResponse.json({ discarded });
}
