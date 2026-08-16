"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { BrandCombobox } from "@/components/BrandCombobox";
import { ImageUploadField } from "@/components/ImageUploadField";

type Category = { id: string; name: string; parentId: string | null };
type Brand = { id: string; name: string };
type SizeGuide = {
  id: string;
  categoryId: string;
  brandId: string;
  imageUrl: string;
  category: { name: string };
  brand: { name: string };
};

export default function AdminSizeGuidesPage() {
  const [sizeGuides, setSizeGuides] = useState<SizeGuide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [sRes, cRes, bRes] = await Promise.all([
      fetch("/api/admin/size-guides"),
      fetch("/api/admin/categories"),
      fetch("/api/admin/brands"),
    ]);
    if (sRes.ok) setSizeGuides(await sRes.json());
    if (cRes.ok) setCategories(await cRes.json());
    if (bRes.ok) setBrands(await bRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  const existingForCombo = sizeGuides.find(
    (g) => g.categoryId === categoryId && g.brandId === brandId
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!categoryId) {
      setError("انتخاب دسته‌بندی الزامی است");
      return;
    }
    if (!brandId) {
      setError("انتخاب برند الزامی است");
      return;
    }
    if (!imageUrl) {
      setError("آپلود عکس راهنمای سایز الزامی است");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/size-guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, brandId, imageUrl }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره راهنمای سایز");
      return;
    }

    setCategoryId("");
    setBrandId("");
    setImageUrl("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این راهنمای سایز قطعی است؟")) return;
    await fetch(`/api/admin/size-guides/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-2">افزودن راهنمای سایز</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          برای هر ترکیب «دسته‌بندی + برند» یک عکس راهنمای سایز تعریف کن (مثلا از سایت اصلی برند
          برداشته شده). توی صفحه محصولی که همین ترکیب رو داره، دکمه «راهنمای سایز» نمایش داده
          می‌شه. اگه از قبل برای این ترکیب راهنما ثبت شده باشه، با ذخیره دوباره فقط عکسش عوض می‌شه.
        </p>
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
          <BrandCombobox
            brands={brands}
            value={brandId}
            onChange={setBrandId}
            onBrandCreated={(b) => setBrands((prev) => [...prev, b])}
            rootLabel=""
            placeholder="انتخاب برند..."
          />

          {existingForCombo && (
            <p className="text-xs text-[var(--color-ochre)] sm:col-span-2">
              برای این ترکیب از قبل راهنما ثبت شده — با ذخیره، عکس قبلی جایگزین می‌شه.
            </p>
          )}

          <div className="sm:col-span-2">
            <ImageUploadField value={imageUrl} onChange={setImageUrl} />
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره راهنمای سایز"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">راهنماهای موجود ({sizeGuides.length})</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sizeGuides.map((g) => (
            <div key={g.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
              <div className="relative w-full h-32 rounded-lg overflow-hidden bg-[var(--color-linen-dim)] mb-2">
                <Image src={g.imageUrl} alt="" fill className="object-cover" unoptimized />
              </div>
              <p className="font-medium">{g.brand.name}</p>
              <p className="text-[var(--color-muted)] text-xs mb-2">{g.category.name}</p>
              <button onClick={() => handleDelete(g.id)} className="text-red-600 hover:underline text-xs">
                حذف
              </button>
            </div>
          ))}
          {sizeGuides.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">هنوز راهنمای سایزی ثبت نشده.</p>
          )}
        </div>
      </div>
    </div>
  );
}
