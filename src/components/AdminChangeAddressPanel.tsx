"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHIPPING_METHODS } from "@/lib/shipping";

type BankCardOption = {
  id: string;
  cardNumber: string;
  holderName: string;
  label: string | null;
};

type AddressForm = {
  title: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  detail: string;
};

const emptyAddress: AddressForm = {
  title: "",
  fullName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  detail: "",
};

// تغییرِ آدرس/نحوه‌ی ارسال به درخواستِ مشتری -- فقط از این راه (نه خودِ مشتری)
// چون هزینه‌ی ارسال ممکنه از قبل مشخص/پرداخت شده باشه؛ اگه اختلافی پیش بیاد،
// یا فوری به کیف‌پول برمی‌گرده یا (اگه بیشتره) از کیف‌پول کسر و باقی‌مونده با
// کارتِ تخصیص‌داده‌شده جمع‌آوری می‌شه -- دقیقاً مثل دورِ دومِ هزینه ارسال/باربری
export function AdminChangeAddressPanel({
  orderId,
  status,
  currentAddress,
  hasExternalItems,
  currentShippingMethod,
  currentShippingCost,
  bankCards,
}: {
  orderId: string;
  status: string;
  currentAddress: AddressForm;
  hasExternalItems: boolean;
  currentShippingMethod: string | null;
  currentShippingCost: number | null;
  bankCards: BankCardOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(currentAddress ?? emptyAddress);
  const [shippingMethod, setShippingMethod] = useState(currentShippingMethod ?? "");
  const [reason, setReason] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(bankCards[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const canChange = status === "PENDING" || status === "PROCESSING";
  if (!canChange) return null;

  async function handleSubmit() {
    setError("");
    setResult("");
    if (!form.title || !form.fullName || !form.phone || !form.province || !form.city || !form.postalCode || !form.detail) {
      setError("همه‌ی فیلدهای آدرس را کامل کنید");
      return;
    }
    if (!reason.trim()) {
      setError("دلیل تغییر آدرس را بنویسید (مثلاً پیام مشتری)");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/change-address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAddress: form,
        shippingMethod: hasExternalItems ? undefined : shippingMethod || undefined,
        bankCardId: selectedCardId || undefined,
        reason: reason.trim(),
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "خطا در تغییر آدرس");
      return;
    }
    setResult("آدرس با موفقیت تغییر کرد");
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">تغییر آدرس/نحوه ارسال</h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs px-3 py-1.5 rounded-full border cut-line hover:bg-[var(--color-linen-dim)]"
          >
            تغییر بده
          </button>
        )}
      </div>

      {result && <p className="text-xs text-green-700 mt-2">{result}</p>}

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            این فقط برای وقتیه که مشتری خودش پیام داده و درخواست تغییر آدرس کرده (مثلاً جابجا شده). اگه هزینه
            ارسال عوض بشه، اختلافش خودکار با کیف‌پول تسویه می‌شه.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="عنوان (مثلاً خانه)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              placeholder="نام گیرنده"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              placeholder="شماره تماس"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              placeholder="استان"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              placeholder="شهر"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <input
              placeholder="کد پستی"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm"
            />
            <textarea
              placeholder="آدرس کامل"
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              className="border cut-line rounded-lg px-3 py-1.5 text-sm col-span-2"
            />
          </div>

          {!hasExternalItems && (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">
                نحوه ارسال (هزینه‌ی فعلی: {(currentShippingCost ?? 0).toLocaleString("fa-IR")} تومان)
              </p>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {SHIPPING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <textarea
            placeholder="دلیل تغییر (مثلاً: مشتری پیام داد که جابجا شده)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm"
          />

          {bankCards.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-1">
                کارت پرداخت (فقط اگه بعد از کسر از کیف‌پول، هزینه‌ی بیشتری باقی بمونه)
              </p>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full border cut-line rounded-lg px-2 py-1.5 text-sm bg-white"
                dir="ltr"
              >
                {bankCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cardNumber} — {c.holderName}
                    {c.label && ` (${c.label})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="text-sm bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
            >
              {saving ? "در حال ثبت..." : "ثبت تغییر آدرس"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-sm px-4 py-1.5 rounded-full border cut-line"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
