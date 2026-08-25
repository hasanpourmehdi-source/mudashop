"use client";

import { useEffect, useState } from "react";
import { ADMIN_SCOPES, ADMIN_SCOPE_LABELS, type AdminScope } from "@/lib/adminPermissions";

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  status: "ACTIVE" | "BANNED";
  createdAt: string;
  scopes: AdminScope[];
};

function ScopeCheckboxes({
  selected,
  onChange,
}: {
  selected: AdminScope[];
  onChange: (scopes: AdminScope[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ADMIN_SCOPES.map((scope) => (
        <label key={scope} className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(scope)}
            onChange={() =>
              onChange(selected.includes(scope) ? selected.filter((s) => s !== scope) : [...selected, scope])
            }
            className="accent-[var(--color-wine)]"
          />
          {ADMIN_SCOPE_LABELS[scope]}
        </label>
      ))}
    </div>
  );
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scopes, setScopes] = useState<AdminScope[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScopes, setEditScopes] = useState<AdminScope[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/staff")
      .then((res) => (res.ok ? res.json() : []))
      .then(setStaff)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, scopes }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ساختن حساب کارمند");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setScopes([]);
    load();
  }

  function startEdit(s: StaffMember) {
    setEditingId(s.id);
    setEditScopes(s.scopes);
  }

  async function handleSaveScopes(id: string) {
    setEditSaving(true);
    await fetch(`/api/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes: editScopes }),
    });
    setEditSaving(false);
    setEditingId(null);
    load();
  }

  async function handleRemove(s: StaffMember) {
    if (!confirm(`دسترسی «${s.name ?? s.email}» به پنل ادمین کاملاً لغو شود؟ (حساب کاربری‌اش حذف نمی‌شود)`)) return;
    await fetch(`/api/admin/staff/${s.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-2">کارمندان (دسترسی محدود)</h1>
        <p className="text-sm text-[var(--color-muted)]">
          برخلاف حساب ادمین که به همه‌چی (کیف پول، تنظیمات، رفاند) دسترسی کامل دارد، حساب کارمند فقط
          به حیطه‌هایی که پایین تیک می‌زنی دسترسی دارد.
        </p>
      </div>

      <form onSubmit={handleCreate} className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <h2 className="font-bold text-sm">افزودن کارمند جدید</h2>
        <input
          placeholder="نام"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
        <input
          type="email"
          placeholder="ایمیل"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
        <input
          type="password"
          placeholder="رمز عبور (حداقل ۶ کاراکتر)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
        <div>
          <p className="text-xs font-medium mb-1.5">حیطه‌های دسترسی</p>
          <ScopeCheckboxes selected={scopes} onChange={setScopes} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? "..." : "افزودن کارمند"}
        </button>
      </form>

      <div>
        <h2 className="text-lg font-bold mb-4">کارمندان فعلی ({loading ? "..." : staff.length})</h2>
        {!loading && staff.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">هنوز کارمندی تعریف نشده.</p>
        )}
        <div className="space-y-2">
          {staff.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="border-2 cut-line rounded-lg p-3 bg-white space-y-2">
                <p className="text-sm font-medium">{s.name ?? s.email}</p>
                <ScopeCheckboxes selected={editScopes} onChange={setEditScopes} />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveScopes(s.id)}
                    disabled={editSaving}
                    className="text-xs bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                  >
                    {editSaving ? "..." : "ذخیره"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-[var(--color-muted)]">
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {s.name} <span className="text-[var(--color-muted)] font-normal">({s.email})</span>
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(s)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش دسترسی
                    </button>
                    <button onClick={() => handleRemove(s)} className="text-red-600 hover:underline">
                      لغو دسترسی
                    </button>
                  </div>
                </div>
                <p className="text-[var(--color-muted)] text-xs">
                  {s.scopes.length === 0
                    ? "بدون هیچ دسترسی"
                    : s.scopes.map((sc) => ADMIN_SCOPE_LABELS[sc]).join("، ")}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
