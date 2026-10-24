import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError } from "@/lib/errorLog";
import { rateLimitOrNull } from "@/lib/rateLimit";

const schema = z.object({
  message: z.string().min(1),
  stack: z.string().optional(),
  path: z.string().optional(),
});

// خطاهای رندرِ سمتِ کلاینت (از global-error.tsx) رو اینجا می‌فرستیم تا با همون
// جدول/پنلِ خطاهای سمتِ سرور یکی بشه -- بدون احراز هویت (چون دقیقاً همین‌جاست
// که ممکنه session هم خراب شده باشه)، پس عمداً حداقلیه؛ ولی چون بدونِ احرازِ
// هویت توی دیتابیس می‌نویسه، سقفِ تعداد به‌ازای هر IP داره
export async function POST(req: Request) {
  if (rateLimitOrNull(req, "CLIENT_ERROR_LOG")) return NextResponse.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await logServerError({
    message: parsed.data.message,
    stack: parsed.data.stack,
    context: { path: parsed.data.path },
    source: "CLIENT",
  });

  return NextResponse.json({ ok: true });
}
