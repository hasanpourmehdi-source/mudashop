"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirm) {
      setError("رمز جدید و تکرارش یکی نیستن");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در تغییر رمز");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="border cut-line rounded-lg p-6 bg-white space-y-3">
      <h2 className="font-bold mb-1">تغییر رمز عبور</h2>
      <div>
        <label className="block text-xs font-medium mb-1">رمز فعلی</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">رمز جدید</label>
        <input
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">تکرار رمز جدید</label>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-700">رمز عبور با موفقیت تغییر کرد.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
      >
        {saving ? "در حال ثبت..." : "تغییر رمز"}
      </button>
    </form>
  );
}
