import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveReferrerId } from "@/lib/referral";
import { sendVerificationEmail } from "@/lib/emailVerification";

const registerSchema = z.object({
  name: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  phone: z.string().optional(),
  referralCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
        { status: 400 }
      );
    }

    const { name, email, password, phone, referralCode } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !existing.isGuest) {
      return NextResponse.json(
        { error: "این ایمیل قبلاً ثبت‌نام کرده است" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    // اگه این ایمیل قبلاً از «خریدِ مهمان» یه کاربرِ سایه‌ای داشته، همون رو به
    // یه حسابِ واقعی ارتقا می‌دیم (نه یه ردیفِ تازه) تا تاریخچه‌ی سفارش‌های
    // مهمانش حفظ بمونه
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name, password: hashed, phone: phone ?? existing.phone, isGuest: false },
        })
      : await prisma.user.create({
          data: { name, email, password: hashed, phone, referredById: await resolveReferrerId(referralCode, email) },
        });

    await sendVerificationEmail({ userId: user.id, email: user.email, name: user.name }).catch(() => {});

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
