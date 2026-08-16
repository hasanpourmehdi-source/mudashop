"use client";

import { useEffect, useState } from "react";

function getRemaining(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, diff);
}

function format(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CountdownTimer({ endsAt, className }: { endsAt: string; className?: string }) {
  // مقدار اولیه رو حساب نمی‌کنیم چون Date.now() سمت سرور و سمت کلاینت چند میلی‌ثانیه
  // فرق می‌کنه و باعث hydration mismatch می‌شه؛ محاسبه‌ی واقعی رو می‌ندازیم به بعد از mount
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(getRemaining(endsAt));
    const interval = setInterval(() => setRemaining(getRemaining(endsAt)), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remaining === null) return <span className={className}>--:--:--</span>;
  if (remaining <= 0) return <span className={className}>حراج تمام شد</span>;

  return <span className={className}>{format(remaining)}</span>;
}
