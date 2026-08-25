"use client";

import { useEffect, useState } from "react";

type Address = {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  detail: string;
  isDefault: boolean;
};

type AddressForm = Omit<Address, "id" | "isDefault">;

const emptyForm: AddressForm = {
  title: "",
  fullName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  detail: "",
};

// مدیریت کامل آدرس‌های مشتری -- افزودن/ویرایش/حذف/تعیین پیش‌فرض. دقیقاً از
// همون API که فرم آدرس داخل تسویه‌حساب استفاده می‌کنه (/api/addresses) استفاده
// می‌شه، تا رفتار و اعتبارسنجی هردو یکسان باشه
export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<AddressForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddressForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Address[]) => setAddresses(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newForm, isDefault: addresses.length === 0 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره آدرس");
      return;
    }
    setAddresses((prev) => [data, ...prev]);
    setShowNewForm(false);
    setNewForm(emptyForm);
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setEditForm({
      title: a.title,
      fullName: a.fullName,
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalCode: a.postalCode,
      detail: a.detail,
    });
  }

  async function handleSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    setAddresses((prev) => prev.map((a) => (a.id === id ? data : a)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("این آدرس حذف شود؟")) return;
    setError("");
    setBusy(true);
    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در حذف آدرس");
      return;
    }
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSetDefault(id: string) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setBusy(false);
    if (!res.ok) return;
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  }

  const formFields: { key: keyof AddressForm; label: string; span?: boolean }[] = [
    { key: "title", label: "عنوان (مثلا منزل) *" },
    { key: "fullName", label: "نام گیرنده *" },
    { key: "phone", label: "شماره تماس *" },
    { key: "province", label: "استان *" },
    { key: "city", label: "شهر *" },
    { key: "postalCode", label: "کد پستی *" },
    { key: "detail", label: "آدرس کامل *", span: true },
  ];

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {addresses.length === 0 && !showNewForm && (
        <p className="text-sm text-[var(--color-muted)]">هنوز آدرسی ثبت نکرده‌اید.</p>
      )}

      {addresses.map((a) =>
        editingId === a.id ? (
          <form
            key={a.id}
            onSubmit={(e) => handleSaveEdit(e, a.id)}
            noValidate
            className="grid sm:grid-cols-2 gap-3 border cut-line rounded-lg p-4 bg-white"
          >
            {formFields.map((f) => (
              <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
                {f.key === "detail" ? (
                  <textarea
                    placeholder={f.label}
                    required
                    value={editForm[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full border cut-line rounded-lg px-3 py-2"
                  />
                ) : (
                  <input
                    placeholder={f.label}
                    required
                    value={editForm[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full border cut-line rounded-lg px-3 py-2"
                  />
                )}
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
              >
                ذخیره تغییرات
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-sm text-[var(--color-muted)]"
              >
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <div
            key={a.id}
            className="border cut-line rounded-lg p-4 bg-white flex items-start justify-between gap-3"
          >
            <div className="text-sm space-y-0.5">
              <p className="font-bold flex items-center gap-2">
                {a.title}
                {a.isDefault && (
                  <span className="text-[10px] font-bold text-white bg-[var(--color-wine)] rounded-full px-2 py-0.5">
                    پیش‌فرض
                  </span>
                )}
              </p>
              <p>{a.fullName} — {a.phone}</p>
              <p className="text-[var(--color-muted)]">
                {a.province}، {a.city}، {a.detail} — {a.postalCode}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs">
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(a.id)}
                  disabled={busy}
                  className="text-[var(--color-wine)] hover:underline disabled:opacity-50"
                >
                  تعیین به‌عنوان پیش‌فرض
                </button>
              )}
              <button
                type="button"
                onClick={() => startEdit(a)}
                className="text-[var(--color-muted)] hover:text-[var(--color-wine)]"
              >
                ویرایش
              </button>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={busy}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                حذف
              </button>
            </div>
          </div>
        )
      )}

      {showNewForm ? (
        <form
          onSubmit={handleAdd}
          noValidate
          className="grid sm:grid-cols-2 gap-3 border cut-line rounded-lg p-4 bg-white"
        >
          {formFields.map((f) => (
            <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
              {f.key === "detail" ? (
                <textarea
                  placeholder={f.label}
                  required
                  value={newForm[f.key]}
                  onChange={(e) => setNewForm({ ...newForm, [f.key]: e.target.value })}
                  className="w-full border cut-line rounded-lg px-3 py-2"
                />
              ) : (
                <input
                  placeholder={f.label}
                  required
                  value={newForm[f.key]}
                  onChange={(e) => setNewForm({ ...newForm, [f.key]: e.target.value })}
                  className="w-full border cut-line rounded-lg px-3 py-2"
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              ذخیره آدرس
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setNewForm(emptyForm);
              }}
              className="text-sm text-[var(--color-muted)]"
            >
              انصراف
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="text-sm text-[var(--color-wine)] font-medium"
        >
          + افزودن آدرس جدید
        </button>
      )}
    </div>
  );
}
