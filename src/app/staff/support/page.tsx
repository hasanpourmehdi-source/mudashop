import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/requireAdmin";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";

// همون کامپوننتِ پنل پشتیبانیِ ادمین -- خودش هیچ چکِ دسترسی‌ای نمی‌کند (فقط با
// /api/admin/support/* حرف می‌زند که خودشان requireAdmin("SUPPORT") دارند)،
// پس استفاده‌ی دوباره‌اش اینجا کاملاً امن است
export default async function StaffSupportPage() {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) redirect("/staff");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">چت پشتیبانی</h1>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          گفتگوهای سراسری مشتریان با پشتیبانی. پیام‌های جدید با بج قرمز مشخص شده‌اند.
        </p>
      </div>
      <AdminSupportPanel />
    </div>
  );
}
