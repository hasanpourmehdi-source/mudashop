import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { normalizeSlug } from "@/lib/slug";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const variantSchema = z.object({
  sku: z.string().min(1, "SKU الزامی است"),
  stock: z.number().int().min(0, "موجودی نمی‌تواند منفی باشد"),
  priceDiff: z.number().int().default(0),
  values: z
    .array(
      z.object({
        attributeId: z.string().min(1),
        attribute: z.string().min(1),
        value: z.string().min(1),
      })
    )
    .min(1, "هر ترکیب باید حداقل یک ویژگی داشته باشد"),
});

const specSchema = z.object({
  label: z.string().min(1, "برچسب مشخصه الزامی است"),
  value: z.string().min(1, "مقدار مشخصه الزامی است"),
});

const productSchema = z.object({
  title: z.string().min(2, "عنوان باید حداقل ۲ حرف باشد"),
  slug: z.string().min(2, "اسلاگ باید حداقل ۲ حرف باشد"),
  description: z.string().min(1, "توضیحات الزامی است"),
  brandId: z.string().optional(),
  basePrice: z.number().int("قیمت باید عدد صحیح باشد").positive("قیمت باید مثبت باشد"),
  discount: z.number().int().min(0, "تخفیف نمی‌تواند منفی باشد").max(100, "تخفیف نمی‌تواند بیشتر از ۱۰۰٪ باشد").default(0),
  images: z.array(z.string()).min(1, "حداقل یک تصویر لازم است"),
  colorImages: z.record(z.string(), z.array(z.string())).optional(),
  fastShipping: z.boolean().optional(),
  isReturnable: z.boolean().optional(),
  careInstructions: z.string().optional(),
  videoUrl: z.string().optional(),
  categoryId: z.string().min(1, "انتخاب دسته‌بندی الزامی است"),
  variants: z.array(variantSchema).optional(),
  specifications: z.array(specSchema).optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: { include: { values: true } },
      specifications: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { images, colorImages, variants, specifications, ...rest } = parsed.data;
  rest.slug = normalizeSlug(rest.slug);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...rest,
          images: JSON.stringify(images),
          colorImages: JSON.stringify(colorImages ?? {}),
          ...(specifications && specifications.length > 0
            ? {
                specifications: {
                  create: specifications.map((s, order) => ({ ...s, order })),
                },
              }
            : {}),
        },
      });

      if (variants && variants.length > 0) {
        // عدم وجود یعنی عدم موجودی: ترکیب‌های صفر-موجودی اصلاً ذخیره نمی‌شن
        // (این چک سمت سرور، صرف‌نظر از فیلتر سمت کلاینت، اجرا می‌شه)
        const variantsToCreate = variants.filter((v) => v.stock > 0);

        if (variantsToCreate.length > 0) {
          // اتصال ویژگی‌های استفاده‌شده به محصول (برای فیلتر/نمایش)
          // توجه: createMany({skipDuplicates:true}) روی SQLite پشتیبانی نمی‌شه، پس تک‌تک upsert می‌کنیم
          const attributeIds = Array.from(
            new Set(variantsToCreate.flatMap((v) => v.values.map((val) => val.attributeId)))
          );
          for (const attributeId of attributeIds) {
            await tx.productAttribute.upsert({
              where: { productId_attributeId: { productId: created.id, attributeId } },
              create: { productId: created.id, attributeId },
              update: {},
            });
          }

          for (const variant of variantsToCreate) {
            await tx.productVariant.create({
              data: {
                productId: created.id,
                sku: variant.sku,
                stock: variant.stock,
                priceDiff: variant.priceDiff,
                values: {
                  create: variant.values.map((v) => ({
                    attribute: v.attribute,
                    value: v.value,
                  })),
                },
              },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error(err);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | string | undefined) ?? "";
      const targetStr = Array.isArray(target) ? target.join(",") : String(target);

      if (targetStr.includes("slug")) {
        return NextResponse.json(
          { error: "این اسلاگ قبلاً برای محصول دیگری استفاده شده — یک اسلاگ دیگر انتخاب کن" },
          { status: 409 }
        );
      }
      if (targetStr.includes("sku")) {
        return NextResponse.json(
          {
            error:
              "SKU یکی از ترکیب‌ها تکراری است (احتمالاً این محصول یا ترکیب مشابهش قبلاً ساخته شده). اسلاگ محصول را تغییر بده یا محصول قبلی را حذف کن.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `مقدار تکراری در فیلد: ${targetStr || "نامشخص"}` },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "خطا در ذخیره محصول" }, { status: 500 });
  }
}
