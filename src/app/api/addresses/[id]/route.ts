import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1, "عنوان آدرس الزامی است").optional(),
  fullName: z.string().min(2, "نام گیرنده باید حداقل ۲ حرف باشد").optional(),
  phone: z.string().min(8, "شماره تماس معتبر نیست").optional(),
  province: z.string().min(1, "استان الزامی است").optional(),
  city: z.string().min(1, "شهر الزامی است").optional(),
  postalCode: z.string().min(5, "کد پستی معتبر نیست").optional(),
  detail: z.string().min(3, "آدرس کامل الزامی است").optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;

  // IDOR-safe: فقط اگه آدرس متعلق به همین کاربر باشه ویرایش می‌شه
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "آدرس یافت نشد" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  if (parsed.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({ where: { id }, data: parsed.data });
  return NextResponse.json(address);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const { id } = await params;

  // IDOR-safe: فقط اگه آدرس متعلق به همین کاربر باشه حذف می‌شه
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== session.user.id) {
    return NextResponse.json({ error: "آدرس یافت نشد" }, { status: 404 });
  }

  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
