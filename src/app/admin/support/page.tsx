import { AdminSupportPanel } from "@/components/AdminSupportPanel";

export default function AdminSupportPage() {
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