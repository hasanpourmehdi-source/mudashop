import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SecuritySessionsPanel } from "@/components/SecuritySessionsPanel";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">امنیت و دستگاه‌ها</h1>
        <Link href="/profile" className="text-sm text-[var(--color-wine)]">
          بازگشت به پروفایل
        </Link>
      </div>

      <SecuritySessionsPanel />
    </div>
  );
}