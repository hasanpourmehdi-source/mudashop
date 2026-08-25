"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Alert = { targetPrice: number; notifiedAt: string | null } | null;

// ویجت «کاهش قیمت خبرم کن» -- ثبت مبلغ هدف، نمایش اخطار فعال، حذف.
// وقتی قیمت فعلی به مبلغ هدف رسیده، به‌صورت یک‌باره زنگوله + ایمیل/پیامک
// اطلاع داده می‌شود (PRICE_DROP).
export function PriceAlertWidget({
  productId,
  currentPrice,
}: {
  productId: string;
  currentPrice: number;
}) {
  const router = useRouter();
  const [alert, setAlert] = useState<Alert>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/products/${productId}/price-alert`)
      .then((res) => res.json())
      .then((data) => {
        setAlert(data.alert);
        if (data.alert) setDraft(String(data.alert.targetPrice));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  async function save() {
    const targetPrice = Number(draft);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setError("مبلغ معتبر وارد کنید");
      return;
    }
    setError("");
    setSaving(true);
    const res = await fetch(`/api/products/${productId}/price-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPrice }),
    });
    setSaving(false);
    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }
    if (!res.ok) {
      setError("خطا در ثبت اخطار");
      return;
    }
    const data = await res.json();
    setAlert(data.alert);
    setEditing(false);
  }

  async function remove() {
    setSaving(true);
    const res = await fetch(`/api/products/${productId}/price-alert`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      setAlert(null);
      setDraft("");
      setEditing(false);
    }
  }

  if (loading) {
    return <p className="text-[11px] text-[var(--color-muted)]">در حال بارگذاری اخطار قیمت...</p>;
  }

  return (
    <div className="mt-3 border cut-line rounded-lg p-3 bg-white text-sm">
      <p className="text-xs font-medium mb-2">⬇️ اخطار کاهش قیمت</p>

      {alert && !editing ? (
        <div className="space-y-2">
          <p className="text-[12px] text-[var(--color-muted)]">
            {alert.notifiedAt ? (
              <>
                قبلاً اطلاع داده شد و <span className="font-bold text-emerald-700">این اخطار خاموش شد</span>.
              </>
            ) : (
              <>
                تا قیمت <span className="font-bold text-[var(--color-wine)]">{alert.targetPrice.toLocaleString("fa-IR")} تومان</span> خبر می‌دهیم.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="border cut-line rounded-full px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-linen-dim)]"
            >
              ویرایش
            </button>
            <button
              onClick={remove}
              disabled={saving}
              className="text-red-600 text-xs px-2 disabled:opacity-50"
            >
              حذف
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`قیمت هدف (فعلی: ${currentPrice.toLocaleString("fa-IR")})`}
              className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm min-w-0"
            />
            <span className="text-[11px] text-[var(--color-muted)] whitespace-nowrap">تومان</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-[var(--color-wine)] text-white rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "..." : "ثبت اخطار"}
            </button>
            {alert && (
              <button
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
                className="text-xs text-[var(--color-muted)] px-2"
              >
                انصراف
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <p className="text-[10px] text-[var(--color-muted)] mt-2 leading-relaxed">
        به‌محض رسیدن قیمت به مبلغ هدف، در زنگوله‌ی اعلان‌ها + ایمیل/پیامک (در صورت
        فعال‌بودن) مطلع می‌شوید.{" "}
        <Link href="/profile" className="underline">
          مدیریت اعلان‌ها
        </Link>
      </p>
    </div>
  );
}