import { prisma } from "@/lib/prisma";
import { categoryIcon } from "@/lib/categoryIcon";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  children: CategoryNode[];
};

// مثل CategoryNode، ولی برای گروه‌های جنسیتی مصنوعی (زنانه/مردانه) توی مگامنو --
// چون جنسیت خودش Category نیست، هر لینک زیرمجموعه‌اش باید فیلتر جنسیت رو هم queryش داشته باشه.
// rawCategoryLinks یعنی slug هر گره‌ی این ریشه یه پارامتر خامِ ترندیوله (مثل
// "wc=82")، نه اسلاگ دسته‌بندی مزون -- لینک‌سازی باید توکن attrs بسازه، نه
// querystring معمولی (ببین CategoryMegaPanel.tsx)
export type MegaMenuRoot = CategoryNode & { attrsQuery?: string; rawCategoryLinks?: boolean };

// درخت کامل دسته‌بندی‌ها از ریشه (parentId=null) تا ۳ سطح عمق -- برای مگامنو و فیلتر
// (۳ سطح چیزی مثل «بچگانه ← دخترانه ← شومیز دخترانه» رو پوشش می‌ده)
export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const roots = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: {
      children: {
        orderBy: { name: "asc" },
        include: {
          children: {
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  return roots.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon: r.icon,
    children: r.children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      children: c.children.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        icon: g.icon,
        children: [],
      })),
    })),
  }));
}

// اسلاگ خود گره + همه‌ی فرزندان و نوه‌هاش -- برای اینکه انتخاب یه دسته‌ی والد
// (که خودش محصولی نداره، مثل «بچگانه») همه‌ی زیرمجموعه‌هاشو هم فیلتر کنه
export function collectDescendantSlugs(node: CategoryNode): string[] {
  return [node.slug, ...node.children.flatMap(collectDescendantSlugs)];
}

// یه اسلاگ رو توی کل درخت پیدا می‌کنه (برای گسترش انتخاب فیلتر به فرزندانش)
export function findNodeBySlug(tree: CategoryNode[], slug: string): CategoryNode | null {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

// لیست اسلاگ‌های انتخاب‌شده رو گسترش می‌ده: هر اسلاگ انتخاب‌شده + همه‌ی فرزندانش
export function expandSelectedSlugs(tree: CategoryNode[], selected: string[]): string[] {
  const expanded = new Set<string>();
  for (const slug of selected) {
    const node = findNodeBySlug(tree, slug);
    if (node) {
      for (const s of collectDescendantSlugs(node)) expanded.add(s);
    } else {
      expanded.add(slug);
    }
  }
  return Array.from(expanded);
}

// دو گروه مصنوعی «زنانه» و «مردانه» برای مگامنو -- دقیقاً مثل Kadın/Erkek توی ترندیول.
// جنسیت خودش Category نیست، پس ستون‌هاش رو از روی محصولات واقعی می‌سازیم:
// «کدوم دسته‌بندی‌های ریشه (پوشاک/کفش/اکسسوری) الان حداقل یه محصول با این جنسیت دارن؟»
// ستون = همون دسته‌ی ریشه (مثلا «پوشاک»)، ردیف‌های زیرش = زیردسته‌های واقعی‌ش (تیشرت، پیراهن، ...)
// -- دقیقاً مثل ستون «Giyim» تو ترندیول که زیرش Elbise/Tişört/Gömlek میاد
export async function fetchGenderMegaGroups(tree: CategoryNode[]): Promise<MegaMenuRoot[]> {
  const rows = await prisma.productVariantValue.findMany({
    where: { attribute: "جنسیت", value: { in: ["زنانه", "مردانه"] } },
    select: {
      value: true,
      variant: { select: { product: { select: { categoryId: true } } } },
    },
  });

  function findRoot(categoryId: string): CategoryNode | null {
    for (const root of tree) {
      if (root.id === categoryId) return root;
      if (containsId(root, categoryId)) return root;
    }
    return null;
  }
  function containsId(node: CategoryNode, id: string): boolean {
    return node.children.some((c) => c.id === id || containsId(c, id));
  }

  const rootsByGender: Record<string, Map<string, CategoryNode>> = {
    زنانه: new Map(),
    مردانه: new Map(),
  };

  for (const row of rows) {
    const bucket = rootsByGender[row.value];
    if (!bucket) continue;
    const root = findRoot(row.variant.product.categoryId);
    if (root && !bucket.has(root.id)) bucket.set(root.id, root);
  }

  return (["زنانه", "مردانه"] as const)
    .map((gender) => ({
      id: `gender-${gender}`,
      name: gender,
      slug: `__gender-${gender}`,
      icon: null,
      attrsQuery: `جنسیت~${gender}`,
      children: Array.from(rootsByGender[gender].values()),
    }))
    .filter((g) => g.children.length > 0);
}

export type PersonalCategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null; // ممکنه نه عکس دسته و نه محصول نمونه‌ای برای fallback باشه
  color: string; // پس‌زمینه‌ی رنگی وقتی عکسی در کار نیست
  icon: string; // آیکون وقتی عکسی در کار نیست
};

// «دسته‌بندی‌های ویژه‌ی شما» -- بر اساس دسته‌ی محصولاتی که کاربر لایک/خرید کرده
// (بدون نیاز به ردیابی جدید؛ از روی ویشلیست و تاریخچه‌ی خرید واقعی می‌سازیمش).
// برای کاربر مهمان یا وقتی تاریخچه کافی نیست، با محبوب‌ترین دسته‌ها پر می‌شه.
export async function fetchPersonalCategories(
  userId: string | undefined,
  limit = 6
): Promise<PersonalCategory[]> {
  const weights = new Map<string, number>();

  if (userId) {
    const [wishlist, purchased] = await Promise.all([
      prisma.wishlistItem.findMany({
        where: { userId },
        select: { product: { select: { categoryId: true } } },
      }),
      prisma.orderItem.findMany({
        where: { order: { userId }, productId: { not: null } },
        select: { product: { select: { categoryId: true } } },
      }),
    ]);

    for (const w of wishlist) {
      const catId = w.product?.categoryId;
      if (catId) weights.set(catId, (weights.get(catId) ?? 0) + 1);
    }
    // خرید واقعی سه برابر وزن‌دارتر از صرفاً لایک‌کردنه
    for (const p of purchased) {
      const catId = p.product?.categoryId;
      if (catId) weights.set(catId, (weights.get(catId) ?? 0) + 3);
    }
  }

  const rankedIds = [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  if (rankedIds.length < limit) {
    const fallbackCategories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      take: limit + rankedIds.length,
    });
    for (const c of fallbackCategories) {
      if (rankedIds.length >= limit) break;
      if (!rankedIds.includes(c.id)) rankedIds.push(c.id);
    }
  }

  const finalIds = rankedIds.slice(0, limit);
  if (finalIds.length === 0) return [];

  const categoryRows = await prisma.category.findMany({ where: { id: { in: finalIds } } });
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

  // برای دسته‌هایی که عکس اختصاصی ندارن، عکس یه محصول فعال همون دسته رو جایگزین می‌کنیم
  const missingImageIds = categoryRows.filter((c) => !c.imageUrl).map((c) => c.id);
  const representativeImages = new Map<string, string>();
  if (missingImageIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { categoryId: { in: missingImageIds }, isActive: true },
      select: { categoryId: true, images: true },
      take: 50,
    });
    for (const p of products) {
      if (representativeImages.has(p.categoryId)) continue;
      try {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          representativeImages.set(p.categoryId, parsed[0]);
        }
      } catch {
        // نادیده گرفتن JSON نامعتبر
      }
    }
  }

  return finalIds
    .map((id) => categoryMap.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.imageUrl ?? representativeImages.get(c.id) ?? null,
      color: categoryIcon(c.name).color,
      icon: categoryIcon(c.name).icon,
    }));
}
