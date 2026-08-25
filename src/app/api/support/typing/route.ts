import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { publishAdminEvent } from "@/lib/chatBus";
import { z } from "zod";

const schema = z.object({
  typing: z.boolean(),
});

// مشتری دارد تایپ می‌کند -- فقط یک رویداد لحظه‌ای به ادمین (ذخیره نمی‌شود)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });
  }

  publishAdminEvent({ type: "typing", userId: session.user.id, sender: "CUSTOMER", typing: parsed.data.typing });
  return NextResponse.json({ ok: true });
}