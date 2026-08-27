"use client";

import { useEffect, useState } from "react";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  body: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const emptyForm = { title: "", slug: "", excerpt: "", coverImage: "", body: "" };

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editUploadingCover, setEditUploadingCover] = useState(false);

  function load() {
    fetch("/api/admin/blog")
      .then((res) => (res.ok ? res.json() : []))
      .then(setPosts)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function slugify(title: string) {
    return title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^؀-ۿa-z0-9-]/g, "");
  }

  async function uploadCover(file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (res.ok) setter(data.url);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt || undefined,
        coverImage: form.coverImage || undefined,
        body: form.body,
        isPublished: false,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره پست");
      return;
    }
    setForm(emptyForm);
    load();
  }

  async function togglePublish(id: string, isPublished: boolean) {
    await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !isPublished }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این پست قطعی است؟")) return;
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(p: Post) {
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      coverImage: p.coverImage ?? "",
      body: p.body,
    });
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        slug: editForm.slug,
        excerpt: editForm.excerpt || undefined,
        coverImage: editForm.coverImage || undefined,
        body: editForm.body,
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

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-1">مجله / بلاگ</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          پست‌ها تا وقتی «منتشر کن» رو نزنی، توی سایت عمومی نشون داده نمی‌شن.
        </p>

        <form onSubmit={handleCreate} className="space-y-3 max-w-2xl border cut-line rounded-lg p-4 bg-white">
          <input
            placeholder="عنوان پست"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            placeholder="اسلاگ (اختیاری -- خالی بذاری خودکار از عنوان می‌سازیم)"
            dir="ltr"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            placeholder="خلاصه (اختیاری -- توی لیست مجله نشون داده می‌شه)"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs border cut-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-[var(--color-wine)]">
              {uploadingCover ? "در حال آپلود..." : form.coverImage ? "تعویض عکس کاور" : "📷 آپلود عکس کاور"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploadingCover}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadCover(file, (url) => setForm((f) => ({ ...f, coverImage: url })), setUploadingCover);
                }}
              />
            </label>
            {form.coverImage && (
              <button type="button" onClick={() => setForm({ ...form, coverImage: "" })} className="text-xs text-red-600 hover:underline">
                حذف عکس
              </button>
            )}
          </div>
          <textarea
            placeholder="متن کامل پست (پاراگراف‌ها رو با یه خط خالی از هم جدا کن)"
            required
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={8}
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره پیش‌نویس"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">پست‌ها ({posts.length})</h2>
        <div className="space-y-2">
          {posts.map((p) =>
            editingId === p.id ? (
              <form
                key={p.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(p.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  required
                />
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  dir="ltr"
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                  required
                />
                <input
                  value={editForm.excerpt}
                  onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                  placeholder="خلاصه"
                  className="w-full border cut-line rounded-lg px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs border cut-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-[var(--color-wine)]">
                    {editUploadingCover ? "در حال آپلود..." : "تعویض عکس کاور"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={editUploadingCover}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadCover(file, (url) => setEditForm((f) => ({ ...f, coverImage: url })), setEditUploadingCover);
                      }}
                    />
                  </label>
                  {editForm.coverImage && (
                    <button type="button" onClick={() => setEditForm({ ...editForm, coverImage: "" })} className="text-xs text-red-600 hover:underline">
                      حذف عکس
                    </button>
                  )}
                </div>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={8}
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
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--color-muted)]">
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              <div key={p.id} className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-[var(--color-muted)] text-xs" dir="ltr">
                    /blog/{p.slug}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePublish(p.id, p.isPublished)}
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      p.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.isPublished ? "منتشرشده" : "منتشر کن"}
                  </button>
                  <button onClick={() => startEdit(p)} className="text-[var(--color-wine)] hover:underline">
                    ویرایش
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
                    حذف
                  </button>
                </div>
              </div>
            )
          )}
          {posts.length === 0 && <p className="text-sm text-[var(--color-muted)]">هنوز پستی ثبت نشده.</p>}
        </div>
      </div>
    </div>
  );
}
