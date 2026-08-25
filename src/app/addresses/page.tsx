import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AddressBook } from "@/components/AddressBook";

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-xl font-bold">آدرس‌های من</h1>
      <AddressBook />
    </div>
  );
}
