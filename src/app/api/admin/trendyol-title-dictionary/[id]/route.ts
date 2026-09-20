import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import {
  invalidateTitleDictionaryCache,
  invalidateTitleCacheForTerm,
  bumpDictionaryVersion,
} from "@/lib/trendyolTitleTranslation";
import { refreshUntranslatedRowsContaining } from "@/lib/trendyolTranslationDictionary";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const data: Prisma.TrendyolTitleTermDictionaryUpdateInput = {};
  if (typeof body.termFa === "string") data.termFa = body.termFa.trim();
  if (typeof body.priority === "number") data.priority = body.priority;
  if (typeof body.noTranslationNeeded === "boolean") data.noTranslationNeeded = body.noTranslationNeeded;

  try {
    const updated = await prisma.trendyolTitleTermDictionary.update({ where: { id }, data });
    invalidateTitleDictionaryCache();
    await bumpDictionaryVersion();
    // termTr خودِ ردیف (نه ورودی body) رو برای invalidate استفاده می‌کنیم چون
    // termTr هیچ‌وقت از این مسیر ویرایش نمی‌شه (فقط termFa/priority) -- پس
    // updated.termTr همیشه دقیقاً همون اصطلاحیه که باید عنوان‌های مرتبطش رو پاک کنیم
    await invalidateTitleCacheForTerm(updated.termTr);
    await refreshUntranslatedRowsContaining(updated.termTr, updated.termFa);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "ردیف پیدا نشد یا خطا در ذخیره‌سازی" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.trendyolTitleTermDictionary.delete({ where: { id } });
    invalidateTitleDictionaryCache();
    await bumpDictionaryVersion();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "ردیف پیدا نشد یا خطا در حذف" }, { status: 400 });
  }
}
