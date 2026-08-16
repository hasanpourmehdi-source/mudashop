"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mudashop-install-dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-xs z-50 border-2 cut-line rounded-xl bg-white p-4 shadow-lg flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">نصب مُداشاپ</p>
        <p className="text-xs text-[var(--color-muted)]">
          برای دسترسی سریع‌تر، اپ رو روی صفحه اصلی نصب کن.
        </p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={handleInstall}
          className="bg-[var(--color-wine)] text-white text-xs font-medium px-3 py-1.5 rounded-full"
        >
          نصب
        </button>
        <button onClick={handleDismiss} className="text-[10px] text-[var(--color-muted)]">
          بعداً
        </button>
      </div>
    </div>
  );
}
