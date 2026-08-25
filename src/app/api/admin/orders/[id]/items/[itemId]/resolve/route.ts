import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { applyWalletTransaction } from "@/lib/wallet";
import { PURCHASE_OUTCOME_LABELS as OUTCOME_LABELS, notifyIfAllArrived } from "@/lib/orderPurchaseStatus";
import { z } from "zod";

// سایز/رنگ اشتباه یه مغایرته، نه یه خرابیِ قطعی مثل گم‌شدن -- به‌جای رفاندِ
// فوریِ خودکار، از مشتری می‌پرسیم که با همین مورد راضیه (نگه می‌داره) یا
// ترجیح می‌ده پولش برگرده؛ تصمیم نهایی با /mismatch-decision ثبت می‌شه
const AWAITING_DECISION_OUTCOMES = new Set(["WRONG_SIZE", "WRONG_COLOR"]);

const schema = z.object({
  outcome: z.enum(["RECEIVED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]),
  note: z.string().trim().max(500).optional(),
  // اختیاری -- همون لحظه‌ای که ادمین با جست‌وجوی تگ این قلم رو پیدا می‌کنه
  // (چون فیزیکی به انبار/نمایندگی رسیده)، وزن و هزینه‌ی باربری‌ش رو هم از
  // روی برچسب/فاکتور شرکت باربری همون‌جا ثبت می‌کنه -- بعداً توی فرم «تعیین
  // هزینه ارسال» (AdminOrderActions) به‌عنوان مقدار پیش‌فرض همین قلم می‌آد
  weightGrams: z.number().int().positive().optional(),
  cargoCost: z.number().int().nonnegative().optional(),
});

// فاز دوم: کالا فیزیکی به انبار/نمایندگی رسیده -- ادمین (با جست‌وجوی همون تگِ
// فاز اول) نتیجه‌ی نهایی رو ثبت می‌کنه. «رسید» یعنی سالم بود، بقیه یعنی
// مشکلی بود و باید رفاند فوری بشه (با قیمت واقعیِ خریداری‌شده، اگه ثبت شده بود)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin("PURCHASING");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  if (item.purchaseStatus !== "PURCHASED") {
    return NextResponse.json(
      { error: "این عملیات فقط برای اقلامی که قبلاً خریداری‌شده علامت خورده‌اند ممکن است" },
      { status: 400 }
    );
  }

  const now = new Date();
  const isMismatch = AWAITING_DECISION_OUTCOMES.has(parsed.data.outcome);
  const isProblem = parsed.data.outcome !== "RECEIVED" && !isMismatch;
  const refundAmount = isProblem ? (item.purchasePriceActual ?? item.price) * item.quantity : 0;

  const { allArrivedMessage } = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: itemId },
      data: {
        // برای مغایرت (سایز/رنگ)، هنوز نتیجه‌ی نهایی مشخص نیست -- منتظر
        // تصمیم مشتری می‌مونیم؛ نوعِ مغایرت رو نگه می‌داریم تا اگه مشتری
        // رفاند رو ترجیح داد، وضعیتِ نهاییِ درست (نه یه برچسبِ عمومی) ثبت بشه
        purchaseStatus: isMismatch ? "AWAITING_CUSTOMER_DECISION" : parsed.data.outcome,
        mismatchOutcome: isMismatch ? parsed.data.outcome : null,
        purchaseNote: parsed.data.note ?? item.purchaseNote,
        purchaseResolvedAt: now,
        ...(parsed.data.weightGrams !== undefined ? { itemWeightGrams: parsed.data.weightGrams } : {}),
        ...(parsed.data.cargoCost !== undefined ? { itemCargoCost: parsed.data.cargoCost } : {}),
      },
    });

    if (refundAmount > 0) {
      await applyWalletTransaction(tx, {
        userId: order.userId,
        amount: refundAmount,
        type: "REFUND",
        description: `${OUTCOME_LABELS[parsed.data.outcome]}: قلم «${item.title}» از سفارش #${order.id.slice(-8)}`,
        orderId: order.id,
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: isMismatch
          ? `قلم «${item.title}» (تگ: ${item.purchaseTag}) با مغایرت رسید -- ${OUTCOME_LABELS[parsed.data.outcome]}${
              parsed.data.note ? `: ${parsed.data.note}` : ""
            } (منتظر تصمیم مشتری)`
          : isProblem
            ? `قلم «${item.title}» (تگ: ${item.purchaseTag}) -- ${OUTCOME_LABELS[parsed.data.outcome]}${
                parsed.data.note ? `: ${parsed.data.note}` : ""
              } (وجه به کیف پول بازگشت شد)`
            : `قلم «${item.title}» (تگ: ${item.purchaseTag}) سالم به انبار رسید`,
      },
    });

    // مغایرتِ هنوز حل‌نشده یعنی سفارش هنوز کامل نشده -- بررسیِ «همه رسید» فقط
    // برای نتیجه‌های واقعاً نهایی معنی داره
    const { message: allArrivedMessage } = isMismatch
      ? { message: null }
      : await notifyIfAllArrived(
          tx,
          order,
          order.items.map((i) => (i.id === itemId ? updatedItem : i))
        );

    return { allArrivedMessage };
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: isMismatch
        ? `کالای «${item.title}» از سفارش #${id.slice(-8)} با مغایرت رسید (${OUTCOME_LABELS[parsed.data.outcome]})${
            parsed.data.note ? `: ${parsed.data.note}` : ""
          } -- لطفاً توی صفحه‌ی سفارش مشخص کن که با همین مورد راضی هستی یا ترجیح می‌دی پولش برگردونیم`
        : isProblem
          ? `کالای «${item.title}» از سفارش #${id.slice(-8)} مشکل داشت (${OUTCOME_LABELS[parsed.data.outcome]}) -- وجهش به کیف پول بازگشت داده شد`
          : `خبر خوب! کالای «${item.title}» از سفارش #${id.slice(-8)} سالم به انبار ما رسید ✅`,
      link: `/orders/${id}`,
    },
  });

  if (allArrivedMessage) {
    await prisma.notification.create({
      data: { userId: order.userId, message: allArrivedMessage, link: `/orders/${id}` },
    });
  }

  return NextResponse.json({ ok: true });
}
