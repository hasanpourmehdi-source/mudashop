import { fetchAdminReports } from "@/lib/adminReports";

function toman(n: number): string {
  return `${n.toLocaleString("fa-IR")} تومان`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border cut-line rounded-lg p-4 bg-white">
      <p className="text-xs text-[var(--color-muted)] mb-1">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ label, value, max, formatted }: { label: string; value: number; max: number; formatted: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-4 bg-[var(--color-linen-dim)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-wine)] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-28 shrink-0 text-left font-medium" dir="ltr">
        {formatted}
      </span>
    </div>
  );
}

export default async function AdminReportsPage() {
  const r = await fetchAdminReports();

  const maxSales = Math.max(1, ...r.salesOverTime.map((d) => d.value));
  const maxCustomers = Math.max(1, ...r.newCustomersOverTime.map((d) => d.count));
  const maxProductQty = Math.max(1, ...r.topProducts.map((p) => p.quantity));
  const maxCategoryRevenue = Math.max(1, ...r.revenueByCategory.map((c) => c.revenue));
  const maxBrandRevenue = Math.max(1, ...r.revenueByBrand.map((b) => b.revenue));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">گزارشات</h1>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatTile label="جمع فروش (سفارش‌های پرداخت‌شده)" value={toman(r.totalRevenue)} />
        <StatTile label="تعداد کل سفارش‌ها" value={r.totalOrders.toLocaleString("fa-IR")} />
        <StatTile label="سفارش‌های پرداخت‌شده" value={r.paidOrders.toLocaleString("fa-IR")} />
        <StatTile label="میانگین ارزش سفارش" value={toman(r.avgOrderValue)} />
        <StatTile
          label="نرخ لغو"
          value={`${(r.cancellationRate * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`}
        />
        <StatTile
          label="نرخ مرجوعی (از تحویل‌شده‌ها)"
          value={`${(r.returnRate * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`}
        />
        <StatTile label="مجموع استفاده از کیف پول" value={toman(r.walletUsageTotal)} />
        <StatTile label="تعداد کل واحد فروخته‌شده" value={r.totalUnitsSold.toLocaleString("fa-IR")} />
        <StatTile label="مشتریان یکتا" value={r.distinctCustomers.toLocaleString("fa-IR")} />
        <StatTile label="سفارش فقط-مزون" value={r.mazonOnlyOrders.toLocaleString("fa-IR")} />
        <StatTile label="سفارش حاوی کالای خارجی" value={r.externalOrders.toLocaleString("fa-IR")} />
      </section>

      <section className="border cut-line rounded-lg p-4 bg-white">
        <h2 className="font-bold text-sm mb-3">فروش ۳۰ روز اخیر</h2>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {r.salesOverTime.map((d) => (
            <Bar
              key={d.date}
              label={new Date(d.date).toLocaleDateString("fa-IR")}
              value={d.value}
              max={maxSales}
              formatted={`${d.value.toLocaleString("fa-IR")} (${d.count.toLocaleString("fa-IR")} سفارش)`}
            />
          ))}
        </div>
      </section>

      <section className="border cut-line rounded-lg p-4 bg-white">
        <h2 className="font-bold text-sm mb-3">مشتریان جدید ۳۰ روز اخیر</h2>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {r.newCustomersOverTime.map((d) => (
            <Bar
              key={d.date}
              label={new Date(d.date).toLocaleDateString("fa-IR")}
              value={d.count}
              max={maxCustomers}
              formatted={`${d.count.toLocaleString("fa-IR")} نفر`}
            />
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="border cut-line rounded-lg p-4 bg-white">
          <h2 className="font-bold text-sm mb-3">پرفروش‌ترین محصولات (بر اساس تعداد)</h2>
          {r.topProducts.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">داده‌ای موجود نیست.</p>
          ) : (
            <div className="space-y-1.5">
              {r.topProducts.map((p, i) => (
                <Bar
                  key={i}
                  label={p.title}
                  value={p.quantity}
                  max={maxProductQty}
                  formatted={`${p.quantity.toLocaleString("fa-IR")} عدد`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border cut-line rounded-lg p-4 bg-white">
          <h2 className="font-bold text-sm mb-3">کدهای تخفیف پراستفاده</h2>
          {r.couponUsage.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">هیچ کد تخفیفی استفاده نشده.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-muted)] text-right">
                  <th className="pb-2">کد</th>
                  <th className="pb-2">تعداد استفاده</th>
                  <th className="pb-2">جمع تخفیف</th>
                </tr>
              </thead>
              <tbody>
                {r.couponUsage.map((c) => (
                  <tr key={c.code} className="border-t cut-line">
                    <td className="py-1.5 font-bold" dir="ltr">
                      {c.code}
                    </td>
                    <td className="py-1.5">{c.uses.toLocaleString("fa-IR")}</td>
                    <td className="py-1.5">{toman(c.totalDiscount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="border cut-line rounded-lg p-4 bg-white">
          <h2 className="font-bold text-sm mb-3">فروش به تفکیک دسته‌بندی (مزون)</h2>
          {r.revenueByCategory.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">داده‌ای موجود نیست.</p>
          ) : (
            <div className="space-y-1.5">
              {r.revenueByCategory.map((c) => (
                <Bar key={c.name} label={c.name} value={c.revenue} max={maxCategoryRevenue} formatted={toman(c.revenue)} />
              ))}
            </div>
          )}
        </div>

        <div className="border cut-line rounded-lg p-4 bg-white">
          <h2 className="font-bold text-sm mb-3">فروش به تفکیک برند (مزون)</h2>
          {r.revenueByBrand.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">داده‌ای موجود نیست.</p>
          ) : (
            <div className="space-y-1.5">
              {r.revenueByBrand.map((b) => (
                <Bar key={b.name} label={b.name} value={b.revenue} max={maxBrandRevenue} formatted={toman(b.revenue)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border cut-line rounded-lg p-4 bg-white">
        <h2 className="font-bold text-sm mb-3">سفارش‌ها به تفکیک وضعیت</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {r.ordersByStatus.map((s) => (
            <div key={s.status} className="flex items-center justify-between border cut-line rounded-lg px-3 py-2 text-sm">
              <span className="text-[var(--color-muted)]">{s.label}</span>
              <span className="font-bold">{s.count.toLocaleString("fa-IR")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
