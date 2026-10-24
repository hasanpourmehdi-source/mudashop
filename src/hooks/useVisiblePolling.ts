"use client";

import { useEffect, useRef, useState } from "react";

// پولینگی که وقتی تبِ مرورگر پنهانه (تبِ پس‌زمینه، گوشیِ قفل، اپِ دیگه) متوقف
// می‌شه و با برگشتنِ کاربر یه بار فوراً اجرا و دوباره شروع می‌شه -- روی ورسل هر
// درخواست یه اجرای فانکشن + کوئریِ دیتابیسه، و تب‌های باز‌مونده‌ی پس‌زمینه بیشترِ
// این درخواست‌ها رو بی‌فایده می‌سوزوندن
export function useVisiblePolling(
  fn: () => void,
  intervalMs: number,
  { enabled = true, runImmediately = true }: { enabled?: boolean; runImmediately?: boolean } = {},
) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fnRef.current();
        start();
      } else {
        stop();
      }
    };
    if (runImmediately) fnRef.current();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, runImmediately]);
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
