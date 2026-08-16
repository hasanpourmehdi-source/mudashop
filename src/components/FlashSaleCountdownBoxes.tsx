"use client";

import { useEffect, useState } from "react";

function getRemaining(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, diff);
}

function splitParts(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    h: Math.floor(totalSeconds / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}

export function FlashSaleCountdownBoxes({ endsAt }: { endsAt: string }) {
  // مثل CountdownTimer -- مقدار اولیه رو حساب نمی‌کنیم تا با Date.now() سمت سرور
  // در تناقض نیفته و hydration mismatch نده؛ محاسبه‌ی واقعی بعد از mount انجام می‌شه
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(getRemaining(endsAt));
    const interval = setInterval(() => setRemaining(getRemaining(endsAt)), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remaining === null) {
    return (
      <div className="flex items-center gap-2">
        {["ساعت", "دقیقه", "ثانیه"].map((label) => (
          <div key={label} className="bg-white rounded-lg px-3 py-1.5 text-center min-w-[52px]">
            <p className="text-[var(--color-wine)] font-extrabold text-lg leading-tight">--</p>
            <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
          </div>
        ))}
      </div>
    );
  }

  if (remaining <= 0) {
    return <p className="text-sm font-bold">حراج تمام شد</p>;
  }

  const { h, m, s } = splitParts(remaining);
  const items = [
    { value: h, label: "ساعت" },
    { value: m, label: "دقیقه" },
    { value: s, label: "ثانیه" },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((it) => (
        <div key={it.label} className="bg-white rounded-lg px-3 py-1.5 text-center min-w-[52px]">
          <p className="text-[var(--color-wine)] font-extrabold text-lg leading-tight">
            {it.value.toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
