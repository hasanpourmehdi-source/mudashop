import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-[var(--color-muted)]">
      <Spinner className="w-8 h-8" />
      <p className="text-sm">در حال بارگذاری...</p>
    </div>
  );
}
