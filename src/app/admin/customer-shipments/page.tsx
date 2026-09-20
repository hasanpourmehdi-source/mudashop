"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  image: string;
  caption: string | null;
  isPublished: boolean;
  createdAt: string;
  product: { title: string; slug: string } | null;
};

export default function AdminCustomerShipmentsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [image, setImage] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/customer-shipments");
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok && data.url) setImage(data.url);
    else alert(data.error ?? "آپلود ناموفق بود");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return alert("عکس را آپلود کنید");
    setSaving(true);
    const res = await fetch("/api/admin/customer-shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, caption: caption || undefined, isPublished: true }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "خطا");
      return;
    }
    setImage("");
    setCaption("");
    load();
  }

  async function togglePublish(item: Item) {
    await fetch(`/api/admin/customer-shipments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف شود؟")) return;
    await fetch(`/api/admin/customer-shipments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-6">ارسالی مشتریان</h1>

      <form onSubmit={handleCreate} className="border cut-line rounded-xl p-4 bg-white space-y-3 mb-8">
        <h2 className="font-bold">افزودن ارسالی جدید</h2>
        <div>
          <label className="block text-sm font-medium mb-1">عکس</label>
          <input type="file" accept="image/*" onChange={handleUpload} className="text-sm" />
          {uploading && <p className="text-xs text-[var(--color-muted)] mt-1">در حال آپلود...</p>}
          {image && <img src={image} alt="" className="mt-2 w-32 h-32 object-cover rounded-lg border" />}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">کپشن (اختیاری)</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="مثلاً: ارسالی خانم احمدی - تهران"
            className="w-full border cut-line rounded-lg px-3 py-2 bg-white text-sm"
            maxLength={300}
          />
        </div>
        <button
          type="submit"
          disabled={saving || uploading || !image}
          className="bg-[var(--color-wine)] text-white px-6 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "افزودن و انتشار"}
        </button>
      </form>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="border cut-line rounded-xl overflow-hidden bg-white">
            <img src={item.image} alt={item.caption ?? ""} className="w-full aspect-[4/3] object-cover" />
            {item.caption && <p className="text-sm p-3">{item.caption}</p>}
            <div className="flex items-center gap-2 p-3 border-t cut-line">
              <span className={`text-xs px-2 py-1 rounded-full ${item.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>
                {item.isPublished ? "منتشر شده" : "پیش‌نویس"}
              </span>
              <button onClick={() => togglePublish(item)} className="text-xs underline mr-auto">
                {item.isPublished ? "عدم انتشار" : "انتشار"}
              </button>
              <button onClick={() => handleDelete(item.id)} className="text-xs text-red-600">
                حذف
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[var(--color-muted)] col-span-2">هنوز ارسالی‌ای ثبت نشده.</p>}
      </div>
    </div>
  );
}
