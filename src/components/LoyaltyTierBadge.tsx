"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const TIER_ICON: Record<string, string> = { GOLD: "🥇", SILVER: "🥈", BRONZE: "🥉" };

// بجِ سطحِ باشگاهِ مشتری -- جدا از خودِ صفحه‌ی /loyalty هم دیده بشه (هدر/پروفایل)
// تا سطح واقعاً حس بشه، نه فقط یه عددِ مدفون توی یه صفحه‌ی جدا
export function LoyaltyTierBadge({ variant = "full" }: { variant?: "icon" | "full" }) {
  const { status } = useSession();
  const [tier, setTier] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setTier(null);
      return;
    }
    fetch("/api/loyalty")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTier(data?.enabled ? { key: data.tier.key, label: data.tier.label } : null))
      .catch(() => {});
  }, [status]);

  if (!tier) return null;
  const icon = TIER_ICON[tier.key] ?? "🏅";

  if (variant === "icon") {
    return (
      <span title={`سطح ${tier.label}`} className="leading-none">
        {icon}
      </span>
    );
  }

  return (
    <Link
      href="/loyalty"
      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-wine)] hover:opacity-80"
    >
      <span>{icon}</span>
      <span>سطح {tier.label}</span>
    </Link>
  );
}
