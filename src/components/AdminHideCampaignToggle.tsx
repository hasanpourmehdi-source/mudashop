"use client";

import { useState } from "react";

// تیکِ «غیرفعال» کنارِ ترجمه‌ی هر کمپین -- طبقِ درخواستِ صریح، با تیک‌زدن این
// کمپینِ خاص (بر اساسِ campaignId، نه فقط توی همین محصول) دیگه هیچ‌جا نشون
// داده نمی‌شه. state خوش‌بینانه‌ست: همین‌جا (این محصول، همین بازدید) بلافاصله
// مخفی می‌شه، بدونِ صبر برای پاسخِ سرور -- چون این یه اقدامِ یک‌طرفه‌ست (فقط
// مخفی‌کردن، نه برعکس از همین‌جا) ریسکِ خاصی نداره
export function AdminHideCampaignToggle({
  campaignId,
  rawNameTr,
  onHidden,
}: {
  campaignId: number;
  rawNameTr: string;
  onHidden: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    setSaving(true);
    onHidden();
    try {
      await fetch("/api/admin/trendyol-hidden-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, rawNameTr }),
      });
    } catch {
      // best-effort -- اگه fail بشه، دفعه‌ی بعد که همین کمپین دیده بشه بازم
      // چک‌باکس هست و می‌شه دوباره امتحان کرد
    }
  }

  return (
    <label
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--color-muted)] cursor-pointer whitespace-nowrap"
      title="این کمپین رو همیشه (روی همه‌ی محصولات) مخفی کن"
    >
      <input type="checkbox" disabled={saving} onChange={handleChange} />
      غیرفعال
    </label>
  );
}
