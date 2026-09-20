import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ارسالی مشتریان | مُداشاپ",
  description: "تصاویر ارسالی مشتریان مُداشاپ -- تجربه‌ی خرید واقعی مشتریان ما.",
};

export default async function CustomerShipmentsPage() {
  const items = await prisma.customerShipment.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-2">ارسالی مشتریان</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">گلچینی از تصاویر ارسالی مشتریان عزیز — با انتخاب ادمین.</p>

      {items.length === 0 ? (
        <p className="text-[var(--color-muted)] text-center py-12">هنوز ارسالی‌ای منتشر نشده است.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="border cut-line rounded-xl overflow-hidden bg-white">
              <img src={item.image} alt={item.caption ?? ""} className="w-full aspect-[4/3] object-cover" />
              {item.caption && <p className="text-sm p-3 leading-relaxed">{item.caption}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
