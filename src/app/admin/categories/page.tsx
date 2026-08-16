"use client";

import { useEffect, useState } from "react";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import {
  flattenCategoryTree,
  isDescendantCategory,
  effectiveCategoryAttributeSettings,
} from "@/lib/categoryTree";
import { categoryIcon } from "@/lib/categoryIcon";

type Attribute = { id: string; name: string; values: { id: string; value: string }[] };
type AttributeLink = { attributeId: string; fixedValue: string | null };
type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentId: string | null;
  attributes: { attribute: Attribute; fixedValue: string | null }[];
};

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("");
  const [parentId, setParentId] = useState("");
  const [attributeLinks, setAttributeLinks] = useState<AttributeLink[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // ویرایش
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    icon: "",
    parentId: "",
    attributeLinks: [] as AttributeLink[],
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    fetch("/api/admin/categories")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories);
    fetch("/api/admin/attributes")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAttributes);
  }

  useEffect(load, []);

  function toggleAttributeLink(list: AttributeLink[], attributeId: string): AttributeLink[] {
    return list.some((l) => l.attributeId === attributeId)
      ? list.filter((l) => l.attributeId !== attributeId)
      : [...list, { attributeId, fixedValue: null }];
  }

  function setFixedValueFor(
    list: AttributeLink[],
    attributeId: string,
    fixedValue: string | null
  ): AttributeLink[] {
    return list.map((l) => (l.attributeId === attributeId ? { ...l, fixedValue } : l));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        icon: icon || undefined,
        parentId: parentId || undefined,
        attributeLinks,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره دسته‌بندی");
      return;
    }

    setName("");
    setSlug("");
    setIcon("");
    setParentId("");
    setAttributeLinks([]);
    setSlugTouched(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف این دسته‌بندی قطعی است؟")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "خطا در حذف");
      return;
    }
    load();
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      slug: c.slug,
      icon: c.icon ?? "",
      parentId: c.parentId ?? "",
      attributeLinks: c.attributes.map((ca) => ({
        attributeId: ca.attribute.id,
        fixedValue: ca.fixedValue,
      })),
    });
    setEditError("");
  }

  async function handleSaveEdit(id: string) {
    setEditError("");
    setEditSaving(true);
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        slug: editForm.slug,
        icon: editForm.icon || null,
        parentId: editForm.parentId || null,
        attributeLinks: editForm.attributeLinks,
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

  const treeOrder = flattenCategoryTree(categories);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">افزودن دسته‌بندی جدید</h1>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <input
            placeholder="نام دسته‌بندی (مثلا پیراهن مردانه)"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
          />
          <input
            placeholder="اسلاگ (انگلیسی، یکتا)"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="border cut-line rounded-lg px-3 py-2 bg-white"
            dir="ltr"
          />
          <div className="sm:col-span-2">
            <CategoryCombobox
              categories={categories}
              value={parentId}
              onChange={(id) => {
                setParentId(id);
                // ویژگی‌های ثابت والد خودکار ارث می‌رسن (نیازی به ذخیره‌ی دوباره‌شون روی این دسته نیست)
                // پس با تغییر والد، فقط لیست انتخاب‌های این دسته رو ریست می‌کنیم
                setAttributeLinks([]);
              }}
              rootLabel="بدون دسته والد (دسته اصلی)"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs font-medium mb-1.5">
              آیکون <span className="text-[var(--color-muted)]">(آدرس فایل — مثلاً /icons/categories/zanane.svg یا یه لینک کامل)</span>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="/icons/categories/zanane.svg"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                dir="ltr"
                className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-xs bg-white"
              />
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="پیش‌نمایش آیکون" className="w-9 h-9 rounded-full object-cover border cut-line" />
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            {(() => {
              const inheritedSettings = parentId
                ? effectiveCategoryAttributeSettings(categories, parentId)
                : [];
              const inheritedFixed = inheritedSettings.filter((a) => a.fixedValue);
              const selectableAttributes = parentId
                ? inheritedSettings
                    .filter((a) => !a.fixedValue)
                    .map((a) => ({ id: a.attributeId, name: a.attributeName }))
                : attributes;

              return (
                <>
                  {inheritedFixed.length > 0 && (
                    <div className="mb-3 bg-[var(--color-linen-dim)] rounded-lg p-3">
                      <p className="text-xs font-medium mb-1.5">
                        ویژگی‌های ثابت ارث‌بری‌شده از والد (غیرقابل تغییر در این دسته):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {inheritedFixed.map((a) => (
                          <span
                            key={a.attributeId}
                            className="text-xs px-3 py-1 rounded-full bg-white border cut-line text-[var(--color-muted)]"
                          >
                            {a.attributeName}: <strong className="text-[var(--color-ink)]">{a.fixedValue}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-sm font-medium mb-2">
                    {parentId ? "بقیه‌ی ویژگی‌های این دسته (از والد در دسترسه، هنوز مقدار ثابت نگرفته)" : "ویژگی‌های مرتبط (برای ساخت variant محصولات این دسته)"}
                  </p>
                  {parentId && selectableAttributes.length === 0 && inheritedFixed.length === 0 && (
                    <p className="text-xs text-[var(--color-ochre)]">
                      دسته والد انتخاب‌شده هیچ ویژگی‌ای نداره — اول باید به والد (یا والدهای بالاترش) ویژگی وصل کنی.
                    </p>
                  )}
                  {!parentId && selectableAttributes.length === 0 && (
                    <p className="text-xs text-[var(--color-muted)]">
                      هنوز ویژگی‌ای نساختی — اول از صفحه «ویژگی‌ها» یکی بساز.
                    </p>
                  )}
                  {selectableAttributes.length > 0 && (
                    <div className="space-y-2">
                      {selectableAttributes.map((a) => {
                        const link = attributeLinks.find((l) => l.attributeId === a.id);
                        const predefinedValues =
                          attributes.find((attr) => attr.id === a.id)?.values ?? [];
                        return (
                          <div key={a.id} className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                setAttributeLinks((prev) => toggleAttributeLink(prev, a.id))
                              }
                              className={`text-sm px-3 py-1 rounded-full border cut-line ${
                                link
                                  ? "bg-[var(--color-wine)] text-white border-[var(--color-wine)]"
                                  : "bg-white"
                              }`}
                            >
                              {a.name}
                            </button>
                            {link && predefinedValues.length > 0 && (
                              <select
                                value={link.fixedValue ?? ""}
                                onChange={(e) =>
                                  setAttributeLinks((prev) =>
                                    setFixedValueFor(prev, a.id, e.target.value || null)
                                  )
                                }
                                className="border cut-line rounded-lg px-2 py-1 text-xs bg-white"
                              >
                                <option value="">متغیر (روی خود محصول انتخاب می‌شه)</option>
                                {predefinedValues.map((v) => (
                                  <option key={v.id} value={v.value}>
                                    مقدار ثابت: {v.value}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره دسته‌بندی"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">دسته‌بندی‌های موجود ({categories.length})</h2>
        <div className="space-y-2">
          {treeOrder.map((c) =>
            editingId === c.id ? (
              <form
                key={c.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit(c.id);
                }}
                style={{ paddingInlineStart: c.depth * 24 }}
                className="border-2 cut-line rounded-lg p-3 bg-white space-y-3"
              >
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                    placeholder="نام"
                  />
                  <input
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                    dir="ltr"
                    placeholder="اسلاگ"
                  />
                  <div className="sm:col-span-2">
                    <CategoryCombobox
                      categories={categories.filter(
                        (cat) => cat.id !== c.id && !isDescendantCategory(categories, c.id, cat.id)
                      )}
                      value={editForm.parentId}
                      onChange={(id) => {
                        setEditForm((prev) => ({
                          ...prev,
                          parentId: id,
                          attributeLinks: [],
                        }));
                      }}
                      rootLabel="بدون دسته والد (دسته اصلی)"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium mb-1.5">
                      آیکون{" "}
                      <span className="text-[var(--color-muted)]">
                        (آدرس فایل — مثلاً /icons/categories/zanane.svg یا یه لینک کامل)
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="/icons/categories/zanane.svg"
                        value={editForm.icon}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, icon: e.target.value }))}
                        dir="ltr"
                        className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-xs bg-white"
                      />
                      {editForm.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editForm.icon}
                          alt="پیش‌نمایش آیکون"
                          className="w-8 h-8 rounded-full object-cover border cut-line"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {(() => {
                    const inheritedSettings = editForm.parentId
                      ? effectiveCategoryAttributeSettings(categories, editForm.parentId)
                      : [];
                    const inheritedFixed = inheritedSettings.filter((a) => a.fixedValue);
                    const selectableAttributes = editForm.parentId
                      ? inheritedSettings
                          .filter((a) => !a.fixedValue)
                          .map((a) => ({ id: a.attributeId, name: a.attributeName }))
                      : attributes;

                    return (
                      <>
                        {inheritedFixed.length > 0 && (
                          <div className="mb-3 bg-[var(--color-linen-dim)] rounded-lg p-3">
                            <p className="text-xs font-medium mb-1.5">
                              ویژگی‌های ثابت ارث‌بری‌شده از والد (غیرقابل تغییر):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {inheritedFixed.map((a) => (
                                <span
                                  key={a.attributeId}
                                  className="text-xs px-3 py-1 rounded-full bg-white border cut-line text-[var(--color-muted)]"
                                >
                                  {a.attributeName}:{" "}
                                  <strong className="text-[var(--color-ink)]">{a.fixedValue}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs font-medium mb-2">
                          {editForm.parentId ? "بقیه‌ی ویژگی‌های این دسته" : "ویژگی‌های مرتبط"}
                        </p>
                        {selectableAttributes.length === 0 && inheritedFixed.length === 0 && (
                          <p className="text-xs text-[var(--color-ochre)]">
                            {editForm.parentId
                              ? "دسته والد انتخاب‌شده هیچ ویژگی‌ای نداره."
                              : "هنوز ویژگی‌ای نساختی."}
                          </p>
                        )}
                        {selectableAttributes.length > 0 && (
                          <div className="space-y-2">
                            {selectableAttributes.map((a) => {
                              const link = editForm.attributeLinks.find(
                                (l) => l.attributeId === a.id
                              );
                              const predefinedValues =
                                attributes.find((attr) => attr.id === a.id)?.values ?? [];
                              return (
                                <div key={a.id} className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        attributeLinks: toggleAttributeLink(prev.attributeLinks, a.id),
                                      }))
                                    }
                                    className={`text-xs px-3 py-1 rounded-full border cut-line ${
                                      link
                                        ? "bg-[var(--color-wine)] text-white border-[var(--color-wine)]"
                                        : "bg-white"
                                    }`}
                                  >
                                    {a.name}
                                  </button>
                                  {link && predefinedValues.length > 0 && (
                                    <select
                                      value={link.fixedValue ?? ""}
                                      onChange={(e) =>
                                        setEditForm((prev) => ({
                                          ...prev,
                                          attributeLinks: setFixedValueFor(
                                            prev.attributeLinks,
                                            a.id,
                                            e.target.value || null
                                          ),
                                        }))
                                      }
                                      className="border cut-line rounded-lg px-2 py-1 text-xs bg-white"
                                    >
                                      <option value="">متغیر (روی خود محصول انتخاب می‌شه)</option>
                                      {predefinedValues.map((v) => (
                                        <option key={v.id} value={v.value}>
                                          مقدار ثابت: {v.value}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                style={{ paddingInlineStart: c.depth * 24 }}
                className="flex items-center justify-between border cut-line rounded-lg p-3 bg-white text-sm"
              >
                <div className="flex items-center gap-2">
                  {c.depth > 0 && <span className="text-[var(--color-muted)]">└─</span>}
                  {(() => {
                    const guessed = categoryIcon(c.name);
                    const isImagePath = !!c.icon && (c.icon.startsWith("/") || c.icon.startsWith("http"));
                    const icon = c.icon || guessed.icon;
                    return isImagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.icon!}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border cut-line shrink-0"
                      />
                    ) : (
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: guessed.color }}
                      >
                        {icon}
                      </span>
                    );
                  })()}
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[var(--color-muted)] text-xs" dir="ltr">
                      {c.slug}
                    </p>
                    {c.attributes.length > 0 && (
                      <p className="text-[var(--color-muted)] text-xs mt-0.5">
                        ویژگی‌های مستقیم:{" "}
                        {c.attributes
                          .map((ca) =>
                            ca.fixedValue ? `${ca.attribute.name} (ثابت: ${ca.fixedValue})` : ca.attribute.name
                          )
                          .join("، ")}
                      </p>
                    )}
                    {c.parentId &&
                      (() => {
                        const inherited = effectiveCategoryAttributeSettings(categories, c.id).filter(
                          (a) => !c.attributes.some((ca) => ca.attribute.id === a.attributeId)
                        );
                        return inherited.length > 0 ? (
                          <p className="text-[var(--color-muted)] text-xs mt-0.5">
                            ارث‌بری از والد:{" "}
                            {inherited
                              .map((a) =>
                                a.fixedValue
                                  ? `${a.attributeName} (ثابت: ${a.fixedValue})`
                                  : a.attributeName
                              )
                              .join("، ")}
                          </p>
                        ) : null;
                      })()}
                  </div>
                </div>
                <div className="flex gap-3">
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
