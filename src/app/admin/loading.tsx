import { Spinner } from "@/components/Spinner";

export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-muted)] text-sm">
      <Spinner className="w-5 h-5" />
      در حال بارگذاری...
    </div>
  );
}
