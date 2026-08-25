"use client";

import { useState } from "react";

export function ProfileEditForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border cut-line rounded-lg p-6 bg-white space-y-3">
      <h2 className="font-bold mb-1">ویرایش مشخصات</h2>
      <div>
        <label className="block text-xs font-medium mb-1">نام</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">شماره موبایل</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          placeholder="09xxxxxxxxx"
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white text-right"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-700">تغییرات ذخیره شد.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </button>
    </form>
  );
}
