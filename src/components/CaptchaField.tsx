"use client";

import { useEffect, useState } from "react";

export type CaptchaValue = { captchaId: string; captchaAnswer: string };

export function CaptchaField({
  value,
  onChange,
  onRefresh,
}: {
  value: CaptchaValue;
  onChange: (v: CaptchaValue) => void;
  onRefresh?: () => void;
}) {
  const [question, setQuestion] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/captcha", { cache: "no-store" });
      const data = await res.json();
      setQuestion(data.question ?? "");
      onChange({ captchaId: data.id ?? "", captchaAnswer: "" });
      onRefresh?.();
    } catch {
      setQuestion("خطا در بارگذاری کپچا");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">کد امنیتی</label>
      <div className="flex gap-2 items-center">
        <span className="flex-1 bg-[var(--color-linen-dim)] rounded-lg px-3 py-2.5 text-sm font-medium min-h-[42px] flex items-center">
          {loading ? "در حال بارگذاری..." : question}
        </span>
        <button
          type="button"
          onClick={load}
          aria-label="کپچای جدید"
          title="کپچای جدید"
          className="shrink-0 w-10 h-10 border cut-line rounded-lg bg-white flex items-center justify-center hover:bg-[var(--color-linen-dim)] transition-colors"
        >
          ↻
        </button>
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9۰-۹٠-٩]*"
        required
        value={value.captchaAnswer}
        onChange={(e) => onChange({ captchaId: value.captchaId, captchaAnswer: e.target.value })}
        placeholder="پاسخ را به عدد وارد کنید"
        className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
      />
    </div>
  );
}
