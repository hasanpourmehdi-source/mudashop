import Link from "next/link";
import type { PersonalCategory } from "@/lib/categories";

// «دسته‌بندی‌های ویژه‌ی شما» -- بر پایه‌ی ویشلیست و تاریخچه‌ی خرید واقعی کاربر
export function PersonalCategoriesShowcase({ categories }: { categories: PersonalCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <h2 className="text-xl font-bold mb-6">دسته‌بندی‌های ویژه‌ی شما</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?categories=${cat.slug}&sources=MAZON`}
            className="relative aspect-square rounded-2xl overflow-hidden group"
            style={{ background: cat.color }}
          >
            {cat.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cat.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-5xl">
                {cat.icon}
              </span>
            )}
            <span className="absolute inset-x-2 bottom-3 text-center text-white font-bold text-sm sm:text-base leading-tight drop-shadow">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
