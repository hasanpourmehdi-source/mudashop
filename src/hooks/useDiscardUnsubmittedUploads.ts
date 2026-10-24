"use client";

import { useEffect, useRef } from "react";
import { discardUploads } from "@/lib/directUpload";

// عکس/ویدیوی نظر موقعِ انتخاب آپلود می‌شه، نه موقعِ ثبت. اگه کاربر صفحه رو ببنده/ترک
// کنه (یا فرم بسته بشه) بدونِ ثبتِ نظر، همون فایل‌ها همون لحظه از Blob پاک می‌شن.
// onDiscarded: لیستِ فایل‌های فرم رو خالی کنه -- اگه صفحه از bfcache برگرده، فرم عکسی
// رو نشون نده که دیگه وجود نداره. setSubmitting(true) جلوی پاک‌شدن وسطِ ثبت رو می‌گیره
export function useDiscardUnsubmittedUploads(urls: string[], onDiscarded: () => void) {
  const urlsRef = useRef(urls);
  const onDiscardedRef = useRef(onDiscarded);
  const submittingRef = useRef(false);

  useEffect(() => {
    urlsRef.current = urls;
    onDiscardedRef.current = onDiscarded;
  });

  useEffect(() => {
    const flush = () => {
      if (submittingRef.current || urlsRef.current.length === 0) return;
      discardUploads(urlsRef.current, { beacon: true });
      urlsRef.current = [];
      onDiscardedRef.current();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return {
    setSubmitting(value: boolean) {
      submittingRef.current = value;
    },
  };
}
