"use client";

import { useState } from "react";

// دکمه‌ی کپیِ کدِ کوپن -- الگوی کپیِ کلیپ‌بورد عیناً از AdminOriginalTitleCopy،
// فقط بدونِ محدودیتِ فقط-ادمین (این دکمه برای هر مشتری قابل‌دیدنه)
export function CopyCouponCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // بی‌اهمیت -- خودِ کدِ متن روی صفحه هست و قابلِ انتخاب‌ودستیِ دستیه
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      dir="ltr"
      className="font-mono text-sm font-bold border-2 border-dashed border-[var(--color-wine)] text-[var(--color-wine)] rounded-lg px-3 py-1.5 hover:bg-[var(--color-wine)]/10 transition-colors"
    >
      {copied ? "کپی شد ✓" : code}
    </button>
  );
}
