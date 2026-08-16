"use client";

import { useEffect, useState } from "react";
import { PersianDateTimeInput } from "@/components/PersianDateTimeInput";

type Brand = { id: string; name: string };
type Campaign = {
  id: string;
  title: string;
  slug: string;
  bannerImage: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  brand: { name: string };
};

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    brandId: "",
    bannerImage: "",
    description: "",
    startsAt: now.toISOString(),
    endsAt: inOneWeek.toISOString(),
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    bannerImage: "",
    description: "",
    startsAt: "",
    endsAt: "",
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/admin/campaigns").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/admin/brands").then((res) => (res.ok ? res.json() : [])),
    ]).then(([c, b]) => {
      setCampaigns(c);
      setBrands(b);
    });
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug || slugify(form.title),
        brandId: form.brandId,
        bannerImage: form.bannerImage,
        description: form.description || undefined,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره کمپین");
      return;
    }
    setForm({
      title: "",
      slug: "",
      brandId: "",
      bannerImage: "",
      description: "",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setSlugTouched(false);
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این کمپین قطعی است؟")) return;
    await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    setEditForm({
      title: c.title,
      bannerImage: c.bannerImage,
      description: c.description ?? "",
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    });
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        bannerImage: editForm.bannerImage,
        description: editForm.description || undefined,
        startsAt: editForm.startsAt,
        endsAt: editForm.endsAt,
      }),
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
        <h1 className="text-xl font-bold mb-2">افزودن کمپین برند جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          کمپین یعنی یه بازه‌ی زمانی خاص که همه‌ی محصولات یه برند مشخص، توی یه بنر
          اختصاصی زیر صفحه‌ی اصلی نمایش داده می‌شن.
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <input
            type="text"
            placeholder="عنوان کمپین (مثلا «حراج تابستانه پارسیان‌پوش»)"
            required
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({
                ...f,
                title,
                slug: slugTouched ? f.slug : slugify(title),
              }));
            }}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
          />
          <input
            type="text"
            placeholder="نامک انگلیسی (slug) -- مثلا summer-parsian-poosh"
            required
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm({ ...form, slug: e.target.value });
            }}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2 font-mono text-sm"
            dir="ltr"
          />
          <select
            required
            value={form.brandId}
            onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
          >
            <option value="">انتخاب برند</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="url"
            placeholder="آدرس تصویر بنر (URL)"
            required
            value={form.bannerImage}
            onChange={(e) => setForm({ ...form, bannerImage: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
            dir="ltr"
          />
          <textarea
            placeholder="توضیح کوتاه (اختیاری)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2"
            rows={2}
          />
          <label className="text-xs text-[var(--color-muted)]">
            شروع
            <div className="mt-1">
              <PersianDateTimeInput
                value={form.startsAt}
                onChange={(iso) => setForm({ ...form, startsAt: iso })}
              />
            </div>
          </label>
          <label className="text-xs text-[var(--color-muted)]">
            پایان
            <div className="mt-1">
              <PersianDateTimeInput
                value={form.endsAt}
                onChange={(iso) => setForm({ ...form, endsAt: iso })}
              />
            </div>
          </label>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ایجاد کمپین"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">کمپین‌های ثبت‌شده ({campaigns.length})</h2>
        <div className="space-y-2">
          {campaigns.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">هنوز کمپینی ثبت نشده.</p>
          )}
          {campaigns.map((c) =>
            editingId === c.id ? (
              <form
                key={c.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(c.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                />
                <input
                  type="url"
                  value={editForm.bannerImage}
                  onChange={(e) => setEditForm({ ...editForm, bannerImage: e.target.value })}
                  className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  dir="ltr"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  rows={2}
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  <PersianDateTimeInput
                    value={editForm.startsAt}
                    onChange={(iso) => setEditForm({ ...editForm, startsAt: iso })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                  <PersianDateTimeInput
                    value={editForm.endsAt}
                    onChange={(iso) => setEditForm({ ...editForm, endsAt: iso })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm w-full"
                  />
                </div>
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
              <div
                key={c.id}
                className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {c.title} <span className="text-[var(--color-muted)]">— {c.brand.name}</span>
                  </p>
                  <p className="text-[var(--color-muted)] text-xs">
                    {new Date(c.startsAt).toLocaleString("fa-IR")} تا{" "}
                    {new Date(c.endsAt).toLocaleString("fa-IR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.isActive ? "فعال" : "غیرفعال"}
                  </button>
                  <button onClick={() => startEdit(c)} className="text-[var(--color-wine)] hover:underline">
                    ویرایش
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">
                    حذف
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
