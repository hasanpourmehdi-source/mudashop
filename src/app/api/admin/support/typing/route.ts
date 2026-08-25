import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { publishUserEvent } from "@/lib/chatBus";
import { z } from "zod";

const schema = z.object({
  userId: z.string().min(1),
  typing: z.boolean(),
});

// ادمین دارد تایپ می‌کند -- رویداد لحظه‌ای به مشتریِ همان مکالمه (ذخیره نمی‌شود)
export async function POST(req: Request) {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }

  publishUserEvent(parsed.data.userId, {
    type: "typing",
    userId: parsed.data.userId,
    sender: "ADMIN",
    typing: parsed.data.typing,
  });
  return NextResponse.json({ ok: true });
}