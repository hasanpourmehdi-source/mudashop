import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email() });

// بعد از شکستِ signIn، next-auth v5 پیام دقیقِ throw شده توی authorize رو به
// کلاینت نمی‌ده (فقط یه کد عمومی مثل "Configuration")، پس این endpoint جدا
// فقط می‌گه «الان قفله یا نه» تا صفحه‌ی ورود بتونه پیام درست رو نشون بده.
// عمداً چیز دیگه‌ای (وجود ایمیل، مسدودبودن و...) فاش نمی‌کنه.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ locked: false });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { lockedUntil: true },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return NextResponse.json({ locked: true, minutesLeft });
  }

  return NextResponse.json({ locked: false });
}
