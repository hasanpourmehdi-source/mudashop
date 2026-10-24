import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction } from "@/lib/wallet";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { logAdminAction } from "@/lib/adminAudit";
import { acceptUpload } from "@/lib/uploadStorage";
import { RECEIPT_UPLOAD_SPEC } from "@/lib/uploadSpecs";

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
    const uploaded = await acceptUpload(formData, RECEIPT_UPLOAD_SPEC, "عکس فیش واریزی را ضمیمه کنید");
    if ("error" in uploaded) return NextResponse.json({ error: uploaded.error }, { status: 400 });
    const receiptUrl = uploaded.url;

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
