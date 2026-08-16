"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useColorSync } from "@/components/ColorSyncProvider";
import { WishlistButton } from "@/components/WishlistButton";
import { SizeGuideButton } from "@/components/SizeGuideButton";
import { AdminAddToOrderButton } from "@/components/AdminAddToOrderButton";

type VariantOption = {
  id: string;
  stock: number;
  priceDiff: number;
  values: { attribute: string; value: string }[];
};

type SelectedSlot = { attribute: string; value: string };

// نگاشت اسم‌های رایج رنگ فارسی به کد رنگ واقعی -- برای نمایش دایره‌ی رنگی به‌جای متن
const COLOR_MAP: Record<string, string> = {
  قرمز: "#DC2626",
  آبی: "#1E3A8A",
  "آبی روشن": "#3B82F6",
  "آبی تیره": "#1E3A8A",
  سرمه‌ای: "#1E293B",
  زرد: "#EAB308",
  سبز: "#16A34A",
  "سبز روشن": "#22C55E",
  "سبز تیره": "#14532D",
  مشکی: "#111111",
  سیاه: "#111111",
  سفید: "#FFFFFF",
  خاکستری: "#6B7280",
  طوسی: "#6B7280",
  بنفش: "#9333EA",
  یاسی: "#C4B5FD",
  صورتی: "#EC4899",
  قهوه‌ای: "#78350F",
  نارنجی: "#F97316",
  کرم: "#F5E6D3",
  بژ: "#E8DCC8",
  طلایی: "#CA8A04",
  نقره‌ای: "#C0C0C0",
};

function colorForValue(value: string): string | null {
  return COLOR_MAP[value.trim()] ?? null;
}

export function AddToCartForm({
  productId,
  slugOrId,
  source,
  title,
  image,
  basePrice,
  originalPrice,
  discount = 0,
  variants,
  flashSaleId,
  attributeGroupMap = {},
  colorImages = {},
  isWishlisted = false,
  fastShipping = false,
  sizeGuideImage = null,
  initialAttrs,
}: {
  productId: string;
  slugOrId: string;
  source: "MAZON" | "TRENDYOL";
  title: string;
  image: string;
  basePrice: number; // قیمت نهایی محصول بعد از تخفیف عادی/فلش (بدون احتساب اختلاف قیمت وارینت)
  originalPrice?: number; // قیمت پایه قبل از تخفیف -- برای خط‌خورده نشون دادن
  discount?: number; // درصد تخفیف -- فقط برای تصمیم به نمایش خط‌خورده
  variants?: VariantOption[];
  flashSaleId?: string;
  // نام ویژگی -> نام گروهش. اگه یه ویژگی تو این نقشه نباشه، خودش به‌تنهایی یه گروه مستقله
  attributeGroupMap?: Record<string, string>;
  // مقدار رنگ -> عکس‌های اختصاصی همون رنگ -- اگه موجود باشه، به‌جای دایره‌ی رنگی، خود عکس محصول نشون داده می‌شه
  colorImages?: Record<string, string[]>;
  isWishlisted?: boolean;
  fastShipping?: boolean; // نشون‌دادن بج «ارسال فوری» گوشه‌ی دکمه‌ی افزودن به سبد
  sizeGuideImage?: string | null; // عکس راهنمای سایز مخصوص دسته‌بندی+برند این محصول -- اگه null باشه دکمه نشون داده نمی‌شه
  // ویژگی‌هایی که از فیلترهای صفحه‌ی لیست یا کلیک روی رنگ کارت محصول از قبل مشخص شدن
  // (attribute -> value) -- اگه موجود و معتبر باشن از قبل انتخاب می‌شن
  initialAttrs?: Record<string, string>;
}) {
  const { addItem, items } = useCart();
  const { setSelectedColor } = useColorSync();
  const router = useRouter();
  // کلید هر اسلات، گروه واقعی ویژگیه (یا خود نام ویژگی اگه عضو هیچ گروهی نباشه)
  // یعنی از هر گروه، فقط یک اسلات انتخاب لازمه -- نه یکی برای هر ویژگی
  const [selected, setSelected] = useState<Record<string, SelectedSlot>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [notifiedDescriptions, setNotifiedDescriptions] = useState<Set<string>>(new Set());

  // با لود شدن صفحه، وضعیت واقعی «خبرم کن»های ثبت‌شده‌ی همین کاربر رو از سرور می‌خونیم
  // تا بعد از رفرش هم زنگوله‌های قبلاً زده‌شده رنگی بمونن
  useEffect(() => {
    fetch(`/api/stock-notifications?productId=${productId}`)
      .then((res) => (res.ok ? res.json() : { descriptions: [] }))
      .then((data) => setNotifiedDescriptions(new Set(data.descriptions ?? [])))
      .catch(() => {});
  }, [productId]);

  async function handleNotifyMe(description: string) {
    if (notifiedDescriptions.has(description)) return;
    setNotifiedDescriptions((prev) => new Set(prev).add(description));
    const res = await fetch("/api/stock-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, description }),
    });
    if (!res.ok && res.status === 401) {
      router.push("/auth/login");
    }
  }

  function groupKeyOf(attribute: string) {
    return attributeGroupMap[attribute] ?? attribute;
  }

  const attributeGroups = useMemo(() => {
    if (!variants || variants.length === 0) return [];
    const map = new Map<string, Set<string>>();
    for (const v of variants) {
      for (const val of v.values) {
        if (!map.has(val.attribute)) map.set(val.attribute, new Set());
        map.get(val.attribute)!.add(val.value);
      }
    }
    return Array.from(map.entries()).map(([attribute, values]) => ({
      attribute,
      values: Array.from(values),
      groupKey: groupKeyOf(attribute),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  // خوشه‌بندی ویژگی‌ها بر اساس گروه واقعی‌شون -- اگه چند ویژگی هم‌گروه باشن
  // (مثلا سایز کفش و سایز لباس)، فقط یک انتخاب از بینشون لازمه
  const clusters = useMemo(() => {
    const map = new Map<string, typeof attributeGroups>();
    for (const g of attributeGroups) {
      if (!map.has(g.groupKey)) map.set(g.groupKey, []);
      map.get(g.groupKey)!.push(g);
    }
    return Array.from(map.entries());
  }, [attributeGroups]);

  // گروه‌هایی که فقط یک مقدار ممکن دارن (مثلا «جنسیت: زنانه» وقتی محصول فقط زنانه‌ست)
  // -- این‌ها نیازی به انتخاب کاربر ندارن و نباید هم قابل برداشتن باشن
  const singleValueGroups = useMemo(() => {
    const map = new Map<string, SelectedSlot>();
    for (const [groupKey, members] of clusters) {
      const distinctValues = new Set(members.flatMap((m) => m.values));
      if (distinctValues.size === 1) {
        map.set(groupKey, { attribute: members[0].attribute, value: members[0].values[0] });
      }
    }
    return map;
  }, [clusters]);

  // گروه‌های تک‌مقداری از همون اول خودکار انتخاب‌شده باشن -- کاربر لازم نیست
  // روشون کلیک کنه، و اصلاً همچین انتخابی رو نمی‌بینه که بخواد بردارتش
  useEffect(() => {
    if (singleValueGroups.size === 0) return;
    setSelected((s) => {
      let changed = false;
      const next = { ...s };
      for (const [groupKey, slot] of singleValueGroups) {
        if (!next[groupKey]) {
          next[groupKey] = slot;
          changed = true;
        }
      }
      return changed ? next : s;
    });
  }, [singleValueGroups]);

  const requiredGroupKeys = useMemo(
    () => new Set(attributeGroups.map((g) => g.groupKey)),
    [attributeGroups]
  );

  // گروهی که ویژگی رنگ توشه -- برای sync کردن انتخاب رنگ با گالری عکس
  const colorGroupKey = useMemo(
    () => attributeGroups.find((g) => g.attribute.includes("رنگ"))?.groupKey,
    [attributeGroups]
  );

  // اگه از فیلترهای صفحه‌ی لیست یا کلیک روی رنگ کارت محصول، بعضی ویژگی‌ها از قبل
  // مشخص شده باشن (?attrs=رنگ~قرمز,سایز~M)، همون‌ها با اولویت از قبل انتخاب می‌شن
  const appliedInitialAttrs = useRef(false);
  useEffect(() => {
    if (appliedInitialAttrs.current) return;
    if (!initialAttrs || Object.keys(initialAttrs).length === 0 || attributeGroups.length === 0) return;
    appliedInitialAttrs.current = true;
    setSelected((s) => {
      const next = { ...s };
      for (const group of attributeGroups) {
        if (next[group.groupKey]) continue;
        // اسم ویژگی رنگ ممکنه دقیقاً «رنگ» نباشه (مثلا «رنگ بدنه») -- علاوه بر تطبیق
        // دقیق اسم، اگه خود گروه رنگیه و توکن «رنگ» موجود بود همونم قبول می‌شه
        const wanted =
          initialAttrs[group.attribute] ??
          (group.attribute.includes("رنگ") ? initialAttrs["رنگ"] : undefined);
        if (wanted && group.values.includes(wanted)) {
          next[group.groupKey] = { attribute: group.attribute, value: wanted };
        }
      }
      return next;
    });
  }, [initialAttrs, attributeGroups]);

  // برای هر گروهی که هنوز انتخابی نداره (نه فیلتر از لیست مشخصش کرده، نه تک‌مقداری‌ست)،
  // ارزون‌ترین ترکیبِ موجودِ سازگار با انتخاب‌های از‌قبل‌ثابت‌شده رو خودکار انتخاب کن --
  // چون هر واحد variant دقیقاً یه priceDiff داره، کافیه بین variant های موجودِ سازگار،
  // کمترین priceDiff رو پیدا کرد و مقادیرش رو برای گروه‌های خالی اعمال کرد
  const appliedCheapest = useRef(false);
  useEffect(() => {
    if (appliedCheapest.current) return;
    if (!variants || variants.length === 0 || attributeGroups.length === 0) return;
    appliedCheapest.current = true;
    setSelected((s) => {
      const fixed = Object.entries(s);
      const candidates = variants.filter(
        (v) =>
          v.stock > 0 &&
          fixed.every(([groupKey, slot]) =>
            v.values.some(
              (val) =>
                val.attribute === slot.attribute &&
                val.value === slot.value &&
                groupKeyOf(val.attribute) === groupKey
            )
          )
      );
      if (candidates.length === 0) return s;
      const cheapest = candidates.reduce((min, v) => (v.priceDiff < min.priceDiff ? v : min));
      const next = { ...s };
      for (const val of cheapest.values) {
        const groupKey = groupKeyOf(val.attribute);
        if (!next[groupKey]) next[groupKey] = { attribute: val.attribute, value: val.value };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, attributeGroups]);

  // با هر تغییر در رنگ انتخاب‌شده، گالری عکس رو هم (اگه عکس اختصاصی اون رنگ تعریف شده باشه) sync کن
  useEffect(() => {
    if (!colorGroupKey) return;
    setSelectedColor(selected[colorGroupKey]?.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorGroupKey, colorGroupKey ? selected[colorGroupKey]?.value : undefined]);

  const matchedVariant = useMemo(() => {
    if (!variants || variants.length === 0) return null;
    if (requiredGroupKeys.size !== Object.keys(selected).length) return null;
    const slots = Object.values(selected);
    return (
      variants.find((v) =>
        slots.every((slot) =>
          v.values.some((val) => val.attribute === slot.attribute && val.value === slot.value)
        )
      ) ?? null
    );
  }, [variants, selected, requiredGroupKeys]);

  // آیا این مقدار برای این ویژگی، با در نظر گرفتن بقیه انتخاب‌های فعلی (از گروه‌های دیگه)،
  // حداقل یک ترکیب موجود (با موجودی بیشتر از صفر) داره؟
  function isValueAvailable(attribute: string, value: string): boolean {
    if (!variants) return false;
    const myGroupKey = groupKeyOf(attribute);
    return variants.some((v) => {
      if (v.stock <= 0) return false;
      const matchesThisValue = v.values.some(
        (val) => val.attribute === attribute && val.value === value
      );
      if (!matchesThisValue) return false;
      return Object.entries(selected).every(([groupKey, slot]) => {
        if (groupKey === myGroupKey) return true;
        return v.values.some((vv) => vv.attribute === slot.attribute && vv.value === slot.value);
      });
    });
  }

  const needsVariant = attributeGroups.length > 0;
  const cartId = `${productId}${matchedVariant ? "-" + matchedVariant.id : ""}`;
  const alreadyInCart = items.find((i) => i.id === cartId)?.quantity ?? 0;
  const remainingStock = matchedVariant ? Math.max(0, matchedVariant.stock - alreadyInCart) : null;
  const atStockLimit = !!matchedVariant && matchedVariant.stock > 0 && remainingStock === 0;
  const canAdd =
    !needsVariant || (matchedVariant && matchedVariant.stock > 0 && !atStockLimit && quantity > 0);
  const finalPrice = basePrice + (matchedVariant?.priceDiff ?? 0);

  // با عوض شدن ترکیب انتخابی، تعداد رو به ۱ برمی‌گردونیم و اگه از موجودی جدید بیشتره کم می‌کنیم
  useEffect(() => {
    setQuantity((q) => (remainingStock !== null ? Math.min(Math.max(q, 1), remainingStock || 1) : q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedVariant?.id]);

  function buildCartItem() {
    const variantLabel = Object.values(selected)
      .map((s) => `${s.attribute}: ${s.value}`)
      .join(" / ");

    return {
      id: cartId,
      source,
      productId: slugOrId,
      variantId: matchedVariant?.id,
      flashSaleId,
      title,
      image,
      price: finalPrice,
      originalPrice:
        discount > 0 && originalPrice !== undefined
          ? originalPrice + (matchedVariant?.priceDiff ?? 0)
          : undefined,
      quantity,
      variantLabel: variantLabel || undefined,
      maxStock: matchedVariant?.stock,
      fastShipping,
    };
  }

  function handleAdd() {
    if (!canAdd) return;
    addItem(buildCartItem());
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (!canAdd) return;
    addItem(buildCartItem());
    router.push("/checkout");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-[var(--color-wine)]">
          {finalPrice.toLocaleString("fa-IR")} تومان
        </span>
        {discount > 0 && originalPrice !== undefined && (
          <span className="text-sm text-[var(--color-muted)] line-through">
            {(originalPrice + (matchedVariant?.priceDiff ?? 0)).toLocaleString("fa-IR")}
          </span>
        )}
        {matchedVariant && matchedVariant.priceDiff !== 0 && (
          <span className="text-xs text-[var(--color-ochre)] font-medium">
            ({matchedVariant.priceDiff > 0 ? "+" : ""}
            {matchedVariant.priceDiff.toLocaleString("fa-IR")} برای این ترکیب)
          </span>
        )}
      </div>
      {clusters.map(([groupKey, members]) => {
        // گروه‌های تک‌مقداری (مثلا جنسیتی که فقط یه مقدار داره) از قبل توی state
        // انتخاب شدن (برای این‌که matchedVariant درست کار کنه)، ولی چون کاربر هیچ
        // انتخابی نداره که انجام بده، اصلاً نیازی به نمایش این بخش نیست
        if (singleValueGroups.has(groupKey)) return null;

        const isGroup = members.length > 1;
        const isColorGroup = groupKey.includes("رنگ") || members.some((m) => m.attribute.includes("رنگ"));
        const isSizeGroup = groupKey.includes("سایز") || members.some((m) => m.attribute.includes("سایز"));
        const currentSelection = selected[groupKey]?.value;

        return (
          <div key={groupKey}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {groupKey}
                {currentSelection && (
                  <span className="text-[var(--color-wine)]">: {currentSelection}</span>
                )}
                {isColorGroup && (
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-muted)] text-[var(--color-muted)] text-[9px]"
                    title="رنگ واقعی محصول ممکنه بسته به تنظیمات نمایشگر کمی متفاوت باشه"
                  >
                    i
                  </span>
                )}
              </p>
              {isSizeGroup && sizeGuideImage && <SizeGuideButton imageUrl={sizeGuideImage} />}
            </div>
            <div className="flex flex-wrap gap-2">
              {(isGroup
                ? members.flatMap((group) => group.values.map((val) => ({ group, val })))
                : members[0].values.map((val) => ({ group: members[0], val }))
              ).map(({ group, val }) => {
                const isSelected =
                  selected[groupKey]?.attribute === group.attribute &&
                  selected[groupKey]?.value === val;
                const available = isSelected || isValueAvailable(group.attribute, val);
                const swatchColor = isColorGroup ? colorForValue(val) : null;
                const colorThumb = isColorGroup ? colorImages[val]?.[0] ?? image : null;

                function handleClick() {
                  setSelected((s) => {
                    // گروه‌های تک‌مقداری (مثلا جنسیتی که فقط یه مقدار داره) هیچ‌وقت
                    // قابل برداشتن نیستن -- کلیک روشون کاری نمی‌کنه
                    if (singleValueGroups.has(groupKey)) return s;
                    // با کلیک دوباره روی مقدار انتخاب‌شده، انتخابش برداشته می‌شه
                    if (s[groupKey]?.attribute === group.attribute && s[groupKey]?.value === val) {
                      const next = { ...s };
                      delete next[groupKey];
                      return next;
                    }
                    // انتخاب یه مقدار از این ویژگی، انتخاب قبلی همین گروه رو
                    // (حتی اگه از یه ویژگی هم‌گروه دیگه بوده) جایگزین می‌کنه
                    return { ...s, [groupKey]: { attribute: group.attribute, value: val } };
                  });
                }

                // توضیح درخواست موجودی باید همه‌ی ویژگی‌های انتخابی رو ترکیب کنه (مثلا «سایز: 36 / رنگ:
                // سبز»)، نه فقط همین یه ویژگی -- وگرنه وقتی کاربر رنگ رو از قبل انتخاب کرده و روی
                // زنگوله‌ی یه سایز ناموجود می‌زنه، رنگ انتخابیش گم می‌شه
                const combinedSelections = {
                  ...selected,
                  [groupKey]: { attribute: group.attribute, value: val },
                };
                const description = Object.values(combinedSelections)
                  .map((s) => `${s.attribute}: ${s.value}`)
                  .join(" / ");
                const notified = notifiedDescriptions.has(description);

                const notifyBell = (
                  <button
                    type="button"
                    title="موجود شد خبرم کن"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNotifyMe(description);
                    }}
                    className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow border ${
                      notified
                        ? "bg-[var(--color-wine)] border-[var(--color-wine)] text-white"
                        : "bg-white border-[var(--color-line)] text-[var(--color-muted)]"
                    }`}
                  >
                    🔔
                  </button>
                );

                // اگه محصول عکس داره (اختصاصی رنگ یا حتی عکس اصلی به‌عنوان جایگزین)، به‌جای دایره‌ی
                // رنگی ساده، خود عکس محصول رو به‌عنوان کارت قابل‌انتخاب نشون می‌دیم (مثل آمازون)
                if (isColorGroup && colorThumb) {
                  return (
                    <div key={`${group.attribute}-${val}`} className="relative">
                      <button
                        type="button"
                        title={val}
                        disabled={!available}
                        onClick={handleClick}
                        className={`relative w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-transform swatch-chip disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-[var(--color-wine)]"
                            : available
                            ? "border-[var(--color-line)]"
                            : "opacity-40 cursor-not-allowed"
                        }`}
                      >
                        <div className="relative w-full aspect-[3/4] bg-[var(--color-linen-dim)]">
                          <Image src={colorThumb} alt={val} fill className="object-cover" unoptimized />
                        </div>
                        <span className="block text-[10px] text-center py-1 bg-white truncate px-1">
                          {val}
                        </span>
                        {!available && <span className="absolute inset-0 bg-white/60" />}
                      </button>
                      {!available && notifyBell}
                    </div>
                  );
                }

                if (swatchColor) {
                  return (
                    <div key={`${group.attribute}-${val}`} className="relative">
                      <button
                        type="button"
                        title={val}
                        disabled={!available}
                        onClick={handleClick}
                        className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition-transform swatch-chip disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-[var(--color-wine)]"
                            : available
                            ? "border-[var(--color-line)]"
                            : "opacity-30 cursor-not-allowed"
                        }`}
                        style={{ backgroundColor: swatchColor }}
                      >
                        {isSelected && (
                          <svg
                            viewBox="0 0 20 20"
                            className="w-4 h-4"
                            fill={swatchColor === "#FFFFFF" ? "#111111" : "#FFFFFF"}
                          >
                            <path d="M7.6 13.2 4.4 10l-1.2 1.2 4.4 4.4L17 6.2 15.8 5z" />
                          </svg>
                        )}
                        {!available && <span className="absolute inset-0 rounded-full bg-white/60" />}
                      </button>
                      {!available && notifyBell}
                    </div>
                  );
                }

                return (
                  <div key={`${group.attribute}-${val}`} className="relative">
                    <button
                      type="button"
                      disabled={!available}
                      onClick={handleClick}
                      className={`swatch-chip border cut-line rounded-lg px-4 py-1.5 text-sm flex items-center gap-1.5 ${
                        isSelected
                          ? "border-[var(--color-wine)] text-[var(--color-wine)] font-medium"
                          : available
                          ? "bg-white"
                          : "bg-[var(--color-linen-dim)] text-[var(--color-muted)] line-through cursor-not-allowed opacity-60"
                      }`}
                    >
                      {val}
                      {isSelected && (
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-[var(--color-wine)]">
                          <path d="M7.6 13.2 4.4 10l-1.2 1.2 4.4 4.4L17 6.2 15.8 5z" />
                        </svg>
                      )}
                    </button>
                    {!available && notifyBell}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {(!needsVariant || matchedVariant) && !atStockLimit && (matchedVariant?.stock ?? 1) > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">تعداد</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 border cut-line rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="کاهش تعداد"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium">{quantity}</span>
            <button
              type="button"
              onClick={() =>
                setQuantity((q) => (remainingStock !== null ? Math.min(q + 1, remainingStock) : q + 1))
              }
              disabled={remainingStock !== null && quantity >= remainingStock}
              className="w-8 h-8 border cut-line rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="افزایش تعداد"
            >
              +
            </button>
            {remainingStock !== null && (
              <span className="text-xs text-[var(--color-muted)]">
                ({remainingStock} عدد موجود)
              </span>
            )}
          </div>
        </div>
      )}

      {needsVariant && matchedVariant && matchedVariant.stock === 0 && (
        <p className="text-sm text-red-600">این ترکیب موجود نیست.</p>
      )}
      {atStockLimit && (
        <p className="text-sm text-[var(--color-ochre)]">
          به سقف موجودی این ترکیب رسیدی ({matchedVariant?.stock} عدد در سبد خرید داری).
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!canAdd}
          className="flex-1 border-2 border-[var(--color-wine)] text-[var(--color-wine)] py-3 rounded-full font-medium disabled:opacity-40 hover:bg-[var(--color-linen-dim)] transition-colors"
        >
          همین الان بخر
        </button>
        <div className="relative flex-1">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full bg-[var(--color-wine)] text-white py-3 rounded-full font-medium disabled:opacity-40 hover:bg-[var(--color-wine-dark)] transition-colors"
          >
            {added ? "به سبد اضافه شد ✓" : "افزودن به سبد خرید"}
          </button>
          {fastShipping && (
            <span className="absolute -top-3.5 -right-2 z-10 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg ring-2 ring-white whitespace-nowrap">
              🚚 ارسال فوری
            </span>
          )}
        </div>
        {source === "MAZON" && (
          <WishlistButton productId={productId} initialWishlisted={isWishlisted} variant="icon" />
        )}
      </div>

      <AdminAddToOrderButton
        source={source}
        productId={source === "MAZON" ? productId : undefined}
        externalId={source === "TRENDYOL" ? slugOrId : undefined}
        variantId={matchedVariant?.id}
        title={title}
        image={image}
        price={finalPrice}
        quantity={quantity}
        disabled={!canAdd}
      />
    </div>
  );
}
