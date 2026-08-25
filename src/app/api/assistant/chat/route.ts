import { NextResponse } from "next/server";
import { buildAssistantResponse } from "@/lib/shoppingAssistant";
import { z } from "zod";

const schema = z.object({ message: z.string().min(1).max(500) });

// دستیارِ خریدِ فروشگاه -- بدون نیاز به لاگین (مثل جستجوی عادی سایت)
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "پیام نامعتبر است" }, { status: 400 });
  }

  const { reply, products } = await buildAssistantResponse(parsed.data.message);
  return NextResponse.json({ reply, products });
}
