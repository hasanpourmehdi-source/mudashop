import { prisma } from "@/lib/prisma";

// مجموعه‌ی شناسه محصولات مزونی که کاربر به علاقه‌مندی‌هاش اضافه کرده
// اگه کاربر لاگین نباشه، مجموعه خالی برمی‌گرده (بدون کوئری اضافه)
export async function fetchWishlistedProductIds(
  userId: string | null | undefined
): Promise<Set<string>> {
  if (!userId) return new Set();

  const items = await prisma.wishlistItem.findMany({
    where: { userId, productId: { not: null } },
    select: { productId: true },
  });

  return new Set(items.map((i) => i.productId as string));
}

export async function isProductWishlisted(
  userId: string | null | undefined,
  productId: string
): Promise<boolean> {
  if (!userId) return false;

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });

  return !!existing;
}

// مجموعه‌ی externalId های ترندیول که کاربر به علاقه‌مندی اضافه کرده -- برای
// نشون‌دادن قلب پرشده روی کارت‌های گرید ترندیول از همون لحظه‌ی لود اول صفحه
export async function fetchWishlistedTrendyolIds(
  userId: string | null | undefined
): Promise<Set<string>> {
  if (!userId) return new Set();

  const items = await prisma.wishlistItem.findMany({
    where: { userId, externalId: { not: null } },
    select: { externalId: true },
  });

  return new Set(items.map((i) => i.externalId as string));
}
