import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAssistantResponse } from "@/lib/shoppingAssistant";
import { z } from "zod";

const schema = z.object({ message: z.string().min(1).max(500) });

// دستیارِ خریدِ فروشگاه -- بدون نیاز به لاگین (مثل جستجوی عادی سایت)؛ فقط
// سوالِ «سفارشم کجاست» نیازِ لاگین داره (توی buildAssistantResponse چک می‌شه)
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "پیام نامعتبر است" }, { status: 400 });
  }

  const session = await auth();
  const { reply, products, orders } = await buildAssistantResponse(parsed.data.message, session?.user?.id);
  return NextResponse.json({ reply, products, orders });
}
