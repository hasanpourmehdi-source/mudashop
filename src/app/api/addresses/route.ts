import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addressSchema = z.object({
  title: z.string().min(1, "عنوان آدرس الزامی است"),
  fullName: z.string().min(2, "نام گیرنده باید حداقل ۲ حرف باشد"),
  phone: z.string().min(8, "شماره تماس معتبر نیست"),
  province: z.string().min(1, "استان الزامی است"),
  city: z.string().min(1, "شهر الزامی است"),
  postalCode: z.string().min(5, "کد پستی معتبر نیست"),
  detail: z.string().min(3, "آدرس کامل الزامی است"),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(addresses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  // اگر این آدرس پیش‌فرض باشه، بقیه آدرس‌های کاربر رو از پیش‌فرض خارج کن
  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(address, { status: 201 });
}
