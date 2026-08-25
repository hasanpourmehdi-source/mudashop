"use client";

import { useEffect, useState } from "react";

type ReferralData = {
  code: string;
  rewardAmount: number;
  totalEarned: number;
  rewards: { id: string; amount: number; referredName: string; createdAt: string }[];
};

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | "">("");

  useEffect(() => {
    fetch("/api/referral")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  }, []);

  const fmt = (n: number) => n.toLocaleString("fa-IR");
  const shareLink =
    data && typeof window !== "undefined" ? `${window.location.origin}/auth/register?ref=${data.code}` : "";

  async function copy(text: string, key: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // بی‌اهمیت -- کاربر می‌تواند دستی کپی کند
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">🤝 کد معرفی</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          دوستانت را با کد یا لینک اختصاصی‌ات دعوت کن — با اولین سفارشِ پرداخت‌شده‌ی
          هرکدام، پاداش نقدی به کیف پولت اضافه می‌شود.
        </p>
      </header>

      {!data ? (
        <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>
      ) : (
        <>
          <section className="border cut-line rounded-xl p-5 bg-white space-y-4">
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">کد معرفی تو</p>
              <div className="flex gap-2">
                <span
                  dir="ltr"
                  className="flex-1 border cut-line rounded-lg px-3 py-2 text-lg font-bold text-center bg-[var(--color-linen-dim)]"
                >
                  {data.code}
                </span>
                <button
                  onClick={() => copy(data.code, "code")}
                  className="border cut-line px-4 py-2 rounded-lg text-sm font-medium bg-white shrink-0"
                >
                  {copied === "code" ? "کپی شد ✓" : "کپی کد"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">لینک دعوت</p>
              <div className="flex gap-2">
                <span
                  dir="ltr"
                  className="flex-1 border cut-line rounded-lg px-3 py-2 text-xs bg-[var(--color-linen-dim)] truncate"
                >
                  {shareLink}
                </span>
                <button
                  onClick={() => copy(shareLink, "link")}
                  className="border cut-line px-4 py-2 rounded-lg text-sm font-medium bg-white shrink-0"
                >
                  {copied === "link" ? "کپی شد ✓" : "کپی لینک"}
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--color-muted)]">
              به‌ازای هر نفر که با این کد ثبت‌نام کند و اولین سفارشش را پرداخت کند،{" "}
              <span className="font-bold text-[var(--color-wine)]">{fmt(data.rewardAmount)} تومان</span> به کیف
              پولت اضافه می‌شود.
            </p>
          </section>

          <section className="border cut-line rounded-xl p-5 bg-white space-y-2">
            <h2 className="font-bold">جمع پاداش دریافتی</h2>
            <p className="text-2xl font-bold text-emerald-700">{fmt(data.totalEarned)} تومان</p>

            {data.rewards.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] pt-2">هنوز کسی با کد تو خرید نکرده است.</p>
            ) : (
              <ul className="text-sm divide-y divide-[var(--color-linen-dim)] pt-2">
                {data.rewards.map((r) => (
                  <li key={r.id} className="py-2 flex justify-between gap-3">
                    <span className="text-[var(--color-muted)] text-xs">
                      خریدِ {r.referredName} — {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                    </span>
                    <span className="font-medium text-emerald-700 whitespace-nowrap">+{fmt(r.amount)} تومان</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
