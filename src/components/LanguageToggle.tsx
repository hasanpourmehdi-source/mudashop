"use client";

import { useLang } from "@/components/LanguageProvider";
import { t, LANGS } from "@/lib/i18n";

// دکمه‌ی تغییر زبان (فارسی / انگلیسی / ترکی) -- برای نوار بالای هدر
const LANG_LABELS: Record<string, string> = { fa: "FA", en: "EN", tr: "TR" };

export function LanguageToggle() {
  const { lang, setLang } = useLang();

  function cycle() {
    const idx = LANGS.indexOf(lang);
    setLang(LANGS[(idx + 1) % LANGS.length]);
  }

  return (
    <button
      onClick={cycle}
      title={t(lang, "language")}
      aria-label={t(lang, "language")}
      className="flex items-center gap-1 hover:text-[var(--color-ochre)] transition-colors"
    >
      <span className="text-xs">{LANG_LABELS[lang]}</span>
    </button>
  );
}