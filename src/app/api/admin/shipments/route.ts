import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

// محموله‌های ترکیبی (خریدِ گروهی/تجمیعِ مرسوله) -- چند قلمِ خریداری‌شده (احتمالاً
// از سفارش‌های مختلف) که با هم وزن‌کشی/ارسال می‌شن، برای تقسیمِ هزینه‌ی باربری
// بر اساس وزن به‌جای این‌که هر سفارش هزینه‌ی کامل و جدا بپردازد.
export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          id: true,
          title: true,
          itemWeightGrams: true,
          itemCargoCost: true,
          orderId: true,
          order: { select: { id: true, user: { select: { name: true, email: true } } } },
        },
      },
    },
  });
  return NextResponse.json(shipments);
}

const createSchema = z.object({ label: z.string().max(200).optional() });

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const shipment = await prisma.shipment.create({ data: { label: parsed.data.label } });
  return NextResponse.json(shipment, { status: 201 });
}
