import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRENDYOL_TOP_SECTIONS } from "@/lib/trendyolTopSections";
import { TRENDYOL_RAW_CATEGORY_SENTINEL, encodeTrendyolCategoryParam } from "@/lib/externalSites";
import { siteSlugToKind } from "@/lib/trendyol";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

type TreeNode = {
  id: string;
  name: string;
  slug: string;
  icon: null;
  children: TreeNode[];
};

// برخلاف روت سلسله‌مراتبی خواهر (که سطح به سطح، با یه درخواست جدا برای هر
// drill-down کار می‌کنه)، این‌جا کل درخت دو سطح اول هر ۱۰ بخش اصلی (زیرشاخه‌ی
// مستقیم + زیرشاخه‌ی مستقیمِ اون‌ها) رو با یه کوئری واحد می‌سازیم -- برای منوی
// سه‌خط/نوار بالای سایت که باید همه‌چیز رو یه‌جا (بدون drill-down مرحله‌به‌مرحله)
// نشون بده. سطوح عمیق‌تر (سه‌سطحی به بعد) عمداً این‌جا نمیان -- کاربر برای اون‌ها
// همچنان از فیلتر سایدبار (که drill-down کامل داره) استفاده می‌کنه
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = siteSlugToKind(slug);
  const roots: (TreeNode & { attrsQuery?: string; rawCategoryLinks: true })[] = [];

  // قبلاً برای هر کدوم از ۱۰ بخشِ اصلی یه findMany جدا زده می‌شد -- یعنی ۱۰
  // رفت‌وبرگشتِ جداگانه‌ی DB توی *هر* بارگذاریِ این endpoint (که تقریباً هر
  // صفحه‌ی ترندیول با منوی سه‌خط صداش می‌زنه). الان یه findMany برای کلِ سایت
  // (با OR رویِ همه‌ی پیشوندهای بخش‌ها)، و تفکیکِ هر بخش از رویِ همون یه
  // نتیجه، توی حافظه انجام می‌شه -- خروجی دقیقاً همون قبلیه
  const prefixes = TRENDYOL_TOP_SECTIONS.map(({ turkish }) => `${turkish} > `);
  const allRows = await prisma.trendyolCategoryCache.findMany({
    where: {
      site,
      confirmedEmpty: false,
      OR: prefixes.map((prefix) => ({ path: { startsWith: prefix } })),
    },
    select: { id: true, param: true, nameFa: true, nameTr: true, path: true },
  });

  for (const { turkish: section, fa: label, isGenderSection, rootWc } of TRENDYOL_TOP_SECTIONS) {
    const prefix = `${section} > `;
    const rows = allRows.filter((row) => row.path.startsWith(prefix));

    const level1 = new Map<string, TreeNode>();
    for (const row of rows) {
      const rel = row.path.slice(prefix.length).split(" > ");
      if (rel.length === 1 && !level1.has(rel[0])) {
        level1.set(rel[0], {
          id: row.id,
          name: row.nameFa ?? row.nameTr,
          slug: row.param,
          icon: null,
          children: [],
        });
      }
    }
    for (const row of rows) {
      const rel = row.path.slice(prefix.length).split(" > ");
      if (rel.length === 2) {
        const parent = level1.get(rel[0]);
        if (parent) {
          parent.children.push({
            id: row.id,
            name: row.nameFa ?? row.nameTr,
            slug: row.param,
            icon: null,
            children: [],
          });
        }
      }
    }

    const children = Array.from(level1.values()).sort((a, b) => a.name.localeCompare(b.name, "fa"));
    for (const c of children) c.children.sort((a, b) => a.name.localeCompare(b.name, "fa"));

    if (children.length > 0) {
      roots.push({
        id: `section-${section}`,
        name: label,
        slug: `__section-${section}`,
        icon: null,
        ...(isGenderSection
          ? { attrsQuery: `جنسیت~${label}` }
          : rootWc
            ? { attrsQuery: `${TRENDYOL_RAW_CATEGORY_SENTINEL}~${encodeTrendyolCategoryParam(rootWc)}` }
            : {}),
        rawCategoryLinks: true,
        children,
      });
    }
  }

  return NextResponse.json({ roots });
}
