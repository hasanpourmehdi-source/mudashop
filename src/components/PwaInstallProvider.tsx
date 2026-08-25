"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mudashop-install-dismissed";

type PwaInstallContextValue = {
  canPrompt: boolean;
  promptInstall: () => void;
  showInstructions: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) throw new Error("usePwaInstall باید داخل PwaInstallProvider استفاده شود");
  return ctx;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

// مدیریت نصب PWA: بنر خودکار (قبل از beforeinstallprompt) + دکمه‌ی دائمی نصب +
// راهنمای نصب دستی برای iOS که رویداد beforeinstallprompt ندارد
export function PwaInstallProvider({ children }: { children?: ReactNode }) {
  const { lang } = useLang();
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [instructionsVisible, setInstructionsVisible] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
      if (!localStorage.getItem(DISMISS_KEY)) setBannerVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function doPrompt() {
    const ev = deferred.current;
    if (!ev) {
      // مرورگر رویداد نصب ندارد (مثلاً iOS) -- راهنما را نشان بده
      setInstructionsVisible(true);
      return;
    }
    await ev.prompt();
    await ev.userChoice;
    deferred.current = null;
    setCanPrompt(false);
    setBannerVisible(false);
  }

  const promptInstall = () => {
    void doPrompt();
  };

  const showInstructions = () => setInstructionsVisible(true);

  return (
    <PwaInstallContext.Provider value={{ canPrompt, promptInstall, showInstructions }}>
      {children}

      {bannerVisible && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-xs z-50 border-2 cut-line rounded-xl bg-white p-4 shadow-lg flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t(lang, "installNow")} مُداشاپ</p>
            <p className="text-xs text-[var(--color-muted)]">{t(lang, "installAppHint")}</p>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={promptInstall}
              className="bg-[var(--color-wine)] text-white text-xs font-medium px-3 py-1.5 rounded-full"
            >
              {t(lang, "installNow")}
            </button>
            <button
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, "1");
                setBannerVisible(false);
              }}
              className="text-[10px] text-[var(--color-muted)]"
            >
              {t(lang, "later")}
            </button>
          </div>
        </div>
      )}

      {instructionsVisible && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setInstructionsVisible(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full border-2 cut-line"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">{t(lang, "howToInstallTitle")}</h3>
            <ol className="text-sm text-[var(--color-muted)] space-y-2 list-decimal list-inside mb-4">
              {isIOS() ? (
                <>
                  <li>
                    کلید اشتراک‌گذاری را در مرورگر بزن (آیکون مربع با پیکان).
                  </li>
                  <li>گزینه‌ی «افزودن به صفحه‌ی اصلی» را انتخاب کن.</li>
                  <li>روی «افزودن» بزن تا مُداشاپ روی صفحه‌ی اصلی نصب شود.</li>
                </>
              ) : (
                <>
                  <li>گزینه‌ی «نصب» را از منوی مرورگر انتخاب کن.</li>
                  <li>در پنجره‌ی بازشده «نصب» را بزن.</li>
                </>
              )}
            </ol>
            <button
              onClick={() => setInstructionsVisible(false)}
              className="bg-[var(--color-wine)] text-white text-sm font-medium px-5 py-2 rounded-full"
            >
              {t(lang, "close")}
            </button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  );
}