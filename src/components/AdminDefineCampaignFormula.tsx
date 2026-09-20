"use client";

import { useState } from "react";

// از روی اسمِ خامِ ترکی، یه پیشنهادِ الگو می‌سازه -- هر عددِ داخلش رو با
// {1},{2},... جایگزین می‌کنه، چون این دقیقاً همون چیزیه که ادمین باید توی
// فرمِ «فرمول‌های اسمِ کمپینِ ترندیول» وارد کنه؛ فقط کافیه قالبِ فارسی رو بنویسه
function suggestPatternFromRawName(raw: string): string {
  let n = 0;
  return raw.replace(/\d+/g, () => `{${++n}}`);
}

// وقتی مترجمِ کلمه‌به‌کلمه/فرمول‌ها نتونستن اسمِ یه کمپین رو کامل ترجمه کنن
// (هنوز کلمه‌ی لاتین/ترکی توش مونده)، فقط برای ادمین یه دکمه‌ی «تعریفِ الگو»
// نشون داده می‌شه -- کلیک روی دکمه یه فرمِ کوچیک با الگوی پیشنهادیِ آماده باز
// می‌کنه، ادمین فقط قالبِ فارسی رو می‌نویسه و مستقیم به «فرمول‌های اسمِ
// کمپینِ ترندیول» اضافه می‌شه؛ از دفعه‌ی بعد که این کمپین دیده بشه، خودکار اعمال می‌شه.
//
// همینِ کامپوننت حالتِ ویرایش هم داره (وقتی formulaId داده بشه): طبقِ درخواستِ
// صریح، برای کمپینی که از قبل فرمولش مچ شده، ادمین باید بتونه همون‌جا (کنارِ
// خودِ بجِ کمپین، نه فقط از صفحه‌ی جداگانه‌ی «فرمول‌ها») سریع ویرایشش کنه --
// همون فرم، فقط PATCH به‌جای POST، و مقادیرِ اولیه از فرمولِ ازقبل‌مچ‌شده
export function AdminDefineCampaignFormula({
  rawNameTr,
  formulaId,
  initialPatternTr,
  initialTemplateFa,
}: {
  rawNameTr: string;
  formulaId?: string | null;
  initialPatternTr?: string | null;
  initialTemplateFa?: string | null;
}) {
  const isEditMode = !!formulaId;
  const [open, setOpen] = useState(false);
  const [patternTr, setPatternTr] = useState(
    () => initialPatternTr ?? suggestPatternFromRawName(rawNameTr)
  );
  const [templateFa, setTemplateFa] = useState(initialTemplateFa ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (saved) {
    return (
      <p className="text-[10px] text-emerald-700 mt-1">
        {isEditMode ? "الگو به‌روزرسانی شد ✓" : "الگو ذخیره شد -- از دفعه‌ی بعد اعمال می‌شه ✓"}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-[10px] text-[var(--color-ochre)] hover:underline mt-1"
      >
        {isEditMode ? "✏️ ویرایشِ الگو" : "🔧 این اسمِ کمپین کامل ترجمه نشده -- تعریفِ الگو"}
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!templateFa.trim() || !patternTr.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(
      isEditMode ? `/api/admin/trendyol-campaign-formulas/${formulaId}` : "/api/admin/trendyol-campaign-formulas",
      {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternTr, templateFa }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ذخیره‌سازی");
      return;
    }
    setSaved(true);
  }

  return (
    <form
      onClick={(e) => e.stopPropagation()}
      onSubmit={submit}
      className="mt-1 border cut-line rounded-lg p-2 bg-[var(--color-linen-dim)]/40 space-y-1.5"
    >
      <p dir="ltr" className="text-left text-[10px] text-[var(--color-muted)]">
        {rawNameTr}
      </p>
      <input
        value={patternTr}
        onChange={(e) => setPatternTr(e.target.value)}
        dir="ltr"
        className="w-full border cut-line rounded-lg px-2 py-1 text-[10px] font-mono text-left"
      />
      <input
        value={templateFa}
        onChange={(e) => setTemplateFa(e.target.value)}
        placeholder="قالبِ فارسی -- مثلاً خرید {1}م ٪{2} تخفیف"
        required
        className="w-full border cut-line rounded-lg px-2 py-1 text-[10px]"
      />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-[10px] bg-[var(--color-wine)] text-white px-2.5 py-1 rounded-full disabled:opacity-50"
        >
          {saving ? "..." : "ذخیره"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="text-[10px] text-[var(--color-muted)]"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}
