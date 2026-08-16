"use client";

import { useEffect, useState } from "react";

type AttributeGroup = {
  id: string;
  name: string;
  attributes: { id: string; name: string }[];
};

export default function AdminAttributeGroupsPage() {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/attribute-groups")
      .then((res) => (res.ok ? res.json() : []))
      .then(setGroups);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/attribute-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره گروه");
      return;
    }
    setName("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این گروه قطعی است؟ (ویژگی‌های عضوش حذف نمی‌شن، فقط دیگه هم‌گروه نیستن)")) return;
    await fetch(`/api/admin/attribute-groups/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(g: AttributeGroup) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/attribute-groups/${id}`, {
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
        <h1 className="text-xl font-bold mb-2">افزودن گروه ویژگی جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          گروه برای ویژگی‌های <span className="font-medium">جایگزین هم</span> استفاده می‌شه —
          مثلاً «سایز کفش» و «سایز لباس» رو تو یه گروه «سایز» بذار، تا موقع تعریف محصول فقط
          یکی از این دو قابل انتخاب باشه (نه هر دو با هم، چون ترکیبشون معنی نداره).
        </p>
        <form onSubmit={handleCreate} className="flex gap-2 max-w-md">
          <input
            placeholder="نام گروه (مثلا سایز)"
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
        <h2 className="text-lg font-bold mb-4">گروه‌های موجود ({groups.length})</h2>
        <div className="space-y-2 max-w-md">
          {groups.map((g) =>
            editingId === g.id ? (
              <form
                key={g.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(g.id);
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
              <div key={g.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{g.name}</span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(g)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
                <p className="text-[var(--color-muted)] text-xs">
                  {g.attributes.length > 0
                    ? `اعضا: ${g.attributes.map((a) => a.name).join("، ")}`
                    : "هنوز ویژگی‌ای عضو این گروه نیست."}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
