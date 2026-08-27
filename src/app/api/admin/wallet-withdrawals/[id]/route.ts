import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction } from "@/lib/wallet";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { logAdminAction } from "@/lib/adminAudit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileMatchesDeclaredType } from "@/lib/fileSignature";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

// تکمیل/رد درخواست واریز -- برخلاف بقیه‌ی جاهای پروژه که مشتری فیش آپلود
// می‌کنه، این‌جا برعکسه: ادمین فیشِ واریزِ خودش به حساب مشتری رو آپلود می‌کنه
// تا اثبات کنه پول واقعاً واریز شده
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok, session } = await requireAdmin("PAYMENTS");
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const withdrawal = await prisma.walletWithdrawalRequest.findUnique({ where: { id } });
  if (!withdrawal) return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  if (withdrawal.status !== "PENDING") {
    return NextResponse.json({ error: "این درخواست قبلاً بررسی شده است" }, { status: 400 });
  }

  const formData = await req.formData();
  const action = formData.get("action");

  if (action === "approve") {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "عکس فیش واریزی را ضمیمه کنید" }, { status: 400 });
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

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await writeFile(path.join(uploadsDir, filename), buffer);
    const receiptUrl = `/uploads/receipts/${filename}`;

    const updated = await prisma.walletWithdrawalRequest.update({
      where: { id },
      data: { status: "PAID", receiptImage: receiptUrl, resolvedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: withdrawal.userId,
        message: `درخواست واریز ${withdrawal.amount.toLocaleString("fa-IR")} تومانی شما به حسابتان واریز شد -- فیش واریزی در دسترس است.`,
        link: "/wallet",
      },
    });

    await notifyCustomerOutbound({
      userId: withdrawal.userId,
      eventType: "WALLET_CREDIT",
      title: `واریز ${withdrawal.amount.toLocaleString("fa-IR")} تومان انجام شد`,
      body: `درخواست واریز ${withdrawal.amount.toLocaleString("fa-IR")} تومانی شما به حسابتان واریز شد -- فیش واریزی در کیف پول در دسترس است.`,
    });

    await logAdminAction({
      adminId: session.user.id,
      adminName: session.user.name ?? "",
      adminEmail: session.user.email ?? "",
      action: "WALLET_WITHDRAWAL_APPROVED",
      targetType: "WalletWithdrawalRequest",
      targetId: id,
      detail: `${withdrawal.amount.toLocaleString("fa-IR")} تومان`,
    });

    return NextResponse.json(updated);
  }

  if (action === "reject") {
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "دلیل رد را بنویسید" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await applyWalletTransaction(tx, {
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        type: "REFUND",
        description: `برگشت درخواست واریز رد شده -- ${reason}`,
      });
      return tx.walletWithdrawalRequest.update({
        where: { id },
        data: { status: "REJECTED", rejectReason: reason, resolvedAt: new Date() },
      });
    });

    await prisma.notification.create({
      data: {
        userId: withdrawal.userId,
        message: `درخواست واریز ${withdrawal.amount.toLocaleString(
          "fa-IR"
        )} تومانی شما رد شد -- ${reason} (مبلغ به کیف پول شما بازگشت داده شد)`,
        link: "/wallet",
      },
    });

    await notifyCustomerOutbound({
      userId: withdrawal.userId,
      eventType: "WALLET_CREDIT",
      title: `درخواست واریز ${withdrawal.amount.toLocaleString("fa-IR")} تومانی رد شد`,
      body: `درخواست واریز ${withdrawal.amount.toLocaleString(
        "fa-IR"
      )} تومانی شما رد شد -- ${reason} (مبلغ به کیف پول شما بازگشت داده شد).`,
    });

    await logAdminAction({
      adminId: session.user.id,
      adminName: session.user.name ?? "",
      adminEmail: session.user.email ?? "",
      action: "WALLET_WITHDRAWAL_REJECTED",
      targetType: "WalletWithdrawalRequest",
      targetId: id,
      detail: reason,
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
}
