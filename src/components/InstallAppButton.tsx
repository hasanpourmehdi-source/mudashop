"use client";

import { usePwaInstall } from "@/components/PwaInstallProvider";
import { useLang } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

// دکمه‌ی دائمی «نصب اپ» -- اگر رویداد نصب در دسترس باشد prompt می‌کند، وگرنه
// راهنمای نصب دستی (iOS و...) را باز می‌کند
export function InstallAppButton({ className = "" }: { className?: string }) {
  const { promptInstall } = usePwaInstall();
  const { lang } = useLang();

  return (
    <button onClick={promptInstall} className={`flex items-center gap-1 ${className}`}>
      <span aria-hidden>⬇</span>
      <span>{t(lang, "installApp")}</span>
    </button>
  );
}