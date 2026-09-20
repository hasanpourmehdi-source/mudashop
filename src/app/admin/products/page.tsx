"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { VariantBuilder, VariantRow } from "@/components/VariantBuilder";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { BrandCombobox } from "@/components/BrandCombobox";
import { effectiveCategoryAttributeSettings } from "@/lib/categoryTree";
import { SpecificationsEditor, SpecRow } from "@/components/SpecificationsEditor";
import { ImageListEditor } from "@/components/ImageListEditor";
import { ColorImageMapper } from "@/components/ColorImageMapper";
import { CurrencyInput } from "@/components/CurrencyInput";
import { VariantMeasurementsEditor } from "@/components/VariantMeasurementsEditor";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ImageUploadField } from "@/components/ImageUploadField";
import { parseVariantMeasurements, type VariantMeasurement } from "@/lib/productMeasurements";

type AttributeValue = { id: string; value: string };
type Attribute = {
  id: string;
  name: string;
  values: AttributeValue[];
  group: { id: string; name: string } | null;
};
type Category = {
  id: string;
  name: string;
  parentId: string | null;
  attributes: { attribute: Attribute; fixedValue: string | null }[];
};
type Brand = { id: string; name: string };
type ExistingVariant = {
  id: string;
  sku: string;
  stock: number;
  priceDiff: number;
  values: { attribute: string; value: string }[];
  measurements: VariantMeasurement[];
};
type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  brandId: string | null;
  basePrice: number;
  discount: number;
  images: string;
  colorImages: string;
  fastShipping: boolean;
  isReturnable: boolean;
  defectNote: string | null;
  defectImage: string | null;
  careInstructions: string | null;
  videoUrl: string | null;
  isActive: boolean;
  categoryId: string;
  category: { name: string };
  variants: ExistingVariant[];
  specifications: SpecRow[];
};

function firstImage(images: string) {
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) ? arr[0] ?? "" : images;
  } catch {
    return images;
  }
}

function parseImages(images: string): string[] {
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) ? arr : [images];
  } catch {
    return [images];
  }
}

function parseColorImagesJson(json: string): Record<string, string[]> {
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

// مقادیر متمایز ویژگی «رنگ» رو از روی ترکیب‌های تعریف‌شده استخراج می‌کنه (هم VariantBuilder، هم ترکیب‌های موجود)
function detectColorValues(rows: { values: { attribute: string; value: string }[] }[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const v of row.values) {
      if (v.attribute.includes("رنگ")) set.add(v.value);
    }
  }
  return Array.from(set);
}

// ویژگی‌های ثابتِ این دسته‌بندی (خودش یا هر کدوم از والدهاش، نزدیک‌ترین برنده‌ست) -- مثلا «جنسیت: زنانه»
// این‌ها روی محصول قابل تغییر نیستن، فقط برای اطلاع نمایش داده می‌شن
function getInheritedFixedAttributes(
  categoryId: string,
  categories: Category[]
): { name: string; value: string }[] {
  return effectiveCategoryAttributeSettings(categories, categoryId)
    .filter((a) => a.fixedValue)
    .map((a) => ({ name: a.attributeName, value: a.fixedValue as string }));
}

// ویژگی‌های غیرثابتی که VariantBuilder باید نشون بده -- باید از خود دسته یا
// والدهاش بیاد (ارث‌بری)، نه فقط دسته‌ی دقیق انتخاب‌شده. قبلاً این بخش فقط
// categories.find(c => c.id === categoryId)?.attributes رو می‌خوند که یعنی
// دسته‌های فرزند (مثلا «لباس مجلسی» زیر «پوشاک») هیچ ویژگی‌ای نشون نمی‌دادن
// چون خودشون مستقیماً چیزی وصل نداشتن -- با اینکه بقیه‌ی سایت (فروشگاه،
// فیلترها) این ارث‌بری رو درست انجام می‌دن.
function getInheritedVariantAttributes(
  categoryId: string,
  categories: Category[]
): (Attribute & { groupId?: string; groupName?: string })[] {
  const effective = effectiveCategoryAttributeSettings(categories, categoryId).filter(
    (a) => !a.fixedValue
  );
  const byAttributeId = new Map<string, Attribute>();
  for (const c of categories) {
    for (const ca of c.attributes) {
      if (!byAttributeId.has(ca.attribute.id)) byAttributeId.set(ca.attribute.id, ca.attribute);
    }
  }
  return effective
    .map((a) => byAttributeId.get(a.attributeId))
    .filter((a): a is Attribute => !!a)
    .map((a) => ({ ...a, groupId: a.group?.id, groupName: a.group?.name }));
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string[]>>({});
  const [fastShipping, setFastShipping] = useState(false);
  const [isReturnable, setIsReturnable] = useState(true);
  const [defectNote, setDefectNote] = useState("");
  const [defectImage, setDefectImage] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [variantBuilderKey, setVariantBuilderKey] = useState(0); // برای ریست کردن builder بعد از ذخیره
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    brandId: "",
    basePrice: "",
    discount: "0",
    categoryId: "",
  });
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState(false);
  const [imagesError, setImagesError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    brandId: "",
    basePrice: "",
    discount: "0",
    categoryId: "",
  });
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editColorImages, setEditColorImages] = useState<Record<string, string[]>>({});
  const [editFastShipping, setEditFastShipping] = useState(false);
  const [editIsReturnable, setEditIsReturnable] = useState(true);
  const [editDefectNote, setEditDefectNote] = useState("");
  const [editDefectImage, setEditDefectImage] = useState("");
  const [editCareInstructions, setEditCareInstructions] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editUploadingVideo, setEditUploadingVideo] = useState(false);
  const [editError, setEditError] = useState("");
  const [editCategoryError, setEditCategoryError] = useState(false);
  const [editImagesError, setEditImagesError] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ویرایش ترکیب‌های variant موجود + افزودن ترکیب جدید
  const [editExistingVariants, setEditExistingVariants] = useState<ExistingVariant[]>([]);
  const [editDeletedVariantIds, setEditDeletedVariantIds] = useState<string[]>([]);
  const [editNewVariants, setEditNewVariants] = useState<VariantRow[]>([]);
  const [editVariantBuilderKey, setEditVariantBuilderKey] = useState(0);
  const [editSpecs, setEditSpecs] = useState<SpecRow[]>([]);

  async function load() {
    const [pRes, cRes, bRes] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/categories"),
      fetch("/api/admin/brands"),
    ]);
    if (pRes.ok) {
      // measurements از سرور یه JSON-استرینگه (مثلِ images/colorImages)، ولی
      // برخلافِ اون‌ها که هر جا لازم شد جدا parse می‌شن، این‌جا همون اول parse
      // می‌کنیم چون هم توی لیست هم توی فرمِ ویرایش، به شکلِ آرایه‌ی قابل‌ویرایش لازمه
      const raw: (Omit<Product, "variants"> & {
        variants: (Omit<ExistingVariant, "measurements"> & { measurements: string | null })[];
      })[] = await pRes.json();
      setProducts(
        raw.map((p) => ({
          ...p,
          variants: p.variants.map((v) => ({ ...v, measurements: parseVariantMeasurements(v.measurements) })),
        }))
      );
    }
    if (cRes.ok) setCategories(await cRes.json());
    if (bRes.ok) setBrands(await bRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  // آپلودِ فایلِ ویدیو -- از همون اندپوینتِ آپلودِ نظرات استفاده می‌کنیم (mp4/webm/mov
  // رو از قبل پشتیبانی می‌کنه)، چون اندپوینتِ عمومیِ آپلودِ ادمین فقط عکسه
  async function uploadVideo(file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/reviews/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (res.ok) setter(data.url);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCategoryError(false);
    setImagesError(false);

    if (!form.categoryId) {
      setError("انتخاب دسته‌بندی الزامی است");
      setCategoryError(true);
      return;
    }
    if (images.length === 0) {
      setError("حداقل یک تصویر لازم است");
      setImagesError(true);
      return;
    }

    setSaving(true);

    // اگه variant ساخته شده، SKU رو با پیشوند اسلاگ محصول یکتا می‌کنیم
    // ترکیب‌هایی که موجودیشون صفره اصلاً ذخیره نمی‌شن -- عدم وجود یعنی عدم موجودی
    const variantsPayload = variants
      .filter((v) => v.stock > 0)
      .map((v) => ({
        sku: `${form.slug}-${v.comboKey}`.toUpperCase(),
        stock: v.stock,
        priceDiff: v.priceDiff,
        values: v.values,
      }));

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        slug: form.slug,
        description: form.description,
        brandId: form.brandId || undefined,
        basePrice: Number(form.basePrice),
        discount: Number(form.discount),
        images,
        colorImages,
        fastShipping,
        isReturnable,
        defectNote: defectNote || undefined,
        defectImage: defectImage || undefined,
        careInstructions: careInstructions || undefined,
        videoUrl: videoUrl || undefined,
        categoryId: form.categoryId,
        variants: variantsPayload.length > 0 ? variantsPayload : undefined,
        specifications: specs.length > 0 ? specs : undefined,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره‌سازی");
      return;
    }

    setForm({
      title: "",
      slug: "",
      description: "",
      brandId: "",
      basePrice: "",
      discount: "0",
      categoryId: "",
    });
    setVariants([]);
    setSpecs([]);
    setImages([]);
    setColorImages({});
    setFastShipping(false);
    setIsReturnable(true);
    setDefectNote("");
    setDefectImage("");
    setCareInstructions("");
    setVideoUrl("");
    setVariantBuilderKey((k) => k + 1);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این محصول قطعی است؟")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      description: p.description,
      brandId: p.brandId ?? "",
      basePrice: String(p.basePrice),
      discount: String(p.discount),
      categoryId: p.categoryId,
    });
    setEditImages(parseImages(p.images));
    setEditColorImages(parseColorImagesJson(p.colorImages ?? "{}"));
    setEditFastShipping(p.fastShipping);
    setEditIsReturnable(p.isReturnable);
    setEditDefectNote(p.defectNote ?? "");
    setEditDefectImage(p.defectImage ?? "");
    setEditCareInstructions(p.careInstructions ?? "");
    setEditVideoUrl(p.videoUrl ?? "");
    setEditExistingVariants(p.variants);
    setEditDeletedVariantIds([]);
    setEditNewVariants([]);
    setEditVariantBuilderKey((k) => k + 1);
    setEditSpecs(p.specifications ?? []);
    setEditError("");
  }

  function markVariantDeleted(variantId: string) {
    setEditExistingVariants((prev) => prev.filter((v) => v.id !== variantId));
    setEditDeletedVariantIds((prev) => [...prev, variantId]);
  }

  function updateExistingVariantField(
    variantId: string,
    field: "stock" | "priceDiff",
    value: number
  ) {
    setEditExistingVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, [field]: value } : v))
    );
  }

  function updateExistingVariantMeasurements(variantId: string, measurements: VariantMeasurement[]) {
    setEditExistingVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, measurements } : v))
    );
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditCategoryError(false);
    setEditImagesError(false);
    if (!editForm.categoryId) {
      setEditError("انتخاب دسته‌بندی الزامی است");
      setEditCategoryError(true);
      return;
    }
    if (editImages.length === 0) {
      setEditError("حداقل یک تصویر لازم است");
      setEditImagesError(true);
      return;
    }
    setEditSaving(true);

    const editingProduct = products.find((p) => p.id === id);

    // ترکیب‌هایی که تو بخش «افزودن ترکیب جدید» تولید شدن ولی در واقع با یه ترکیب
    // از قبل موجود یکی بودن (existingVariantId داره) -- این‌ها به‌جای ساخت تکراری،
    // همون ترکیب موجود رو آپدیت می‌کنن (نه اینکه رکورد جدید بسازن)
    const matchedExistingUpdates = editNewVariants.filter((v) => v.existingVariantId);
    const genuinelyNewVariants = editNewVariants.filter((v) => !v.existingVariantId);

    // ترکیب‌های جدید واقعی -- موجودی صفر اصلاً ذخیره نمی‌شه
    const newVariantsPayload = genuinelyNewVariants
      .filter((v) => v.stock > 0)
      .map((v) => ({
        sku: `${editingProduct?.slug ?? id}-${v.comboKey}-${Date.now()}`.toUpperCase(),
        stock: v.stock,
        priceDiff: v.priceDiff,
        values: v.values,
      }));

    // توجه: ساخت یه دسته‌ی ترکیب جدید، دسته‌های قبلی رو حذف نمی‌کنه -- ممکنه چند دسته از
    // ترکیب‌های جدا هم‌زمان موجودی داشته باشن. فقط اگه یه ترکیب دقیقاً با یکی از ترکیب‌های
    // موجود یکی باشه، به‌جای رکورد تکراری، همون رو آپدیت می‌کنیم
    const matchedById = new Map(matchedExistingUpdates.map((v) => [v.existingVariantId!, v]));
    const allTrackedExisting = editExistingVariants.map((v) => {
      const override = matchedById.get(v.id);
      // override از فرمِ «ترکیب جدید که در واقع با یکی موجود یکی درومد» میاد -- این
      // فرم اصلاً مفهومِ measurements نداره، پس اندازه‌ی قبلیِ ترکیب دست‌نخورده می‌مونه
      return override ? { id: v.id, stock: override.stock, priceDiff: override.priceDiff, measurements: v.measurements } : v;
    });

    // ترکیب‌هایی که موجودیشون به صفر رسیده، به‌جای آپدیت، حذف می‌شن (عدم وجود = عدم موجودی)
    const zeroedOutIds = allTrackedExisting.filter((v) => v.stock <= 0).map((v) => v.id);
    const variantUpdatesPayload = allTrackedExisting
      .filter((v) => v.stock > 0)
      .map((v) => ({ id: v.id, stock: v.stock, priceDiff: v.priceDiff, measurements: v.measurements }));

    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description,
        brandId: editForm.brandId || undefined,
        basePrice: Number(editForm.basePrice),
        discount: Number(editForm.discount),
        images: editImages,
        colorImages: editColorImages,
        fastShipping: editFastShipping,
        isReturnable: editIsReturnable,
        defectNote: editDefectNote,
        defectImage: editDefectImage,
        careInstructions: editCareInstructions,
        videoUrl: editVideoUrl,
        categoryId: editForm.categoryId,
        variantUpdates: variantUpdatesPayload,
        variantDeleteIds: [...editDeletedVariantIds, ...zeroedOutIds],
        newVariants: newVariantsPayload.length > 0 ? newVariantsPayload : undefined,
        specifications: editSpecs,
      }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    if (data.note) alert(data.note);
    setEditingId(null);
    load();
  }

  function renderProduct(p: Product) {
    return (
editingId === p.id ? (
              <form
                key={p.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(p.id);
                }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-2"
              >
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="عنوان"
                    required
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <BrandCombobox
                    brands={brands}
                    value={editForm.brandId}
                    onChange={(id) => setEditForm({ ...editForm, brandId: id })}
                    onBrandCreated={(b) => setBrands((prev) => [...prev, b])}
                  />
                  <CategoryCombobox
                    categories={categories}
                    value={editForm.categoryId}
                    onChange={(id) => {
                      setEditForm({ ...editForm, categoryId: id });
                      if (id) setEditCategoryError(false);
                    }}
                    invalid={editCategoryError}
                  />
                  <CurrencyInput
                    value={editForm.basePrice}
                    onChange={(v) => setEditForm({ ...editForm, basePrice: v })}
                    placeholder="قیمت پایه"
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={editForm.discount}
                    onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })}
                    placeholder="درصد تخفیف"
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <div className="sm:col-span-2">
                    <ImageListEditor
                      images={editImages}
                      onChange={(imgs) => {
                        setEditImages(imgs);
                        if (imgs.length > 0) setEditImagesError(false);
                      }}
                      invalid={editImagesError}
                    />
                  </div>
                  <RichTextEditor
                    value={editForm.description}
                    onChange={(html) => setEditForm({ ...editForm, description: html })}
                    placeholder="توضیحات"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-muted)]">
                  ترکیب‌های variant موجود رو پایین می‌تونی ویرایش/حذف کنی، یا ترکیب جدید اضافه کنی.
                  (ترکیب‌هایی که موجودیشون صفره، اینجا نشون داده نمی‌شن.)
                </p>

                {editExistingVariants.filter((v) => v.stock > 0).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">ترکیب‌های موجود</p>
                    {editExistingVariants
                      .filter((v) => v.stock > 0)
                      .map((v) => (
                        <div key={v.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-xs">
                            {v.values.map((val) => `${val.attribute}: ${val.value}`).join(" / ")}
                          </span>
                          <input
                            type="number"
                            value={v.stock}
                            onChange={(e) =>
                              updateExistingVariantField(v.id, "stock", Number(e.target.value))
                            }
                            placeholder="موجودی"
                            className="w-20 border cut-line rounded-lg px-2 py-1 text-xs"
                          />
                          <CurrencyInput
                            value={String(v.priceDiff)}
                            onChange={(val) =>
                              updateExistingVariantField(v.id, "priceDiff", Number(val) || 0)
                            }
                            allowNegative
                            placeholder="اختلاف قیمت"
                            className="w-24 border cut-line rounded-lg px-2 py-1 text-xs"
                          />
                          <VariantMeasurementsEditor
                            measurements={v.measurements}
                            onChange={(m) => updateExistingVariantMeasurements(v.id, m)}
                          />
                          <button
                            type="button"
                            onClick={() => markVariantDeleted(v.id)}
                            className="text-red-600 hover:underline text-xs shrink-0"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium mb-2">افزودن ترکیب جدید</p>
                  <p className="text-[10px] text-[var(--color-muted)] mb-2">
                    ترکیب‌های قبلی (بالا) دست‌نخورده می‌مونن. اگه یه ترکیب جدید دقیقاً با یکی از
                    ترکیب‌های موجود یکی باشه، به‌جای رکورد تکراری، همون یکی آپدیت می‌شه.
                  </p>
                  {editForm.categoryId &&
                    (() => {
                      const fixedAttrs = getInheritedFixedAttributes(editForm.categoryId, categories);
                      if (fixedAttrs.length === 0) return null;
                      return (
                        <div className="bg-[var(--color-linen-dim)] rounded-lg p-3 text-sm mb-2">
                          <p className="text-xs text-[var(--color-muted)] mb-1.5">
                            ویژگی‌های ثابتِ این دسته (از خود دسته یا والدش، غیرقابل‌تغییر روی محصول):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {fixedAttrs.map((a) => (
                              <span
                                key={a.name}
                                className="bg-white border cut-line rounded-full px-3 py-1 text-xs"
                              >
                                {a.name}: <strong>{a.value}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  <VariantBuilder
                    key={`${editForm.categoryId}-${editVariantBuilderKey}`}
                    attributes={getInheritedVariantAttributes(editForm.categoryId, categories)}
                    existingCombos={editExistingVariants.map((v) => ({
                      id: v.id,
                      stock: v.stock,
                      priceDiff: v.priceDiff,
                      values: v.values,
                    }))}
                    onChange={setEditNewVariants}
                  />
                </div>

                <ColorImageMapper
                  images={editImages}
                  colorValues={detectColorValues([...editExistingVariants, ...editNewVariants])}
                  value={editColorImages}
                  onChange={setEditColorImages}
                />

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editFastShipping}
                    onChange={(e) => setEditFastShipping(e.target.checked)}
                  />
                  🚚 ارسال فوری (نمایش بج توی صفحه محصول)
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editIsReturnable}
                    onChange={(e) => setEditIsReturnable(e.target.checked)}
                  />
                  ↩️ قابل مرجوع (اگه تیک برداری، این محصول از قابلیتِ مرجوعیِ سراسری مستثنی می‌شه)
                </label>

                <div className="border cut-line rounded-lg p-3 space-y-2 bg-[var(--color-linen-dim)]">
                  <label className="text-xs font-medium block">⚠️ ایراد دار (اختیاری)</label>
                  <textarea
                    value={editDefectNote}
                    onChange={(e) => setEditDefectNote(e.target.value)}
                    placeholder="مثلاً: این محصول شامل ایراد دوخت آستین می‌باشد."
                    rows={2}
                    className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs bg-white"
                  />
                  <ImageUploadField value={editDefectImage} onChange={setEditDefectImage} />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">نحوه مصرف / نگهداری (اختیاری)</label>
                  <textarea
                    value={editCareInstructions}
                    onChange={(e) => setEditCareInstructions(e.target.value)}
                    rows={3}
                    className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">ویدیوی رسمی محصول (اختیاری)</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs border cut-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-[var(--color-wine)]">
                      {editUploadingVideo ? "در حال آپلود..." : editVideoUrl ? "تعویض ویدیو" : "📹 آپلود ویدیو"}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        hidden
                        disabled={editUploadingVideo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) uploadVideo(file, setEditVideoUrl, setEditUploadingVideo);
                        }}
                      />
                    </label>
                    {editVideoUrl && (
                      <button type="button" onClick={() => setEditVideoUrl("")} className="text-xs text-red-600 hover:underline">
                        حذف ویدیو
                      </button>
                    )}
                  </div>
                </div>

                <SpecificationsEditor specs={editSpecs} onChange={setEditSpecs} />

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
                key={p.id}
                className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-[var(--color-linen-dim)]">
                    {firstImage(p.images) && (
                      <Image
                        src={firstImage(p.images)}
                        alt={p.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-[var(--color-muted)] text-xs">
                      {p.category?.name} · {p.basePrice.toLocaleString("fa-IR")} تومان
                      {p.discount > 0 && ` · ${p.discount}% تخفیف`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <a
                    href={`/products/mazon/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-ochre)] hover:underline"
                  >
                    پیش‌نمایش
                  </a>
                  <button onClick={() => startEdit(p)} className="text-[var(--color-wine)] hover:underline">
                    ویرایش
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
                    حذف
                  </button>
                </div>
              </div>
            )
    );
  }

  type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

  function buildCategoryTree(cats: Category[]): CategoryTreeNode[] {
    const byParent = new Map<string | null, Category[]>();
    for (const c of cats) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    function build(parentId: string | null): CategoryTreeNode[] {
      return (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    }
    return build(null);
  }

  const productsByCategory = new Map<string, Product[]>();
  for (const p of products) {
    const list = productsByCategory.get(p.categoryId) ?? [];
    list.push(p);
    productsByCategory.set(p.categoryId, list);
  }

  function countProductsInSubtree(node: CategoryTreeNode): number {
    let count = (productsByCategory.get(node.id) ?? []).length;
    for (const child of node.children) count += countProductsInSubtree(child);
    return count;
  }

  // یه دسته که نه خودش نه هیچ‌کدوم از زیرمجموعه‌هاش محصولی ندارن، نشون داده نمی‌شه --
  // این‌طوری درخت شلوغ دسته‌های خالی رو پر نمی‌کنه
  function renderCategoryGroup(node: CategoryTreeNode, depth: number): React.ReactNode {
    const total = countProductsInSubtree(node);
    if (total === 0) return null;
    const directProducts = productsByCategory.get(node.id) ?? [];
    return (
      <details key={node.id} open={depth < 1} className="border cut-line rounded-lg overflow-hidden">
        <summary
          className="cursor-pointer select-none px-3 py-2 font-bold bg-[var(--color-linen-dim)] text-sm"
          style={{ paddingRight: `${12 + depth * 16}px` }}
        >
          {node.name} ({total})
        </summary>
        <div className="p-2 space-y-2">
          {directProducts.map((p) => renderProduct(p))}
          {node.children.map((child) => renderCategoryGroup(child, depth + 1))}
        </div>
      </details>
    );
  }

  const categoryTree = buildCategoryTree(categories);
  const categoryIds = new Set(categories.map((c) => c.id));
  const uncategorizedProducts = products.filter((p) => !categoryIds.has(p.categoryId));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">افزودن محصول مزون جدید</h1>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <input
            placeholder="عنوان محصول"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            placeholder="اسلاگ (انگلیسی، یکتا)"
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
            dir="ltr"
          />
          <BrandCombobox
            brands={brands}
            value={form.brandId}
            onChange={(id) => setForm({ ...form, brandId: id })}
            onBrandCreated={(b) => setBrands((prev) => [...prev, b])}
          />
          <CategoryCombobox
            categories={categories}
            value={form.categoryId}
            onChange={(id) => {
              setForm({ ...form, categoryId: id });
              if (id) setCategoryError(false);
            }}
            invalid={categoryError}
          />
          {categories.length === 0 && (
            <p className="text-xs text-[var(--color-ochre)] sm:col-span-2">
              هنوز دسته‌بندی‌ای نساختی — اول از صفحه «دسته‌بندی‌ها» یکی بساز.
            </p>
          )}
          <CurrencyInput
            placeholder="قیمت پایه (تومان)"
            required
            value={form.basePrice}
            onChange={(v) => setForm({ ...form, basePrice: v })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            type="number"
            placeholder="درصد تخفیف"
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <div className="sm:col-span-2">
            <ImageListEditor
              images={images}
              onChange={(imgs) => {
                setImages(imgs);
                if (imgs.length > 0) setImagesError(false);
              }}
              invalid={imagesError}
            />
          </div>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm({ ...form, description: html })}
            placeholder="توضیحات"
          />

          {form.categoryId &&
            (() => {
              const fixedAttrs = getInheritedFixedAttributes(form.categoryId, categories);
              if (fixedAttrs.length === 0) return null;
              return (
                <div className="sm:col-span-2 bg-[var(--color-linen-dim)] rounded-lg p-3 text-sm">
                  <p className="text-xs text-[var(--color-muted)] mb-1.5">
                    ویژگی‌های ثابتِ این دسته (از خود دسته یا والدش، غیرقابل‌تغییر روی محصول):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fixedAttrs.map((a) => (
                      <span
                        key={a.name}
                        className="bg-white border cut-line rounded-full px-3 py-1 text-xs"
                      >
                        {a.name}: <strong>{a.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

          <div className="sm:col-span-2">
            <VariantBuilder
              key={`${form.categoryId}-${variantBuilderKey}`}
              attributes={getInheritedVariantAttributes(form.categoryId, categories)}
              onChange={setVariants}
            />
          </div>

          <div className="sm:col-span-2">
            <ColorImageMapper
              images={images}
              colorValues={detectColorValues(variants)}
              value={colorImages}
              onChange={setColorImages}
            />
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fastShipping}
              onChange={(e) => setFastShipping(e.target.checked)}
            />
            🚚 ارسال فوری (نمایش بج توی صفحه محصول)
          </label>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isReturnable}
              onChange={(e) => setIsReturnable(e.target.checked)}
            />
            ↩️ قابل مرجوع (اگه تیک برداری، این محصول از قابلیتِ مرجوعیِ سراسری مستثنی می‌شه)
          </label>

          <div className="sm:col-span-2 border cut-line rounded-lg p-3 space-y-2 bg-[var(--color-linen-dim)]">
            <label className="text-sm font-medium block">⚠️ ایراد دار (اختیاری)</label>
            <p className="text-[11px] text-[var(--color-muted)]">
              اگه این محصول نقصِ جزئی داره (مثلاً ایرادِ دوخت) و می‌خوای شفاف و ارزون‌تر بفروشیش، این
              دو تا رو پر کن -- بجِ «ایراد دار» + توضیحِ نقص روی صفحه‌ی محصول نشون داده می‌شه. حتماً
              «قابل مرجوع» رو هم بالا خاموش کن.
            </p>
            <textarea
              value={defectNote}
              onChange={(e) => setDefectNote(e.target.value)}
              placeholder="مثلاً: این محصول شامل ایراد دوخت آستین می‌باشد."
              rows={2}
              className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
            />
            <ImageUploadField value={defectImage} onChange={setDefectImage} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium block mb-1">نحوه مصرف / نگهداری (اختیاری)</label>
            <textarea
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
              placeholder="مثلاً دستور شست‌وشو، یا نحوه‌ی استفاده..."
              rows={3}
              className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium block mb-1">ویدیوی رسمی محصول (اختیاری)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs border cut-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-[var(--color-wine)]">
                {uploadingVideo ? "در حال آپلود..." : videoUrl ? "تعویض ویدیو" : "📹 آپلود ویدیو"}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  hidden
                  disabled={uploadingVideo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadVideo(file, setVideoUrl, setUploadingVideo);
                  }}
                />
              </label>
              {videoUrl && (
                <button type="button" onClick={() => setVideoUrl("")} className="text-xs text-red-600 hover:underline">
                  حذف ویدیو
                </button>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <SpecificationsEditor specs={specs} onChange={setSpecs} />
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره محصول"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">محصولات موجود ({products.length})</h2>
        <div className="space-y-2">
          {categoryTree.map((root) => renderCategoryGroup(root, 0))}
          {uncategorizedProducts.length > 0 && (
            <details open className="border cut-line rounded-lg overflow-hidden">
              <summary className="cursor-pointer select-none px-3 py-2 font-bold bg-[var(--color-linen-dim)] text-sm">
                بدون دسته‌بندی ({uncategorizedProducts.length})
              </summary>
              <div className="p-2 space-y-2">{uncategorizedProducts.map((p) => renderProduct(p))}</div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
