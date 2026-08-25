import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { restoreOrderResources } from "@/lib/orderResources";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { z } from "zod";

const updateSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(500).optional(),
});

// تصمیم ادمین روی درخواست لغوِ سفارش خارجی:
//  - approve: کل سفارش CANCELLED می‌شه و منابع (موجودی/کوپن/کیف‌پول) برمی‌گردن.
//    چون پول کارت‌به‌کارت اقلام خارج از سیستمه، به ادمین‌ها هشدار می‌دیم که
//    وجه رو دستی برگردونن (dedupe برای اینکه هر بار فقط یه بار هشدار بده).
//  - reject: هیچ تغییری روی سفارش اعمال نمی‌شه -- فقط درخواست REJECTED می‌شه
//    و مشتری مطلع می‌شه.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "عملیات نامعتبر است" }, { status: 400 });
  }

  const cancellationRequest = await prisma.cancellationRequest.findUnique({
    where: { orderId: id },
    include: {
      order: { include: { items: true } },
    },
  });

  if (!cancellationRequest) {
    return NextResponse.json({ error: "درخواست لغو برای این سفارش یافت نشد" }, { status: 404 });
  }
  if (cancellationRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "این درخواست قبلاً بررسی شده است" },
      { status: 400 }
    );
  }

  const { order } = cancellationRequest;
  const adminNote = parsed.data.adminNote?.trim() || undefined;

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "این سفارش قبلاً لغو شده است" }, { status: 400 });
  }

  // دفاع لایه‌ی دوم: حتی اگه یه درخواست لغوِ PENDING (مثلاً قدیمی، از قبل از این
  // گارد) روی سفارشی مونده باشه که یه‌جایی بین ثبت درخواست و الان ارسال/تحویل
  // شده، ادمین نباید بتونه تأییدش کنه -- کالا احتمالاً دستِ مشتریه
  if (parsed.data.action === "approve" && ["SHIPPED", "DELIVERED", "RETURNED"].includes(order.status)) {
    return NextResponse.json(
      { error: "این سفارش ارسال/تحویل شده -- دیگر قابل لغو نیست" },
      { status: 400 }
    );
  }

  if (parsed.data.action === "approve") {
    const updated = await prisma.$transaction(async (tx) => {
      await restoreOrderResources(tx, order);

      const result = await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
        include: { items: true },
      });

      await tx.cancellationRequest.update({
        where: { id: cancellationRequest.id },
        data: { status: "APPROVED", adminNote },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "CANCELLED",
          note: `درخواست لغو توسط ادمین تأیید شد${adminNote ? ` -- ${adminNote}` : ""}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          message: `درخواست لغو سفارش #${order.id.slice(-8)} تأیید شد و سفارش لغو گردید. موجودی/کوپن/کیف پول برگشت داده شد.`,
          link: `/orders/${order.id}`,
        },
      });

      return result;
    });

    await notifyAdminsOnce(
      `[لغو سفارش خارجی]`,
      `[لغو سفارش خارجی] درخواست لغو سفارش #${order.id.slice(-8)} تأیید شد. در صورت پرداخت کارت‌به‌کارت، وجه را دستی به مشتری برگردانید.`,
      `/admin/orders/${order.id}`
    );

    return NextResponse.json(updated);
  }

  // reject: سفارش دست‌نخورده می‌مونه، فقط درخواست رد می‌شه
  const [updated] = await prisma.$transaction([
    prisma.cancellationRequest.update({
      where: { id: cancellationRequest.id },
      data: { status: "REJECTED", adminNote },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `درخواست لغو توسط ادمین رد شد${adminNote ? ` -- ${adminNote}` : ""}`,
      },
    }),
    prisma.notification.create({
      data: {
        userId: order.userId,
        message: adminNote
          ? `درخواست لغو سفارش #${order.id.slice(-8)} رد شد: ${adminNote}`
          : `درخواست لغو سفارش #${order.id.slice(-8)} رد شد`,
        link: `/orders/${order.id}`,
      },
    }),
  ]);

  return NextResponse.json(updated);
}