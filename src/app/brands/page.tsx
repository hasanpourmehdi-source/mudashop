import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "برندها | مُداشاپ",
  description: "همه‌ی برندهای موجود در مُداشاپ -- از برندهای ایرانی تا بین‌المللی، با کالکشن اختصاصی هر برند.",
};

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  if (brands.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-12 text-center">
        <p className="text-[var(--color-muted)]">هنوز برندی ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-2">برندها</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">برند مورد علاقه‌ات را انتخاب کن و کالکشن اختصاصی‌اش را ببین.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/brands/${encodeURIComponent(b.name.toLowerCase().replace(/\s+/g, "-"))}`}
            className="border cut-line rounded-xl p-5 bg-white hover:shadow-md transition-shadow text-center font-bold hover:text-[var(--color-wine)]"
          >
            {b.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
