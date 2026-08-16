"use client";

import { useEffect, useState } from "react";

type AttributeValue = { id: string; value: string };
type Attribute = {
  id: string;
  name: string;
  values: AttributeValue[];
  groupId?: string | null;
  groupName?: string | null;
};

export type VariantRow = {
  comboKey: string;
  stock: number;
  priceDiff: number;
  values: { attributeId: string; attribute: string; value: string }[];
  existingVariantId?: string; // اگه این ترکیب دقیقاً منطبق با یه variant موجوده، همون رو نگه می‌داریم
};

// ترکیب‌هایی که از قبل روی محصول ذخیره شدن (برای پیش‌پرکردن موجودی/قیمت به‌جای صفر)
export type ExistingCombo = {
  id: string;
  stock: number;
  priceDiff: number;
  values: { attribute: string; value: string }[];
};

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]]
  );
}

function sameCombo(
  a: { attribute: string; value: string }[],
  b: { attribute: string; value: string }[]
) {
  if (a.length !== b.length) return false;
  return a.every((x) => b.some((y) => y.attribute === x.attribute && y.value === x.value));
}

export function VariantBuilder({
  attributes,
  existingCombos = [],
  onChange,
}: {
  attributes: Attribute[];
  existingCombos?: ExistingCombo[];
  onChange: (rows: VariantRow[]) => void;
}) {
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);

  // اگه دسته‌بندی عوض شد و ویژگی‌ها فرق کردن، انتخاب‌های قبلی و ترکیب‌ها رو ریست کن
  useEffect(() => {
    setSelectedAttributeIds([]);
    setRows([]);
    onChange([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes.map((a) => a.id).join(",")]);

  function toggleAttribute(attributeId: string) {
    setSelectedAttributeIds((prev) => {
      if (prev.includes(attributeId)) {
        return prev.filter((id) => id !== attributeId);
      }
      const attr = attributes.find((a) => a.id === attributeId);
      // اگه این ویژگی عضو یه گروهه، بقیه اعضای همون گروه رو از انتخاب خارج کن
      // (چون ترکیب دو نوع "سایز" مختلف با هم معنی نداره -- فقط یکی از گروه انتخاب می‌شه)
      const withoutGroupSiblings = attr?.groupId
        ? prev.filter((id) => attributes.find((a) => a.id === id)?.groupId !== attr.groupId)
        : prev;
      return [...withoutGroupSiblings, attributeId];
    });
  }

  function handleGenerate() {
    const activeAttributes = attributes.filter(
      (a) => selectedAttributeIds.includes(a.id) && a.values.length > 0
    );

    if (activeAttributes.length === 0) {
      alert("حداقل یک ویژگی که مقدار داشته باشه رو انتخاب کن.");
      return;
    }

    // برای هر ویژگی انتخاب‌شده، همه‌ی مقادیر از پیش‌تعریف‌شده‌ش استفاده می‌شه (نه انتخاب دستی)
    const valueLists = activeAttributes.map((attr) =>
      attr.values.map((val) => ({ attributeId: attr.id, attribute: attr.name, value: val.value }))
    );

    const combos = cartesian(valueLists);

    // اگه قبلاً برای یه زیرمجموعه از همین ویژگی‌ها موجودی/قیمت وارد کرده بودی (چه تو همین
    // نشست، چه قبلاً روی محصول ذخیره شده)، همون عددها رو برای ترکیب جدید حفظ می‌کنیم
    function findPreviousData(newValues: VariantRow["values"]) {
      const newKey = newValues.map((v) => v.value).join("-");
      const exactInSession = rows.find((r) => r.comboKey === newKey);
      if (exactInSession) return exactInSession;

      const subsetInSession = rows.find((r) =>
        r.values.every((ov) =>
          newValues.some((nv) => nv.attributeId === ov.attributeId && nv.value === ov.value)
        )
      );
      if (subsetInSession) return subsetInSession;

      // زیرمجموعه‌ای از یه ترکیب قبلاً ذخیره‌شده روی محصول (حتی اگه مجموعه ویژگی‌ها عوض شده باشه)
      const subsetInExisting = existingCombos.find((ec) =>
        ec.values.every((ov) =>
          newValues.some((nv) => nv.attribute === ov.attribute && nv.value === ov.value)
        )
      );
      if (subsetInExisting) return { stock: subsetInExisting.stock, priceDiff: subsetInExisting.priceDiff };

      return undefined;
    }

    const newRows: VariantRow[] = combos.map((combo) => {
      // اول چک می‌کنیم آیا این ترکیب دقیقاً یکی از ترکیب‌های از قبل ذخیره‌شده‌ی محصوله --
      // اگه بله، عدد واقعیش از دیتابیس میاد (نه صفر)
      const existing = existingCombos.find((ec) => sameCombo(ec.values, combo));
      if (existing) {
        return {
          comboKey: combo.map((c) => c.value).join("-"),
          stock: existing.stock,
          priceDiff: existing.priceDiff,
          values: combo,
          existingVariantId: existing.id,
        };
      }

      const previous = findPreviousData(combo);
      return {
        comboKey: combo.map((c) => c.value).join("-"),
        stock: previous?.stock ?? 0,
        priceDiff: previous?.priceDiff ?? 0,
        values: combo,
      };
    });

    setRows(newRows);
    onChange(newRows);
  }

  function updateRow(index: number, field: "stock" | "priceDiff", value: number) {
    const updated = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setRows(updated);
    onChange(updated);
  }

  if (attributes.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        برای این دسته‌بندی هیچ ویژگی‌ای وصل نشده. از صفحه «دسته‌بندی‌ها» ویژگی‌های مرتبط
        (مثلا سایز/رنگ) رو به این دسته وصل کن، یا اگه محصول variant نداره این بخش رو نادیده بگیر.
      </p>
    );
  }

  return (
    <div className="space-y-4 border cut-line rounded-lg p-4 bg-white">
      <p className="text-sm font-bold">ویژگی‌ها و ترکیب‌های variant (اختیاری)</p>

      <div>
        <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
          ویژگی‌های این محصول رو انتخاب کن — همه مقادیر هر ویژگی خودکار توی ترکیب‌ها استفاده می‌شه
        </p>
        {(() => {
          const grouped = new Map<string, Attribute[]>();
          const ungrouped: Attribute[] = [];
          for (const attr of attributes) {
            if (attr.groupId && attr.groupName) {
              if (!grouped.has(attr.groupName)) grouped.set(attr.groupName, []);
              grouped.get(attr.groupName)!.push(attr);
            } else {
              ungrouped.push(attr);
            }
          }

          function renderButton(attr: Attribute) {
            return (
              <button
                key={attr.id}
                type="button"
                onClick={() => toggleAttribute(attr.id)}
                disabled={attr.values.length === 0}
                title={attr.values.length === 0 ? "این ویژگی هنوز مقداری نداره" : undefined}
                className={`text-sm px-3 py-1 rounded-full border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedAttributeIds.includes(attr.id)
                    ? "border-[var(--color-wine)] text-[var(--color-wine)] font-medium"
                    : "cut-line bg-white"
                }`}
              >
                {attr.name}
                {attr.values.length > 0 && (
                  <span className="text-[var(--color-muted)]"> ({attr.values.length})</span>
                )}
              </button>
            );
          }

          return (
            <div className="space-y-3">
              {Array.from(grouped.entries()).map(([groupName, attrs]) => (
                <div key={groupName}>
                  <p className="text-[10px] text-[var(--color-ochre)] mb-1">
                    گروه «{groupName}» — فقط یکی قابل انتخابه
                  </p>
                  <div className="flex flex-wrap gap-2">{attrs.map(renderButton)}</div>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div className="flex flex-wrap gap-2">{ungrouped.map(renderButton)}</div>
              )}
            </div>
          );
        })()}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        className="text-sm border cut-line px-4 py-1.5 rounded-full bg-[var(--color-linen-dim)]"
      >
        ساخت ترکیب‌ها
      </button>

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            {rows.length} ترکیب ساخته شد — موجودی و اختلاف قیمت هر ترکیب رو وارد کن
            {existingCombos.length > 0 && " (ترکیب‌هایی که از قبل وجود داشتن، با عدد واقعیشون پر شدن):"}
          </p>
          {rows.map((row, i) => (
            <div key={row.comboKey} className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                {row.comboKey}
                {row.existingVariantId && (
                  <span className="text-[10px] text-[var(--color-ochre)]"> (از قبل موجود)</span>
                )}
              </span>
              <input
                type="number"
                placeholder="موجودی"
                value={row.stock}
                onChange={(e) => updateRow(i, "stock", Number(e.target.value))}
                className="w-24 border cut-line rounded-lg px-2 py-1"
              />
              <input
                type="number"
                placeholder="اختلاف قیمت"
                value={row.priceDiff}
                onChange={(e) => updateRow(i, "priceDiff", Number(e.target.value))}
                className="w-28 border cut-line rounded-lg px-2 py-1"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
