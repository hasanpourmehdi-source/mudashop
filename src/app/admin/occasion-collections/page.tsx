"use client";

import { useEffect, useMemo, useState } from "react";
import { PersianDateTimeInput } from "@/components/PersianDateTimeInput";

type Item = {
  id: string;
  source: "MAZON" | "TRENDYOL";
  productId: string | null;
  externalId: string | null;
  title: string | null;
  image: string | null;
  price: number | null;
};

type Collection = {
  id: string;
  title: string;
  slug: string;
  bannerImage: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  items: Item[];
};

type Product = { id: string; title: string };

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminOccasionCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [form, setForm] = useState({
    title: "",
    slug: "",
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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [trendyolInput, setTrendyolInput] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState("");

  function load() {
    Promise.all([
      fetch("/api/admin/occasion-collections").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/admin/products").then((res) => (res.ok ? res.json() : [])),
    ]).then(([c, p]) => {
      setCollections(c);
      setProducts(p);
    });
  }

  useEffect(load, []);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim();
    if (!q) return [];
    return products.filter((p) => p.title.includes(q)).slice(0, 8);
  }, [products, productQuery]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/occasion-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug || slugify(form.title),
        bannerImage: form.bannerImage,
        description: form.description || undefined,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره مجموعه");
      return;
    }
    setForm({
      title: "",
      slug: "",
      bannerImage: "",
      description: "",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setSlugTouched(false);
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/occasion-collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این مجموعه قطعی است؟")) return;
    await fetch(`/api/admin/occasion-collections/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(c: Collection) {
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
    const res = await fetch(`/api/admin/occasion-collections/${id}`, {
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

  async function addMazonItem(collectionId: string, productId: string) {
    setAddItemError("");
    setAddingItem(true);
    const res = await fetch(`/api/admin/occasion-collections/${collectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const data = await res.json();
    setAddingItem(false);
    if (!res.ok) {
      setAddItemError(data.error ?? "خطا در افزودن محصول");
      return;
    }
    setProductQuery("");
    load();
  }

  async function addTrendyolItem(collectionId: string) {
    if (!trendyolInput.trim()) return;
    setAddItemError("");
    setAddingItem(true);
    const res = await fetch(`/api/admin/occasion-collections/${collectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trendyolInput: trendyolInput.trim() }),
    });
    const data = await res.json();
    setAddingItem(false);
    if (!res.ok) {
      setAddItemError(data.error ?? "خطا در افزودن محصول");
      return;
    }
    setTrendyolInput("");
    load();
  }

  async function removeItem(collectionId: string, itemId: string) {
    await fetch(`/api/admin/occasion-collections/${collectionId}/items/${itemId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-2">افزودن مجموعه‌ی مناسبتی جدید</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          برخلافِ کمپینِ برند، این مجموعه می‌تونه از هر برند/دسته‌ای محصول جمع کنه --
          مناسبِ مناسبت‌هایی مثلِ یلدا، روزِ مادر یا بلک‌فرایدی.
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <input
            type="text"
            placeholder="عنوان مجموعه (مثلا «شبِ یلدا»)"
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
            placeholder="نامک انگلیسی (slug) -- مثلا yalda-night"
            required
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm({ ...form, slug: e.target.value });
            }}
            className="border cut-line rounded-lg px-3 py-2 bg-white sm:col-span-2 font-mono text-sm"
            dir="ltr"
          />
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
              <PersianDateTimeInput value={form.startsAt} onChange={(iso) => setForm({ ...form, startsAt: iso })} />
            </div>
          </label>
          <label className="text-xs text-[var(--color-muted)]">
            پایان
            <div className="mt-1">
              <PersianDateTimeInput value={form.endsAt} onChange={(iso) => setForm({ ...form, endsAt: iso })} />
            </div>
          </label>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ایجاد مجموعه"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">مجموعه‌های ثبت‌شده ({collections.length})</h2>
        <div className="space-y-2">
          {collections.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">هنوز مجموعه‌ای ثبت نشده.</p>
          )}
          {collections.map((c) =>
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
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--color-muted)]">
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              <div key={c.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-[var(--color-muted)] text-xs">
                      {new Date(c.startsAt).toLocaleString("fa-IR")} تا {new Date(c.endsAt).toLocaleString("fa-IR")} ·{" "}
                      {c.items.length.toLocaleString("fa-IR")} محصول
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
                    <button
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="text-[var(--color-wine)] hover:underline"
                    >
                      {expandedId === c.id ? "بستنِ آیتم‌ها" : "مدیریتِ محصولات"}
                    </button>
                    <button onClick={() => startEdit(c)} className="text-[var(--color-wine)] hover:underline">
                      ویرایش
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="mt-3 border-t cut-line pt-3 space-y-3">
                    <div className="space-y-2">
                      {c.items.length === 0 && (
                        <p className="text-xs text-[var(--color-muted)]">هنوز محصولی اضافه نشده.</p>
                      )}
                      {c.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 text-xs bg-[var(--color-linen-dim)]/40 rounded-lg px-3 py-2">
                          <span className="truncate">
                            {item.source === "MAZON"
                              ? products.find((p) => p.id === item.productId)?.title ?? "محصولِ مزون"
                              : item.title ?? "محصولِ ترندیول"}{" "}
                            <span className="text-[var(--color-muted)]">
                              ({item.source === "MAZON" ? "مزون" : "ترندیول"})
                            </span>
                          </span>
                          <button onClick={() => removeItem(c.id, item.id)} className="text-red-600 shrink-0">
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>

                    {addItemError && <p className="text-xs text-red-600">{addItemError}</p>}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          placeholder="جست‌وجوی محصولِ مزون با عنوان..."
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          className="border cut-line rounded-lg px-3 py-1.5 text-xs w-full"
                        />
                        {filteredProducts.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border cut-line rounded-lg shadow max-h-48 overflow-auto">
                            {filteredProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={addingItem}
                                onClick={() => addMazonItem(c.id, p.id)}
                                className="block w-full text-right px-3 py-2 text-xs hover:bg-[var(--color-linen-dim)]"
                              >
                                {p.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="لینک یا شناسه‌ی محصولِ ترندیول/میلا"
                          value={trendyolInput}
                          onChange={(e) => setTrendyolInput(e.target.value)}
                          className="border cut-line rounded-lg px-3 py-1.5 text-xs flex-1"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          disabled={addingItem}
                          onClick={() => addTrendyolItem(c.id)}
                          className="text-xs bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full disabled:opacity-50 shrink-0"
                        >
                          {addingItem ? "..." : "افزودن"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
