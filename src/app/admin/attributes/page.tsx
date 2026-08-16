"use client";

import { useEffect, useState } from "react";

type AttributeValue = { id: string; value: string };
type AttributeGroup = { id: string; name: string };
type Attribute = {
  id: string;
  name: string;
  values: AttributeValue[];
  categories: { category: { name: string } }[];
  group: AttributeGroup | null;
};

export default function AdminAttributesPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [name, setName] = useState("");
  const [valuesText, setValuesText] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValuesText, setEditValuesText] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/attributes")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAttributes);
    fetch("/api/admin/attribute-groups")
      .then((res) => (res.ok ? res.json() : []))
      .then(setGroups);
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const values = valuesText
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, values, groupId: groupId || undefined }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره ویژگی");
      return;
    }

    setName("");
    setValuesText("");
    setGroupId("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این ویژگی قطعی است؟")) return;
    const res = await fetch(`/api/admin/attributes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "خطا در حذف");
      return;
    }
    load();
  }

  function startEdit(a: Attribute) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditValuesText(a.values.map((v) => v.value).join(", "));
    setEditGroupId(a.group?.id ?? "");
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const values = editValuesText
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter(Boolean);

    const res = await fetch(`/api/admin/attributes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, values, groupId: editGroupId || null }),
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
        <h1 className="text-xl font-bold mb-2">افزودن ویژگی جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          ویژگی‌ها (مثل «سایز» یا «رنگ») با مقادیر از پیش‌تعریف‌شده ساخته می‌شن. بعداً از صفحه
          «دسته‌بندی‌ها» این ویژگی رو به دسته‌های مرتبط وصل کن. اگه چند ویژگی جایگزین هم هستن
          (مثلا «سایز کفش» و «سایز لباس»)، از صفحه «گروه‌های ویژگی» یه گروه بساز و اینجا
          انتخابش کن — تا موقع تعریف محصول فقط یکی از اعضای اون گروه قابل انتخاب باشه.
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3 max-w-2xl">
          <input
            placeholder="نام ویژگی (مثلا سایز)"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          >
            <option value="">بدون گروه</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                گروه: {g.name}
              </option>
            ))}
          </select>
          <input
            placeholder="مقادیر با کاما (مثلا اسمال، مدیوم، لارج یا S, M, L)"
            required
            value={valuesText}
            onChange={(e) => setValuesText(e.target.value)}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
          />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "افزودن ویژگی"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">ویژگی‌های موجود ({attributes.length})</h2>
        <div className="space-y-2">
          {attributes.map((a) =>
            editingId === a.id ? (
              <form
                key={a.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(a.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  placeholder="نام"
                  required
                />
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">بدون گروه</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      گروه: {g.name}
                    </option>
                  ))}
                </select>
                <input
                  value={editValuesText}
                  onChange={(e) => setEditValuesText(e.target.value)}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  placeholder="مقادیر با کاما"
                  required
                />
                <p className="text-[10px] text-[var(--color-muted)]">
                  اگه مقداری رو از این لیست حذف کنی، محصولاتی که قبلاً با اون مقدار variant
                  ساخته بودن دست‌نخورده می‌مونن — فقط دیگه برای محصول جدید قابل انتخاب نیست.
                </p>
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
              <div key={a.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {a.name}
                    {a.group && (
                      <span className="text-[10px] text-[var(--color-ochre)] font-normal">
                        {" "}
                        (گروه: {a.group.name})
                      </span>
                    )}
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(a)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {a.values.map((v) => (
                    <span
                      key={v.id}
                      className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-linen-dim)]"
                    >
                      {v.value}
                    </span>
                  ))}
                </div>
                {a.categories.length > 0 && (
                  <p className="text-[10px] text-[var(--color-muted)]">
                    وصل به: {a.categories.map((c) => c.category.name).join("، ")}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
