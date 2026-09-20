"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";
import { AdminDefineCampaignFormula } from "@/components/AdminDefineCampaignFormula";
import { AdminHideCampaignToggle } from "@/components/AdminHideCampaignToggle";

// دو نشونه‌ی جداگانه برای اینکه دکمه‌ی «تعریفِ الگو» نشون داده بشه:
// ۱) اسمِ خامِ کمپین عدد داره -- مترجمِ کلمه‌به‌کلمه برای عدد/درصد قابلِ‌اعتماد
//    نیست (حتی اگه ظاهراً «کامل ترجمه شده» باشه، مثلِ «حدود %۵ تخفیف خورده» --
//    خروجی بی‌معنیه چون کلمه‌به‌کلمه بوده، نه بر اساسِ قالبِ واقعیِ جمله)
// ۲) بعدِ ترجمه هنوز یه دنباله‌ی حرفیِ لاتین/ترکیِ ۲+حرفی توی متن مونده (یعنی
//    نه فرمولی پوششش داده نه دیکشنری چیزی براش داشته، مثلِ «aPlus»)
// قبلاً فقط یکی از این دوتا (اول فقط عدد، بعد فقط کلمه‌ی ناشناخته) چک می‌شد
// که هرکدوم به‌تنهایی یه دسته از کمپین‌های ناقص رو قلم می‌نداخت
const HAS_DIGIT = /\d/;
const HAS_UNTRANSLATED_WORD = /[A-Za-zÇŞĞİÖÜçşğıöü]{2,}/;

// کارت‌های کمپینِ واقعیِ محصول -- عین چیدمانِ خودِ ترندیول («ÜRÜNÜN
// KAMPANYALARI»): آیکون + متن + فلش، نه روی خودِ عکس (اون فقط برای پوستر
// اینستاگرامه). به‌جای لینک مستقیم به ترندیول، به صفحه‌ی داخلیِ خودمون
// (`/marketplaces/[slug]/campaign/[campaignId]`) می‌رود -- همون فهرستِ کاملِ
// محصولاتِ این کمپین، فقط داخلِ خودِ سایت‌مون رندر شده
export function ProductCampaigns({
  badges,
  siteSlug,
  isAdmin,
}: {
  badges: {
    id: number;
    text: string;
    rawNameTr?: string;
    matchedFormula?: boolean;
    formulaId?: string | null;
    matchedPatternTr?: string | null;
    matchedTemplateFa?: string | null;
    sampleImages?: string[];
  }[];
  siteSlug: string;
  isAdmin: boolean;
}) {
  // طبقِ درخواستِ صریح: با تیک‌زدنِ «غیرفعال» کنارِ ترجمه، همون کمپین همین‌جا
  // (خوش‌بینانه، بدونِ صبر برای reload) کلاً از دید محو می‌شه -- سرور هم از
  // دفعه‌ی بعد (روی هر محصولی) دیگه اصلاً توی campaignBadges نمی‌فرستدش
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const visibleBadges = badges.filter((b) => !hiddenIds.has(b.id));

  if (visibleBadges.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-[var(--color-muted)] mb-2">کمپین‌های این محصول</p>
      <div className="flex flex-col gap-2">
        {visibleBadges.map((badge) => {
          const isShipping = badge.text.includes("ارسال");
          const images = badge.sampleImages ?? [];
          return (
            // بدونِ overflow-hidden -- وگرنه پاپ‌آپِ ویرایشِ ترجمه (که زیرِ کلمه
            // باز می‌شه، مثلاً روی «حدود») توسطِ همین overflow قطع/مخفی می‌شد.
            <div key={badge.id} className="border cut-line rounded-xl">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[var(--color-linen-dim)] transition-colors">
                <Link
                  href={`/marketplaces/${siteSlug}/campaign/${badge.id}?text=${encodeURIComponent(badge.text)}${
                    // rawNameTr هم پاس داده می‌شه -- طبقِ درخواستِ صریح، تا خودِ
                    // صفحه‌ی «محصولاتِ این کمپین» هم بتونه همون امکاناتِ ادمینِ
                    // ترجمه/تعریفِ الگو رو نشون بده (بدونِ این، rawNameTr خام
                    // اصلاً در دسترسِ اون صفحه نبود)
                    badge.rawNameTr ? `&rawNameTr=${encodeURIComponent(badge.rawNameTr)}` : ""
                  }`}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <span className="text-lg shrink-0">{isShipping ? "📦" : "🏷️"}</span>
                  <span className="flex-1 text-sm font-medium">
                    <AdminClickToTranslate text={badge.text} isAdmin={isAdmin} />
                  </span>
                  <span className="text-[var(--color-muted)]">‹</span>
                </Link>
                {/* طبقِ درخواستِ صریح -- کنارِ خودِ ترجمه، نه پایینِ کارت، تا با
                    فرمِ «تعریف/ویرایشِ الگو» اشتباه گرفته نشه */}
                {isAdmin && (
                  <AdminHideCampaignToggle
                    campaignId={badge.id}
                    rawNameTr={badge.rawNameTr ?? badge.text}
                    onHidden={() => setHiddenIds((prev) => new Set(prev).add(badge.id))}
                  />
                )}
              </div>
              {isAdmin && badge.rawNameTr && badge.matchedFormula && badge.formulaId && (
                // طبقِ درخواستِ صریح: برای کمپینی که فرمولش از قبل مچ شده،
                // ادمین باید بتونه همون‌جا سریع ویرایشش کنه، نه فقط از صفحه‌ی
                // جداگانه‌ی «فرمول‌های اسمِ کمپین»
                <div className="px-3 pb-2">
                  <AdminDefineCampaignFormula
                    rawNameTr={badge.rawNameTr}
                    formulaId={badge.formulaId}
                    initialPatternTr={badge.matchedPatternTr}
                    initialTemplateFa={badge.matchedTemplateFa}
                  />
                </div>
              )}
              {isAdmin &&
                badge.rawNameTr &&
                !badge.matchedFormula &&
                (HAS_DIGIT.test(badge.rawNameTr) || HAS_UNTRANSLATED_WORD.test(badge.text)) && (
                <div className="px-3 pb-2">
                  <AdminDefineCampaignFormula rawNameTr={badge.rawNameTr} />
                </div>
              )}
              {/* عکسِ نمونه فقط برای کمپین‌های چندمحصولی (مثلِ «۴ بگیر ۳ پرداخت
                  کن») جمع می‌شه -- کمپین‌های تخفیفِ سبدخرید عکسی ندارن، دقیقاً
                  مثلِ خودِ صفحه‌ی ترندیول */}
              {images.length > 0 && (
                <div className="flex gap-1.5 px-3 pb-2.5 pt-1">
                  {images.map((src, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={src}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[var(--color-linen-dim)]"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
