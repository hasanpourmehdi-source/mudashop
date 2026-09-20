"use client";

import { useState } from "react";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";
import { AdminDefineCampaignFormula } from "@/components/AdminDefineCampaignFormula";
import { AdminHideCampaignToggle } from "@/components/AdminHideCampaignToggle";

// همون دو نشونه‌ی موجود توی ProductCampaigns.tsx برای نمایشِ دکمه‌ی «تعریفِ
// الگو» -- عمداً همینجا هم تکرار شده (نه import از اونجا) چون ProductCampaigns
// دیگه این ثابت‌ها رو export نمی‌کنه؛ اگه بعداً جای سوم هم لازم شد، بهتره
// مشترک بشه
const HAS_DIGIT = /\d/;
const HAS_UNTRANSLATED_WORD = /[A-Za-zÇŞĞİÖÜçşğıöü]{2,}/;

// طبقِ درخواستِ صریح: صفحه‌ی «محصولاتِ این کمپین» (که با کلیک روی هر بجِ
// کمپین باز می‌شه) هم باید همون امکاناتِ ادمین رو داشته باشه که خودِ بج
// (توی ProductCampaigns) داره -- ترجمه‌ی کلمه‌به‌کلمه، تعریف/ویرایشِ الگو، و
// تیکِ «غیرفعال»
export function ProductCampaignHeader({
  text,
  campaignId,
  rawNameTr,
  isAdmin,
  matchedFormula,
  formulaId,
  matchedPatternTr,
  matchedTemplateFa,
}: {
  text: string;
  campaignId: number;
  rawNameTr: string | null;
  isAdmin: boolean;
  matchedFormula: boolean;
  formulaId: string | null;
  matchedPatternTr: string | null;
  matchedTemplateFa: string | null;
}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <p className="mb-6 text-sm text-[var(--color-muted)]">
        این کمپین مخفی شد -- از این به بعد هیچ‌جا نشون داده نمی‌شه.
      </p>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl shrink-0">🏷️</span>
        <h1 className="text-xl font-bold flex-1 min-w-0">
          <AdminClickToTranslate text={text} isAdmin={isAdmin} />
        </h1>
        {isAdmin && (
          <AdminHideCampaignToggle
            campaignId={campaignId}
            rawNameTr={rawNameTr ?? text}
            onHidden={() => setHidden(true)}
          />
        )}
      </div>
      {isAdmin && rawNameTr && matchedFormula && formulaId && (
        <div className="mt-1">
          <AdminDefineCampaignFormula
            rawNameTr={rawNameTr}
            formulaId={formulaId}
            initialPatternTr={matchedPatternTr}
            initialTemplateFa={matchedTemplateFa}
          />
        </div>
      )}
      {isAdmin &&
        rawNameTr &&
        !matchedFormula &&
        (HAS_DIGIT.test(rawNameTr) || HAS_UNTRANSLATED_WORD.test(text)) && (
          <div className="mt-1">
            <AdminDefineCampaignFormula rawNameTr={rawNameTr} />
          </div>
        )}
    </div>
  );
}
