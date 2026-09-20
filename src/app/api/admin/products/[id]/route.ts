import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { sanitizeProductDescription, stripHtmlToText } from "@/lib/sanitizeHtml";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { notifyStockSubscribers } from "@/lib/stockNotify";

const newVariantSchema = z.object({
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

const variantUpdateSchema = z.object({
  id: z.string().min(1),
  stock: z.number().int().min(0, "موجودی نمی‌تواند منفی باشد"),
  priceDiff: z.number().int().default(0),
  // اندازه‌ی واقعیِ این ترکیب (اختیاری) -- آرایه‌ی خالی یعنی «ادمین چیزی وارد نکرده»
  measurements: z
    .array(z.object({ label: z.string().min(1), cm: z.number().positive() }))
    .default([]),
});

const specSchema = z.object({
  label: z.string().min(1, "برچسب مشخصه الزامی است"),
  value: z.string().min(1, "مقدار مشخصه الزامی است"),
});

const updateSchema = z.object({
  title: z.string().min(2, "عنوان باید حداقل ۲ حرف باشد").optional(),
  description: z
    .string()
    .min(1, "توضیحات الزامی است")
    .transform((val) => sanitizeProductDescription(val))
    .refine((val) => stripHtmlToText(val).length > 0, { message: "توضیحات الزامی است" })
    .optional(),
  brandId: z.string().optional(),
  basePrice: z.number().int("قیمت باید عدد صحیح باشد").positive("قیمت باید مثبت باشد").optional(),
  discount: z.number().int().min(0, "تخفیف نمی‌تواند منفی باشد").max(100, "تخفیف نمی‌تواند بیشتر از ۱۰۰٪ باشد").optional(),
  images: z.array(z.string()).optional(),
  colorImages: z.record(z.string(), z.array(z.string())).optional(),
  fastShipping: z.boolean().optional(),
  isReturnable: z.boolean().optional(),
  defectNote: z.string().optional(),
  defectImage: z.string().optional(),
  careInstructions: z.string().optional(),
  videoUrl: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  variantUpdates: z.array(variantUpdateSchema).optional(),
  variantDeleteIds: z.array(z.string()).optional(),
  newVariants: z.array(newVariantSchema).optional(),
  specifications: z.array(specSchema).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { images, colorImages, variantUpdates, variantDeleteIds, newVariants, specifications, ...rest } =
    parsed.data;
  const skippedDeletes: string[] = [];
  const restockedVariantIds: string[] = [];

  try {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(images ? { images: JSON.stringify(images) } : {}),
          ...(colorImages ? { colorImages: JSON.stringify(colorImages) } : {}),
        },
      });

      // اگه لیست مشخصات فنی جدید داده شده، کامل جایگزین قبلی می‌شه
      if (specifications) {
        await tx.productSpecification.deleteMany({ where: { productId: id } });
        if (specifications.length > 0) {
          await tx.productSpecification.createMany({
            data: specifications.map((s, order) => ({ ...s, productId: id, order })),
          });
        }
      }

      // بروزرسانی موجودی/اختلاف قیمت ترکیب‌های موجود
      // عدم وجود یعنی عدم موجودی: اگه موجودی صفر باشه، به‌جای آپدیت، حذف رو امتحان می‌کنیم
      if (variantUpdates) {
        for (const v of variantUpdates) {
          if (v.stock <= 0) {
            try {
              await tx.productVariant.delete({ where: { id: v.id } });
            } catch {
              // اگه توی سفارش قبلی استفاده شده، حذف نمی‌شه؛ فقط موجودی صفر ثبت می‌شه
              await tx.productVariant.update({
                where: { id: v.id },
                data: { stock: 0, priceDiff: v.priceDiff },
              });
              skippedDeletes.push(v.id);
            }
          } else {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                stock: v.stock,
                priceDiff: v.priceDiff,
                measurements: v.measurements.length > 0 ? JSON.stringify(v.measurements) : null,
              },
            });
            restockedVariantIds.push(v.id);
          }
        }
      }

      // حذف ترکیب‌هایی که دیگه لازم نیستن — اگه توی سفارش قبلی استفاده شده باشن، رد می‌شن (نه خطا)
      if (variantDeleteIds) {
        for (const variantId of variantDeleteIds) {
          try {
            await tx.productVariant.delete({ where: { id: variantId } });
          } catch {
            skippedDeletes.push(variantId);
          }
        }
      }

      // افزودن ترکیب‌های جدید -- ترکیب‌های صفر-موجودی اصلاً ذخیره نمی‌شن
      const newVariantsToCreate = (newVariants ?? []).filter((v) => v.stock > 0);
      if (newVariantsToCreate.length > 0) {
        const attributeIds = Array.from(
          new Set(newVariantsToCreate.flatMap((v) => v.values.map((val) => val.attributeId)))
        );
        // createMany({skipDuplicates:true}) روی SQLite پشتیبانی نمی‌شه، پس تک‌تک upsert می‌کنیم
        for (const attributeId of attributeIds) {
          await tx.productAttribute.upsert({
            where: { productId_attributeId: { productId: id, attributeId } },
            create: { productId: id, attributeId },
            update: {},
          });
        }

        for (const variant of newVariantsToCreate) {
          const created = await tx.productVariant.create({
            data: {
              productId: id,
              sku: variant.sku,
              stock: variant.stock,
              priceDiff: variant.priceDiff,
              values: {
                create: variant.values.map((v) => ({ attribute: v.attribute, value: v.value })),
              },
            },
          });
          restockedVariantIds.push(created.id);
        }
      }

      return updated;
    });

    // اعلان «موجود شد خبرم کن» -- جدا از تراکنش اصلی، چون اگه اینجا خطا بده نباید ذخیره‌ی محصول رو بی‌اثر کنه
    if (restockedVariantIds.length > 0) {
      notifyStockSubscribers(id, restockedVariantIds).catch((e) =>
        console.error("خطا در اطلاع‌رسانی موجودی:", e)
      );
    }

    return NextResponse.json({
      ...product,
      ...(skippedDeletes.length > 0
        ? {
            note: `${skippedDeletes.length} ترکیب چون در سفارش قبلی استفاده شده، حذف نشد.`,
          }
        : {}),
    });
  } catch (err) {
    console.error(err);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | string | undefined) ?? "";
      const targetStr = Array.isArray(target) ? target.join(",") : String(target);
      if (targetStr.includes("sku")) {
        return NextResponse.json(
          { error: "SKU یکی از ترکیب‌های جدید تکراری است" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `مقدار تکراری در فیلد: ${targetStr || "نامشخص"}` },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "خطا در ذخیره تغییرات" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    // اگه محصول توی سفارش‌های قبلی استفاده شده، حذف کامل امکان‌پذیر نیست؛
    // به جاش غیرفعالش می‌کنیم تا از صفحات عمومی حذف بشه ولی تاریخچه سفارش سالم بمونه
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({
      success: true,
      note: "این محصول در سفارش‌های قبلی استفاده شده، به‌جای حذف کامل غیرفعال شد.",
    });
  }
}
