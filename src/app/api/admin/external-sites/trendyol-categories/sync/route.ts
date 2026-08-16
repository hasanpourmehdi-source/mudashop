import { NextResponse } from "next/server";
import type { ExternalSiteKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchTrendyolNavCategories, flattenTrendyolNavCategories } from "@/lib/trendyolNavCategories";
import { suggestTranslation } from "@/lib/trendyolTranslationDictionary";

// «به‌روزرسانی از یه آدرس»: منوی ناوبری واقعی ترندیول رو از آدرسی که خودِ
// ادمین می‌ده می‌گیره (دیگه هیچ آدرس پیش‌فرض ثابتی نداریم -- چون بعداً ممکنه
// آدرس trendyol-milla.com هم داده بشه) و توی جدول محلی TrendyolCategoryCache
// می‌ریزه. کلید یکتا اینجا "path"ه (نه param)، چون چندتا مسیر متفاوت (مثلا
// "Kadın > Giyim" و "Anne & Çocuk > Erkek Çocuk") می‌تونن کاملاً مشروع به یه
// wc= مشترک اشاره کنن -- اگه param یکتا بود، یکیشون بقیه رو بازنویسی می‌کرد.
// برای ردیف‌های موجود فقط nameTr/param آپدیت می‌شن -- nameFa (ترجمه) هیچ‌وقت
// این‌جا دست نمی‌خوره. برای ردیف‌های تازه، اگه فرهنگ‌لغت داخلی یه مطابقت دقیق
// پیدا کنه، همون‌جا با nameFaSuggested=true پر می‌شه؛ وگرنه با nameFa خالی
// ساخته می‌شه تا ادمین یا import گروهی پرش کنه.
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  let url = "";
  try {
    const body = await request.json();
    if (typeof body?.url === "string") url = body.url.trim();
  } catch {
    // بدنه خالی/نامعتبر بود -- پایین‌تر با پیام روشن رد می‌شه
  }

  if (!url) {
    return NextResponse.json({ error: "آدرس ترندیول رو وارد کن" }, { status: 400 });
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "آدرس وارد شده معتبر نیست" }, { status: 400 });
  }
  if (!/(^|\.)(trendyol\.(com|sa|ae)|trendyol-milla\.com)$/.test(hostname)) {
    return NextResponse.json(
      { error: "فقط آدرس‌های trendyol.com/sa/ae یا trendyol-milla.com مجازن" },
      { status: 400 }
    );
  }
  // ترندیول و میلا دو کاتالوگ کاملاً جدا هستن -- همون هاست‌نیمی که همین بالا
  // اعتبارسنجی شد، مشخص می‌کنه این sync برای کدوم سایت ثبت بشه
  const site: ExternalSiteKind = hostname.includes("trendyol-milla") ? "TRENDYOL_MILLA" : "TRENDYOL";

  try {
    const tree = await fetchTrendyolNavCategories(url);
    const flat = flattenTrendyolNavCategories(tree);

    if (flat.length === 0) {
      return NextResponse.json(
        { error: "هیچ دسته‌بندی‌ای با پارامتر قابل‌استخراج توی منوی ترندیول پیدا نشد" },
        { status: 502 }
      );
    }

    const existingPaths = new Set(
      (await prisma.trendyolCategoryCache.findMany({ where: { site }, select: { path: true } })).map((r) => r.path)
    );

    // suggestTranslation حالا async‌ه (از همون دیکشنری مشترک عنوان محصولات
    // می‌خونه) -- باید قبل از ساختن batchِ تراکنش، همه‌ی پیشنهادها از قبل
    // resolve بشن (چون map داخل $transaction نمی‌تونه async باشه)
    const suggestionByPath = new Map<string, string | null>();
    for (const node of flat) {
      if (!existingPaths.has(node.path)) {
        suggestionByPath.set(node.path, await suggestTranslation(node.name));
      }
    }

    let inserted = 0;
    let updated = 0;
    let autoSuggested = 0;
    for (const node of flat) {
      if (existingPaths.has(node.path)) {
        updated++;
      } else {
        inserted++;
        if (suggestionByPath.get(node.path) !== null) autoSuggested++;
      }
    }

    // همه‌ی upsertها رو دسته‌دسته (نه یه تراکنش غول‌پیکر واحد) انجام می‌دیم --
    // هر دسته (۲۰۰ تایی) توی تراکنش خودش می‌ره؛ سرعتِ تراکنش رو حفظ می‌کنه ولی
    // قفل کوتاه‌تره (طبق تجربه‌ی قبلی: createMany با skipDuplicates روی
    // SQLite ساپورت نمی‌شه، پس چاره‌ای جز upsert تکی نیست)
    const BATCH_SIZE = 200;
    for (let i = 0; i < flat.length; i += BATCH_SIZE) {
      const batch = flat.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((node) => {
          const suggested = existingPaths.has(node.path) ? null : suggestionByPath.get(node.path) ?? null;
          return prisma.trendyolCategoryCache.upsert({
            where: { site_path: { site, path: node.path } },
            update: { nameTr: node.name, param: node.param },
            create: {
              site,
              path: node.path,
              param: node.param,
              nameTr: node.name,
              nameFa: suggested,
              nameFaSuggested: suggested !== null,
            },
          });
        })
      );
    }

    return NextResponse.json({ total: flat.length, inserted, updated, autoSuggested });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در همگام‌سازی دسته‌بندی‌های ترندیول";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
