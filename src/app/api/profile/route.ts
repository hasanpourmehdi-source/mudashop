import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  phone: z.string().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { name, phone } = parsed.data;

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name, phone: phone || null },
    });
    return NextResponse.json({ id: user.id, name: user.name, phone: user.phone });
  } catch {
    return NextResponse.json(
      { error: "این شماره موبایل قبلاً برای حساب دیگری ثبت شده است" },
      { status: 409 }
    );
  }
}
