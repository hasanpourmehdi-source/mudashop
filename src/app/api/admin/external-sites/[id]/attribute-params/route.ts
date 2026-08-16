import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  attributeId: z.string().min(1, "ویژگی الزامی است"),
  // خالی/نال یعنی قالب عمومی (روی هر مقداری اعمال می‌شه، مثل سایز)
  value: z.string().nullable().optional(),
  paramTemplate: z.string().min(1, "پارامتر الزامی است (مثلاً wg=2 یا group-{value})"),
  // وقتی چندتا ویژگی باید زیر یه کلید مشترک ترکیب بشن (مثلاً "vr=size|") -- در
  // این حالت paramTemplate فقط بخش تبدیل مقداره، نه کل پارامتر
  sharedKey: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id: siteId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const value = parsed.data.value || null;
  const attributeId = parsed.data.attributeId;
  const sharedKey = parsed.data.sharedKey || null;

  try {
    let created;
    if (value === null) {
      // وقتی value برابر null باشه (قالب عمومی)، نمی‌شه از upsert با کلید
      // ترکیبی siteId_attributeId_value استفاده کرد -- Prisma این‌طور موارد
      // رو رد می‌کنه چون NULL توی SQL هیچ‌وقت با NULL دیگه برابر نیست، پس
      // برای پیداکردن ردیف موجود دستی findFirst می‌زنیم
      const existing = await prisma.externalSiteAttributeParam.findFirst({
        where: { siteId, attributeId, value: null },
      });
      created = existing
        ? await prisma.externalSiteAttributeParam.update({
            where: { id: existing.id },
            data: { paramTemplate: parsed.data.paramTemplate, sharedKey },
            include: { attribute: { select: { id: true, name: true } } },
          })
        : await prisma.externalSiteAttributeParam.create({
            data: { siteId, attributeId, value: null, paramTemplate: parsed.data.paramTemplate, sharedKey },
            include: { attribute: { select: { id: true, name: true } } },
          });
    } else {
      created = await prisma.externalSiteAttributeParam.upsert({
        where: { siteId_attributeId_value: { siteId, attributeId, value } },
        update: { paramTemplate: parsed.data.paramTemplate, sharedKey },
        create: { siteId, attributeId, value, paramTemplate: parsed.data.paramTemplate, sharedKey },
        include: { attribute: { select: { id: true, name: true } } },
      });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("خطا در ذخیره‌ی پارامتر ویژگی:", err);
    return NextResponse.json(
      { error: `خطا در ذخیره‌سازی: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }
}
