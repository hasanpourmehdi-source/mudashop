"use client";

import { useEffect, useState } from "react";

type Brand = {
  id: string;
  name: string;
  _count: { products: number; sizeGuides: number };
};

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/brands")
      .then((res) => (res.ok ? res.json() : []))
      .then(setBrands);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره برند");
      return;
    }
    setName("");
    load();
  }

  async function handleDelete(b: Brand) {
    const warning =
      b._count.products > 0 || b._count.sizeGuides > 0
        ? `این برند به ${b._count.products} محصول و ${b._count.sizeGuides} راهنمای سایز وصله. با حذف، محصولات بدون‌برند می‌شن و راهنماهای سایزش هم حذف می‌شن. ادامه بدم؟`
        : "حذف این برند قطعی است؟";
    if (!confirm(warning)) return;
    await fetch(`/api/admin/brands/${b.id}`, { method: "DELETE" });
    load();
  }

  function startEdit(b: Brand) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-2">افزودن برند جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          برندها هم موقع تعریف محصول (فیلد برند) و هم برای راهنمای سایز اختصاصی استفاده می‌شن.
          موقع تعریف محصول یا راهنمای سایز هم می‌تونی برند جدید رو مستقیم همون‌جا اضافه کنی.
        </p>
        <form onSubmit={handleCreate} className="flex gap-2 max-w-md">
          <input
            placeholder="نام برند (مثلا زارا)"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {saving ? "..." : "افزودن"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">برندهای موجود ({brands.length})</h2>
        <div className="space-y-2 max-w-md">
          {brands.map((b) =>
            editingId === b.id ? (
              <form
                key={b.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(b.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  required
                />
                {editError && <p className="text-xs text-red-600">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="text-xs bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                  >
                    {editSaving ? "..." : "ذخیره"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              <div key={b.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{b.name}</span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(b)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(b)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
                <p className="text-[var(--color-muted)] text-xs">
                  {b._count.products} محصول · {b._count.sizeGuides} راهنمای سایز
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
