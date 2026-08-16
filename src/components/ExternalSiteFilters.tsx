"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useTransition } from "react";
import { FilterSection, FilterCheckbox } from "@/components/ProductFilters";
import { TRENDYOL_TOP_SECTIONS, isGenderTurkishSection, turkishSectionForFa } from "@/lib/trendyolTopSections";

// باید دقیقاً با TRENDYOL_RAW_CATEGORY_SENTINEL/COLOR/BRAND توی src/lib/externalSites.ts
// یکی باشن -- اینجا کپی شدن چون externalSites.ts سمت سرور prisma رو ایمپورت
// می‌کنه و نمی‌شه توی کامپوننت کلاینتی وارد کرد
const TRENDYOL_RAW_CATEGORY_ATTR = "__trendyolCategory";
const TRENDYOL_RAW_COLOR_ATTR = "__trendyolColor";
const TRENDYOL_RAW_BRAND_ATTR = "__trendyolBrand";
const TRENDYOL_RAW_ATTR_ATTR = "__trendyolAttr";
const TRENDYOL_RAW_VARIANT_ATTR = "__trendyolVariant";
const TRENDYOL_RAW_TAG_ATTR = "__trendyolTag";
const TRENDYOL_RAW_MERCHANT_BADGE_ATTR = "__trendyolMerchantBadge";
const TRENDYOL_RAW_PRICE_ATTR = "__trendyolPrice";
const TRENDYOL_RAW_RATING_ATTR = "__trendyolRating";

// چندتا آیدی می‌تونن با کاما توی یه param واحد بیان (مثلاً "wc=117,114") -- ولی
// خودِ attrs توی URL هم چندتا توکن رو با کاما جدا می‌کنه، پس این کاماهای داخلی
// باید قبل از قرار گرفتن توی توکن با _ جایگزین بشن (جزئیات کامل توی
// src/lib/externalSites.ts کنار encodeTrendyolCategoryParam)
function encodeTrendyolCategoryParam(param: string): string {
  return param.replace(/,/g, "_");
}
function decodeTrendyolCategoryParam(encoded: string): string {
  return encoded.replace(/_/g, ",");
}

export type ExternalAttributeFilter = {
  attributeId: string;
  attributeName: string;
  groupName: string | null;
  values: string[];
};

// لینک محصولات باید دقیقاً همون فرمت ترندیول (اسلاگ) بمونه، ولی برای نمایش
// بهتره فارسی‌تر باشه -- فقط ظاهر عوض می‌شه، مقدار واقعی که ارسال می‌شه دست‌نخورده می‌مونه
function prettyValueLabel(value: string): string {
  if (value.endsWith("-yas")) {
    return `${value.slice(0, -"-yas".length)} سال`;
  }
  return value;
}

// چندتا ویژگی که عضو یه سرگروه‌ان (مثلا «سایز لباس» و «سایز کفش» زیر سرگروه
// «سایز») باید توی یه بخش فیلتر واحد نشون داده بشن -- دقیقاً مثل فیلترهای مزون.
// اگه چندتا ویژگی مقدار مشترک داشته باشن (مثلا سه‌تا "۴۲" از سه ویژگی مختلف)،
// فقط یه چک‌باکس نشونش می‌دیم که مشتری گیج نشه، ولی انتخابش هر سه‌تا
// attributeName~value واقعی رو با هم فعال/غیرفعال می‌کنه (tokens زیرش)
type GroupedFilter = {
  title: string;
  items: { label: string; tokens: string[] }[];
};

function groupAttributeFilters(filters: ExternalAttributeFilter[]): GroupedFilter[] {
  // title -> رشته‌ی خام مقدار -> ست توکن‌های "attributeName~value" که همین مقدار رو تولید می‌کنن
  const byTitle = new Map<string, Map<string, Set<string>>>();
  for (const f of filters) {
    const title = f.groupName ?? f.attributeName;
    if (!byTitle.has(title)) byTitle.set(title, new Map());
    const byValue = byTitle.get(title)!;
    for (const value of f.values) {
      if (!byValue.has(value)) byValue.set(value, new Set());
      byValue.get(value)!.add(`${f.attributeName}~${value}`);
    }
  }

  return Array.from(byTitle.entries()).map(([title, byValue]) => ({
    title,
    items: Array.from(byValue.entries()).map(([value, tokens]) => ({
      label: prettyValueLabel(value),
      tokens: Array.from(tokens),
    })),
  }));
}

// توکن‌های "attributeName~value" رو به شکلی که API انتظار داره برمی‌گردونه
function parseAttrTokens(tokens: string[]): { attributeName: string; value: string }[] {
  return tokens
    .map((t) => {
      const [attributeName, value] = t.split("~");
      return { attributeName, value };
    })
    .filter((a): a is { attributeName: string; value: string } => Boolean(a.attributeName && a.value));
}

// حداقل فاصله‌ی زمانی بین دو درخواست اعتبارسنجی -- حتی اگه خود fetch سریع
// جواب بده، این وقفه رعایت می‌شه تا با کلیک‌های پشت‌سرهم، ترندیول رو با
// درخواست زیاد نزنیم و بلاک نشیم
const MIN_REQUEST_INTERVAL_MS = 900;

export function ExternalSiteFilters({
  siteSlug,
  attributeFilters,
  isAdmin = false,
}: {
  siteSlug: string;
  categories: { id: string; name: string; slug: string }[];
  attributeFilters: ExternalAttributeFilter[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const selectedCategory = searchParams.get("category") ?? "";
  const selectedAttrs = searchParams.get("attrs")?.split(",").filter(Boolean) ?? [];

  const [categoryQuery, setCategoryQuery] = useState("");
  const [attrQueries, setAttrQueries] = useState<Record<string, string>>({});

  // بخش اصلیِ *غیرجنسیتی* (اسم ترکی -- Ev & Yaşam/Süpermarket/...) که کاربر از
  // لیست ۸تایی انتخاب کرده تا زیرشاخه‌هاش رو مرور کنه. این state محلی/گذراست،
  // نه یه query param. Kadın/Erkek این‌جا هیچ‌وقت ست نمی‌شن -- چون جنسیت از قبل
  // یه فیلتر مستقل (چک‌باکس «جنسیت» پایین سایدبار) داره و نباید توی «دسته‌بندی»
  // هم دوباره به‌عنوان یه گزینه‌ی جدا تکرار بشه
  const [selectedTopSection, setSelectedTopSection] = useState<string | null>(null);

  // جنسیتی که همین الان از چک‌باکس مستقل «جنسیت» انتخاب شده (اگه باشه)
  const selectedGenderFa =
    selectedAttrs.map((t) => t.split("~")).find(([name]) => name === "جنسیت")?.[1] ?? null;

  // توکن دسته‌بندی خامِ فعلاً روی URL (اگه باشه) -- برای بازسازی selectedTopSection
  // و categoryStack وقتی کاربر مستقیم از یه لینک بیرونی (مثلاً منوی سه‌خط) اومده
  // و categoryStack محلی‌ش هنوز خالیه
  const activeCategoryTokenParam = selectedAttrs
    .find((t) => t.startsWith(`${TRENDYOL_RAW_CATEGORY_ATTR}~`))
    ?.slice(TRENDYOL_RAW_CATEGORY_ATTR.length + 1);

  // اگه توکن دسته‌بندی خام دقیقاً همون اتحاد rootWc یکی از ۸ بخش غیرجنسیتیه
  // (یعنی کلیک از منوی افقی/سه‌خط مستقیم روی خودِ بخش اصلی، نه یه زیردسته‌ی
  // عمیق‌تر) -- بدون نیاز به رفت‌وبرگشت شبکه (fetch resolveParam پایین‌تر)
  // همین‌جا، همزمان با رندر، تشخیص می‌دیم. قبلاً selectedTopSection فقط از
  // اون fetch (async) ست می‌شد؛ برای همین بعد از کلیک روی مثلاً «سوپرمارکت»،
  // چک‌باکس سایدبار چند صد میلی‌ثانیه (تا جواب فچ) تیک‌نخورده می‌ماند
  const derivedRootSection = activeCategoryTokenParam
    ? TRENDYOL_TOP_SECTIONS.find((s) => s.rootWc === decodeTrendyolCategoryParam(activeCategoryTokenParam))
    : undefined;

  // بخش اصلیِ *مؤثر» برای fetch/درنظرگرفتن سطح فعلی: اول انتخاب صریح کاربر از
  // لیست ۸تایی، بعد اتحاد rootWc تشخیص‌داده‌شده‌ی هم‌زمان بالا، وگرنه (اگه
  // چیزی صریح انتخاب نشده) خودکار از روی چک‌باکس جنسیت مستقل مشتق می‌شه --
  // این‌طوری کاربر با تیک‌زدن «مردانه» توی همون بخش جنسیت، بدون نیاز به یه
  // گزینه‌ی تکراری، مستقیم وارد زیردرخت Erkek می‌شه
  const effectiveTopSection =
    selectedTopSection ??
    derivedRootSection?.turkish ??
    (selectedGenderFa ? turkishSectionForFa(selectedGenderFa) : null);

  // چیپ «دسته‌بندی» بالای لیست فقط برای بخش‌های غیرجنسیتیه (جنسیت چک‌باکس
  // جدا داره) -- هم انتخاب صریح، هم تشخیص هم‌زمان از roots، هرکدوم بود
  const topSectionChipValue = selectedTopSection ?? derivedRootSection?.turkish ?? null;

  type DynamicCategory = { param: string; label: string; path: string; hasChildren: boolean };
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([]);
  const [loadingDynamicCategories, setLoadingDynamicCategories] = useState(false);
  // زنجیره‌ی دسته‌بندی‌های تیک‌خورده (از ریشه تا عمیق‌ترین) -- خالی یعنی هنوز
  // هیچی تیک نخورده و باید سطح اول (زیرشاخه‌ی مستقیم بخش اصلی) نشون داده بشه
  const [categoryStack, setCategoryStack] = useState<DynamicCategory[]>([]);

  const currentParentPath = categoryStack.length > 0 ? categoryStack[categoryStack.length - 1].path : null;

  // انتخاب یه بخش اصلی از گرید ۱۰تایی -- محلیه (URL عوض نمی‌شه)، فقط تعیین
  // می‌کنه زیردرخت کدوم بخش نشون داده بشه. drill-down قبلی هم پاک می‌شه چون
  // مسیرهای بخش قبلی دیگه معنی ندارن
  function selectTopSection(turkish: string) {
    setSelectedTopSection(turkish);
    setCategoryStack([]);
  }

  // کلیک روی هرکدوم از تب‌های نوار افقی بالا (برای ۸ بخش غیرجنسیتی) به همین
  // صفحه با ?section=<ترکی> لینک می‌ده -- این‌جا همون تابع انتخاب از گرید
  // ۱۰تایی رو صدا می‌زنیم تا زیرشاخه‌هاش همین‌جا (نه یه پاپ‌آپ جدا) باز بشن
  const sectionParam = searchParams.get("section");
  useEffect(() => {
    if (sectionParam && !isGenderTurkishSection(sectionParam) && sectionParam !== selectedTopSection) {
      selectTopSection(sectionParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionParam]);

  // اگه توکن دسته‌بندی از قبل با تشخیص هم‌زمانِ derivedRootSection (بالا) حل
  // شده باشه، این fetch اصلاً لازم نیست -- فقط برای زیردسته‌های عمیق‌تر (که
  // اتحاد rootWc نیستن، پس فقط از دیتابیس قابل‌شناساییان) واقعاً نیاز می‌شه
  useEffect(() => {
    if (!activeCategoryTokenParam || categoryStack.length > 0 || derivedRootSection) return;
    let cancelled = false;
    fetch(
      `/api/marketplaces/${siteSlug}/trendyol-categories?resolveParam=${encodeURIComponent(
        decodeTrendyolCategoryParam(activeCategoryTokenParam)
      )}`
    )
      .then((res) => res.json())
      .then((data: { topSection: string | null; stack: DynamicCategory[] }) => {
        if (cancelled || !data.topSection) return;
        // اگه مسیر بازسازی‌شده زیر Kadın/Erkek بود، selectedTopSection ست نمی‌شه --
        // effectiveTopSection خودش از روی توکن attrs=جنسیت~... (که از قبل توی
        // همین URL هست) درستش می‌سازه، بدون نیاز به ثبت جداگونه
        if (!isGenderTurkishSection(data.topSection)) {
          setSelectedTopSection(data.topSection);
        }
        setCategoryStack(data.stack);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryTokenParam, siteSlug]);

  // هر بار بخش اصلی یا سطح drill-down فعلی عوض بشه، همون سطح رو از داده‌ی واقعی
  // ترندیول (TrendyolCategoryCache) می‌گیریم -- بدون انتخاب بخش، این فیلتر معنی نداره
  useEffect(() => {
    if (!effectiveTopSection) {
      setDynamicCategories([]);
      return;
    }
    let cancelled = false;
    setLoadingDynamicCategories(true);
    const params = new URLSearchParams({ section: effectiveTopSection });
    if (currentParentPath) params.set("parentPath", currentParentPath);
    fetch(`/api/marketplaces/${siteSlug}/trendyol-categories?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDynamicCategories(data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setDynamicCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDynamicCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTopSection, siteSlug, currentParentPath]);

  // آیدی خامِ دسته‌بندی فعلاً فعال (اگه چیزی انتخاب شده) -- برای اسکوپ کردن
  // فیلترها به همون دسته (مثلاً رنگ‌های موجود توی «پیراهن»، نه کل «پوشاک»)
  const activeCategoryParam = categoryStack.length > 0 ? categoryStack[categoryStack.length - 1].param : null;
  const activeCategoryWc = activeCategoryParam?.startsWith("wc=") ? activeCategoryParam.slice(3) : null;

  // فقط ادمین می‌بینه -- برخلاف صفر-محصول (که خودکار تشخیص داده می‌شه)، بعضی
  // دسته‌های میلا نتیجه‌ی غیرصفر ولی کاملاً بی‌ربط برمی‌گردونن (مثلاً «اتو»
  // یه مشت روتختی می‌ده) -- این خودکار قابل‌تشخیص نیست، فقط با چشمِ ادمین.
  // این دکمه دقیقاً همون confirmedEmpty ای که برای حالت صفر-محصول ساخته شده
  // رو دستی ست می‌کنه، چون اثرش (حذف از لیست دسته‌بندی‌های همین سایت) یکیه
  const [markingIrrelevant, setMarkingIrrelevant] = useState(false);
  const [markIrrelevantError, setMarkIrrelevantError] = useState("");

  async function markCurrentCategoryIrrelevant() {
    if (!activeCategoryParam || markingIrrelevant) return;
    setMarkingIrrelevant(true);
    setMarkIrrelevantError("");
    try {
      const res = await fetch(`/api/admin/marketplaces/${siteSlug}/trendyol-categories/mark-irrelevant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ param: activeCategoryParam }),
      });
      if (!res.ok) {
        setMarkIrrelevantError("ثبت نشد، دوباره تلاش کن");
        return;
      }
      uncheckChipAt(categoryStack.length - 1);
    } catch {
      setMarkIrrelevantError("خطا در ارتباط با سرور");
    } finally {
      setMarkingIrrelevant(false);
    }
  }

  type DynamicFilterValue = { id: string; label: string; count: number };
  type DynamicFilterGroup = {
    key: string;
    title: string;
    paramKey: "wb" | "wcl" | "tag" | "mb" | "prc" | "pr" | "attr" | "vr";
    attrFilterKey?: string;
    selectionType: "MULTIPLE" | "SINGLE";
    order: number;
    values: DynamicFilterValue[];
  };

  const [dynamicGroups, setDynamicGroups] = useState<DynamicFilterGroup[]>([]);
  const [loadingDynamicGroups, setLoadingDynamicGroups] = useState(false);
  const [dynamicGroupsError, setDynamicGroupsError] = useState("");
  const [groupQueries, setGroupQueries] = useState<Record<string, string>>({});

  // هر بار بخش اصلی یا دسته‌بندی فعلی عوض بشه، همه‌ی فیلترهای واقعی همون بخش
  // (رنگ، برند، ویژگی‌های خاص دسته، فیات، امتیاز، ...) رو می‌گیریم
  useEffect(() => {
    if (!effectiveTopSection && !activeCategoryWc) {
      setDynamicGroups([]);
      setDynamicGroupsError("");
      return;
    }
    let cancelled = false;
    setLoadingDynamicGroups(true);
    setDynamicGroupsError("");
    const params = new URLSearchParams();
    if (effectiveTopSection) params.set("section", effectiveTopSection);
    if (activeCategoryWc) params.set("wc", activeCategoryWc);
    fetch(`/api/marketplaces/${siteSlug}/trendyol-filters?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setDynamicGroupsError(data.error ?? "خطا در دریافت فیلترها");
          setDynamicGroups([]);
          return;
        }
        setDynamicGroups(data.groups ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setDynamicGroupsError("خطا در ارتباط با سرور");
          setDynamicGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDynamicGroups(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTopSection, siteSlug, activeCategoryWc]);

  // برای هر paramKey، توکن‌های انتخاب‌شده رو از selectedAttrs درمیاره
  function selectedIdsFor(paramKey: string): string[] {
    const sentinel =
      paramKey === "wb"
        ? TRENDYOL_RAW_BRAND_ATTR
        : paramKey === "wcl"
          ? TRENDYOL_RAW_COLOR_ATTR
          : paramKey === "tag"
            ? TRENDYOL_RAW_TAG_ATTR
            : paramKey === "mb"
              ? TRENDYOL_RAW_MERCHANT_BADGE_ATTR
              : paramKey === "prc"
                ? TRENDYOL_RAW_PRICE_ATTR
                : paramKey === "pr"
                  ? TRENDYOL_RAW_RATING_ATTR
                  : paramKey === "vr"
                    ? TRENDYOL_RAW_VARIANT_ATTR
                    : TRENDYOL_RAW_ATTR_ATTR;
    return selectedAttrs
      .filter((t) => t.startsWith(`${sentinel}~`))
      .map((t) => t.slice(sentinel.length + 1));
  }

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  // قبل از هر تغییر فیلتر، اول از سرور می‌پرسیم «این ترکیب جواب می‌ده یا 404؟».
  // اگه جواب داد، همون‌جا commit می‌شه (URL عوض می‌شه). اگه نداد، هیچ‌وقت
  // searchParams عوض نشده بوده، پس چک‌باکس خودکار به حالت قبلی برمی‌گرده --
  // مشتری می‌فهمه این فیلتر مجاز نیست، بدون اینکه صفحه‌ی نتایج خراب بشه
  const validateAndCommit = useCallback(
    async (candidateCategory: string | null, candidateAttrTokens: string[]) => {
      // یه درخواست در حال انجامه -- تا تموم نشه (و وقفه‌ش هم رعایت نشه)، درخواست
      // جدید قبول نمی‌کنیم (محافظ اضافه، چون overlay هم جلوی کلیک رو می‌گیره)
      if (isChecking) return;

      setIsChecking(true);
      setShowRejected(false);
      const startedAt = Date.now();
      try {
        const res = await fetch(`/api/marketplaces/${siteSlug}/check-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: candidateCategory,
            attrs: parseAttrTokens(candidateAttrTokens),
          }),
        });
        const data: { ok: boolean } = await res.json();
        if (data.ok) {
          updateParams({
            category: candidateCategory,
            attrs: candidateAttrTokens.join(",") || null,
          });
        } else {
          setShowRejected(true);
        }
      } catch {
        setShowRejected(true);
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = MIN_REQUEST_INTERVAL_MS - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        setIsChecking(false);
      }
    },
    [siteSlug, updateParams, isChecking]
  );

  // یه گزینه‌ی فیلتر ممکنه چندتا توکن زیرین داشته باشه (مقدار تکراری بین چند
  // ویژگی) -- انتخابش باید همه‌شون رو با هم اضافه/حذف کنه، نه فقط یکی رو
  function toggleAttrGroup(tokens: string[]) {
    const allSelected = tokens.every((t) => selectedAttrs.includes(t));
    const nextAttrs = allSelected
      ? selectedAttrs.filter((v) => !tokens.includes(v))
      : [...selectedAttrs, ...tokens.filter((t) => !selectedAttrs.includes(t))];
    validateAndCommit(selectedCategory || null, nextAttrs);
  }

  // دسته‌بندی‌های پویا (بر اساس جنسیت) هم از همون مکانیزم attrs استفاده می‌کنن
  // (سرگذاشتنشون زیر یه attributeName ساختگی)، پس toggle/validate/rollback
  // دقیقاً مثل بقیه‌ی فیلترها رایگان به‌دستشون میاد.
  //
  // نکته‌ی مهم: چیپ‌ها (زنجیره‌ی مسیر، مثلاً «پوشاک» + «پالتو») فقط برای
  // نمایشن -- توی selectedAttrs همیشه فقط یه توکن __trendyolCategory فعاله
  // (همون عمیق‌ترین چیپ). اگه هر دو تا رو با هم می‌فرستادیم، دو تا wc= جدا
  // توی URL نهایی می‌رفت و ترندیول به‌جای محدود کردن به عمیق‌ترین دسته
  // (پالتو)، نتیجه رو نامشخص/گسترده‌تر برمی‌گردوند.
  function activeTokenFor(stack: DynamicCategory[]): string | null {
    if (stack.length === 0) return null;
    return `${TRENDYOL_RAW_CATEGORY_ATTR}~${encodeTrendyolCategoryParam(stack[stack.length - 1].param)}`;
  }

  // categoryStack فقط یه state موقت سمت کلاینته -- اگه صفحه reload بشه یا
  // کامپوننت دوباره mount بشه، این خالی می‌شه ولی توکن دسته‌بندی قبلی هنوز
  // توی selectedAttrs واقعی مونده. برای همین به‌جای اعتماد به categoryStack،
  // مستقیم خودِ selectedAttrs رو می‌گردیم تا مطمئن بشیم همیشه حداکثر یه
  // wc= باقی می‌مونه (نه چندتا wc= جدا که ترندیول قبولش نمی‌کنه)
  function removeAllCategoryTokens(attrs: string[]): string[] {
    return attrs.filter((t) => !t.startsWith(`${TRENDYOL_RAW_CATEGORY_ATTR}~`));
  }

  // اگه بخش اصلیِ الان انتخاب‌شده جنسیتیه (Kadın/Erkek)، علاوه بر توکن خام
  // دسته‌بندی، توکن attrs=جنسیت~... هم اضافه/به‌روز می‌شه (برای سازگاری با
  // فیلتر جنسیت مستقل پایین‌تر). برای ۸ بخش دیگه، هر توکن جنسیتی که از قبل
  // (مستقل از این‌جا، از چک‌باکس جنسیت پایین سایدبار) روی URL بوده دست‌نخورده می‌مونه
  function withGenderTokenForCurrentSection(attrs: string[]): string[] {
    const section = TRENDYOL_TOP_SECTIONS.find((s) => s.turkish === effectiveTopSection);
    if (!section?.isGenderSection) return attrs;
    const withoutGender = attrs.filter((t) => !t.startsWith("جنسیت~"));
    return [...withoutGender, `جنسیت~${section.fa}`];
  }

  function checkCategory(category: DynamicCategory) {
    const newStack = [...categoryStack, category];
    const newToken = activeTokenFor(newStack);
    const withoutOld = withGenderTokenForCurrentSection(removeAllCategoryTokens(selectedAttrs));
    const nextAttrs = newToken ? [...withoutOld, newToken] : withoutOld;
    validateAndCommit(selectedCategory || null, nextAttrs);
    setCategoryStack(newStack);
  }

  // برداشتن تیک یه چیپ خاص، هم خودش هم هر چیپ عمیق‌تری که بعدش انتخاب شده رو
  // پاک می‌کنه -- چون اون‌ها منطقاً به این یکی وابسته بودن. بعدش اگه هنوز
  // چیپی مونده باشه، عمیق‌ترینِ باقی‌مونده می‌شه توکن فعال جدید
  function uncheckChipAt(index: number) {
    const newStack = categoryStack.slice(0, index);
    const newToken = activeTokenFor(newStack);
    const withoutOld = withGenderTokenForCurrentSection(removeAllCategoryTokens(selectedAttrs));
    const nextAttrs = newToken ? [...withoutOld, newToken] : withoutOld;
    validateAndCommit(selectedCategory || null, nextAttrs);
    setCategoryStack(newStack);
  }

  // بازگشت کامل به گرید ۱۰تایی -- هم دسته‌بندی خام (اگه انتخاب شده بود) از
  // URL پاک می‌شه، هم selectedTopSection ریست می‌شه
  function clearTopSection() {
    const withoutCategory = removeAllCategoryTokens(selectedAttrs);
    if (withoutCategory.length !== selectedAttrs.length) {
      validateAndCommit(selectedCategory || null, withoutCategory);
    }
    setCategoryStack([]);
    setSelectedTopSection(null);
  }

  // رنگ/برند واقعاً چندانتخابی‌ان (برخلاف دسته‌بندی که drill-down/collapse
  // بود) -- فقط toggle ساده‌ی یه توکن، همون مکانیزم toggleAttrGroup که از قبل
  // rollback/validate خودکار داره
  function toggleRawFilter(sentinel: string, id: string) {
    toggleAttrGroup([`${sentinel}~${id}`]);
  }

  // برای فیلترهای تک‌انتخابی (فیات، امتیاز) -- انتخاب یه گزینه‌ی جدید، قبلی رو
  // از همون گروه جایگزین می‌کنه؛ کلیک روی همون گزینه‌ی انتخاب‌شده، پاکش می‌کنه
  function selectSingleRawFilter(sentinel: string, id: string) {
    const token = `${sentinel}~${id}`;
    const alreadySelected = selectedAttrs.includes(token);
    const withoutSentinel = selectedAttrs.filter((t) => !t.startsWith(`${sentinel}~`));
    const nextAttrs = alreadySelected ? withoutSentinel : [...withoutSentinel, token];
    validateAndCommit(selectedCategory || null, nextAttrs);
  }

  // یه گروه فیلتر پویا (رنگ/برند/فیات/امتیاز/...) رو رندر می‌کنه -- defaultOpen
  // کنترل می‌کنه که اول باز باشه یا بسته (دقیقاً مثل خودِ ترندیول: چیزهایی که
  // جا نمی‌شن بسته‌ان تا کاربر خودش بازشون کنه)
  function renderDynamicGroup(g: DynamicFilterGroup, defaultOpen: boolean) {
    // فیات ثابت نیست (بازه‌های پیش‌فرض بین دسته‌های ارزون و گرون فرق می‌کنه)، پس
    // به‌جای چک‌باکس‌های آماده، خودِ کاربر عدد از/تا رو تایپ می‌کنه
    if (g.paramKey === "prc") {
      return (
        <FilterSection key={g.key} title={g.title} defaultOpen={defaultOpen}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={priceMinInput}
              onChange={(e) => setPriceMinInput(e.target.value)}
              placeholder="از (لیر ترکیه)"
              className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-[var(--color-muted)]">تا</span>
            <input
              type="number"
              inputMode="numeric"
              value={priceMaxInput}
              onChange={(e) => setPriceMaxInput(e.target.value)}
              placeholder="تا (لیر ترکیه)"
              className="w-full border cut-line rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={applyPriceRange}
              className="text-xs bg-[var(--color-wine)] text-white rounded-lg px-3 py-1.5 flex-1"
            >
              اعمال بازه
            </button>
            {currentPriceValue && (
              <button onClick={clearPriceRange} className="text-xs text-[var(--color-muted)] underline shrink-0">
                پاک کردن
              </button>
            )}
          </div>
        </FilterSection>
      );
    }

    const isGenericPair = g.paramKey === "attr" || g.paramKey === "vr";
    const selectedIds = selectedIdsFor(g.paramKey);
    const query = groupQueries[g.key] ?? "";
    // برای گروه‌های "attr"/"vr"، هر آیتم واقعاً "filterKey|valueId" کاملـه؛
    // برای بقیه فقط خودِ valueId
    const idFor = (valueId: string) => (isGenericPair ? `${g.attrFilterKey}|${valueId}` : valueId);
    const isSelected = (valueId: string) => selectedIds.includes(idFor(valueId));
    const toggle = (valueId: string) => {
      const sentinel =
        g.paramKey === "wb"
          ? TRENDYOL_RAW_BRAND_ATTR
          : g.paramKey === "wcl"
            ? TRENDYOL_RAW_COLOR_ATTR
            : g.paramKey === "tag"
              ? TRENDYOL_RAW_TAG_ATTR
              : g.paramKey === "mb"
                ? TRENDYOL_RAW_MERCHANT_BADGE_ATTR
                : g.paramKey === "prc"
                  ? TRENDYOL_RAW_PRICE_ATTR
                  : g.paramKey === "pr"
                    ? TRENDYOL_RAW_RATING_ATTR
                    : g.paramKey === "vr"
                      ? TRENDYOL_RAW_VARIANT_ATTR
                      : TRENDYOL_RAW_ATTR_ATTR;
      if (g.selectionType === "SINGLE") selectSingleRawFilter(sentinel, idFor(valueId));
      else toggleRawFilter(sentinel, idFor(valueId));
    };

    const filtered = g.values
      .filter((v) => v.label.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => Number(isSelected(b.id)) - Number(isSelected(a.id)));

    return (
      <FilterSection key={g.key} title={g.title} defaultOpen={defaultOpen}>
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)] py-1">موردی پیدا نشد.</p>
        ) : (
          <>
            {g.values.length > 8 && (
              <input
                type="text"
                value={query}
                onChange={(e) => setGroupQueries((prev) => ({ ...prev, [g.key]: e.target.value }))}
                placeholder={`${g.title} مورد نظر را جستجو کنید`}
                className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
              />
            )}
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {filtered.map((v) => (
                <li key={v.id}>
                  <FilterCheckbox checked={isSelected(v.id)} onChange={() => toggle(v.id)} label={v.label} />
                </li>
              ))}
            </ul>
          </>
        )}
      </FilterSection>
    );
  }

  // فیات ثابت نیست (بازه‌های پیش‌فرض بین دسته‌های ارزون و گرون فرق می‌کنه)، پس
  // به‌جای چک‌باکس‌های آماده، خودِ کاربر عدد از/تا رو تایپ می‌کنه
  const currentPriceValue = selectedIdsFor("prc")[0] ?? "";
  const [currentPriceMin, currentPriceMax] = currentPriceValue.split("-");
  const [priceMinInput, setPriceMinInput] = useState(currentPriceMin ?? "");
  const [priceMaxInput, setPriceMaxInput] = useState(currentPriceMax ?? "");

  function applyPriceRange() {
    const min = priceMinInput.trim();
    const max = priceMaxInput.trim();
    if (!min && !max) {
      selectSingleRawFilter(TRENDYOL_RAW_PRICE_ATTR, currentPriceValue); // یعنی پاک کردن (toggle می‌کنه چون همون مقدار قبلیه)
      return;
    }
    selectSingleRawFilter(TRENDYOL_RAW_PRICE_ATTR, `${min || 0}-${max || 999999}`);
  }

  function clearPriceRange() {
    setPriceMinInput("");
    setPriceMaxInput("");
    if (currentPriceValue) selectSingleRawFilter(TRENDYOL_RAW_PRICE_ATTR, currentPriceValue);
  }

  // این سیستم قدیمی (ExternalSiteAttributeParam) قبلاً برای همه‌ی ویژگی‌ها
  // (سایز، رنگ، ...) استفاده می‌شد؛ الان که همه‌شون مستقیم از aggregations
  // زنده‌ی خودِ ترندیول میان، فقط «جنسیت» این‌جا لازمه -- چون کل سیستم پویا
  // (دسته‌بندی، رنگ، برند، ...) دقیقاً بر همین یه چیز سوار شده.
  // ولی خودِ این فیلتر فقط وقتی معنی داره که هنوز هیچ بخشی انتخاب نشده (چون
  // جنسیت خودش یه راه ورود به Kadın/Erkek هم هست) یا بخش انتخاب‌شده واقعاً
  // جنسیتیه -- توی سوپرمارکت/الکترونیک/... که جنسیت اصلاً معنی نداره، نشونش نمی‌دیم
  const currentSectionIsGendered = effectiveTopSection
    ? TRENDYOL_TOP_SECTIONS.find((s) => s.turkish === effectiveTopSection)?.isGenderSection ?? false
    : true;
  const groupedFilters = currentSectionIsGendered
    ? groupAttributeFilters(attributeFilters).filter((g) => g.title === "جنسیت")
    : [];
  // فیلترهای پویای پایین (رنگ/برند/...) وقتی معنی دارن که یا یه بخش اصلی
  // انتخاب شده یا مستقیماً یه دسته‌بندی (wc) فعاله
  const hasDynamicFilterScope = Boolean(effectiveTopSection || activeCategoryWc);

  const hasAnySelection = Boolean(selectedCategory) || selectedAttrs.length > 0;
  const busy = isPending || isChecking;

  return (
    <>
      {/* موقع بررسی فیلتر، کل صفحه رو (نه فقط سایدبار) قفل می‌کنه و شکل موس
          حالت "در انتظار" می‌گیره -- تا کاربر جای دیگه کلیک نکنه و کلیک‌های
          پشت‌سرهم باعث چندتا درخواست هم‌زمان به ترندیول نشه */}
      {busy && <div className="fixed inset-0 z-50 cursor-wait" aria-hidden="true" />}

      <aside
        className={`space-y-4 text-sm transition-opacity sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto pl-1 pb-4 ${
          busy ? "opacity-60 pointer-events-none cursor-wait" : "opacity-100"
        }`}
      >
      {showRejected && !isChecking && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          مشکلی پیش اومد، لطفاً بعداً دوباره تلاش کنید.
        </div>
      )}

      {/* دسته‌بندی پویا -- مستقیم از داده‌ی واقعی ترندیول (TrendyolCategoryCache).
          دقیقاً مثل خودِ ترندیول یه لیست چک‌باکسی واحده: هرچی از بالا به پایین
          تیک خورده (عمیق‌ترین اول) بالای لیست پین می‌مونه، و زیرش زیرشاخه‌های
          مستقیمِ عمیق‌ترین تیک‌خورده به‌عنوان گزینه‌ی بعدی میاد -- سلسله‌مراتبیه،
          نه یهو کل درخت. سطح صفر (۸ بخش غیرجنسیتی) هم دقیقاً همین مکانیزم رو
          داره، فقط به‌جای categoryStack، selectedTopSection پین می‌شه. زنانه/مردانه
          این‌جا اصلاً گزینه نیستن -- چون فیلتر «جنسیت» مستقل پایین‌تر از قبل
          هست، تیک‌زدن اون‌جا خودش effectiveTopSection رو ست می‌کنه و مستقیم
          می‌ره سراغ زیردرخت همون جنسیت، بدون تکرار جنسیت به‌عنوان یه دسته‌بندی */}
      <FilterSection title="دسته‌بندی">
        {(categoryStack.length > 0 || topSectionChipValue) && (
          <ul className="space-y-0.5 mb-1">
            {[...categoryStack].reverse().map((chip, reversedIndex) => (
              <li key={chip.path}>
                <FilterCheckbox
                  checked
                  onChange={() => uncheckChipAt(categoryStack.length - 1 - reversedIndex)}
                  label={chip.label}
                  bold
                />
              </li>
            ))}
            {topSectionChipValue && (
              <li>
                <FilterCheckbox
                  checked
                  onChange={clearTopSection}
                  label={TRENDYOL_TOP_SECTIONS.find((s) => s.turkish === topSectionChipValue)?.fa ?? ""}
                  bold
                />
              </li>
            )}
          </ul>
        )}
        {isAdmin && activeCategoryParam && (
          <div className="mb-1 -mt-0.5">
            <button
              type="button"
              onClick={markCurrentCategoryIrrelevant}
              disabled={markingIrrelevant}
              className="text-[11px] text-red-700 hover:underline disabled:opacity-60"
            >
              {markingIrrelevant ? "در حال ثبت..." : "🚫 نتایج این دسته با این سایت نمی‌خوره (ادمین)"}
            </button>
            {markIrrelevantError && <p className="text-[11px] text-red-700 mt-0.5">{markIrrelevantError}</p>}
          </div>
        )}
        {!effectiveTopSection ? (
          <ul className="space-y-0.5">
            {TRENDYOL_TOP_SECTIONS.filter((s) => !s.isGenderSection).map((s) => (
              <li key={s.turkish}>
                <FilterCheckbox checked={false} onChange={() => selectTopSection(s.turkish)} label={s.fa} />
              </li>
            ))}
          </ul>
        ) : loadingDynamicCategories ? null : dynamicCategories.length > 0 ? (
          <>
            {dynamicCategories.length > 8 && (
              <input
                type="text"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="دسته مورد نظر را جستجو کنید"
                className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
              />
            )}
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {(() => {
                const filtered = dynamicCategories.filter((c) =>
                  c.label.toLowerCase().includes(categoryQuery.trim().toLowerCase())
                );
                if (filtered.length === 0) {
                  return <li className="text-xs text-[var(--color-muted)] py-1">دسته‌ای پیدا نشد.</li>;
                }
                return filtered.map((c) => (
                  <li key={c.param}>
                    <FilterCheckbox checked={false} onChange={() => checkCategory(c)} label={c.label} />
                  </li>
                ));
              })()}
            </ul>
          </>
        ) : null}
      </FilterSection>

      {/* همه‌ی فیلترهای پویا -- مستقیم از aggregations واقعی ترندیول (همون
          جنسیت + دسته‌بندی فعلی، اگه انتخاب شده باشه): رنگ، برند، ویژگی‌های
          خاص دسته (مثل نوع کیف)، فیات، امتیاز، برچسب‌های کمپینی، نوع فروشنده.
          ترتیب و بازبودنشون دقیقاً مثل خودِ ترندیول -- برند قبل از جنسیت
          (باز)، بقیه بعد از جنسیت (بسته، چون جا نمی‌شن و کاربر خودش بازشون
          می‌کنه) */}
      {hasDynamicFilterScope && (
        <>
          {dynamicGroupsError && (
            <p className="text-xs text-red-600 py-1 whitespace-pre-wrap">{dynamicGroupsError}</p>
          )}
          {!loadingDynamicGroups &&
            !dynamicGroupsError &&
            !activeCategoryWc &&
            dynamicGroups.length === 0 && (
              <p className="text-xs text-[var(--color-muted)] py-1">
                برای دیدن فیلترهای بیشتر (رنگ، برند، سایز، ...)، اول یه دسته‌بندی از بالا انتخاب کن.
              </p>
            )}
          {dynamicGroups.filter((g) => g.order <= 2).map((g) => renderDynamicGroup(g, true))}
        </>
      )}

      {groupedFilters.map((group) => {
        const query = attrQueries[group.title] ?? "";
        // مقادیر تیک‌خورده میان بالای لیست تا کاربر بدون اسکرول ببینه چی انتخاب کرده
        const filteredItems = group.items
          .filter((it) => it.label.toLowerCase().includes(query.trim().toLowerCase()))
          .sort((a, b) => {
            const aSelected = a.tokens.every((t) => selectedAttrs.includes(t));
            const bSelected = b.tokens.every((t) => selectedAttrs.includes(t));
            return Number(bSelected) - Number(aSelected);
          });
        return (
          <FilterSection key={group.title} title={group.title}>
            <input
              type="text"
              value={query}
              onChange={(e) => setAttrQueries((prev) => ({ ...prev, [group.title]: e.target.value }))}
              placeholder={`جستجوی ${group.title}`}
              className="w-full border cut-line rounded-lg px-3 py-1.5 mb-2 bg-white text-xs"
            />
            <ul className="space-y-0.5 max-h-48 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <li className="text-xs text-[var(--color-muted)] py-1">موردی پیدا نشد.</li>
              ) : (
                filteredItems.map((it) => (
                  <li key={it.label}>
                    <FilterCheckbox
                      checked={it.tokens.every((t) => selectedAttrs.includes(t))}
                      onChange={() => toggleAttrGroup(it.tokens)}
                      label={it.label}
                    />
                  </li>
                ))
              )}
            </ul>
          </FilterSection>
        );
      })}

      {hasDynamicFilterScope && dynamicGroups.filter((g) => g.order > 2).map((g) => renderDynamicGroup(g, false))}

      {hasAnySelection && (
        <button
          onClick={() => {
            setShowRejected(false);
            router.replace(pathname);
          }}
          className="text-xs text-[var(--color-muted)] underline"
        >
          پاک کردن همه فیلترها
        </button>
      )}
    </aside>
    </>
  );
}
