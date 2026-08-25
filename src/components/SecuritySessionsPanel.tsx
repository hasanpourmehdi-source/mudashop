"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";

type SessionRow = {
  id: string;
  deviceLabel: string;
  ip: string | null;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

function faDate(iso: string): string {
  return new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}

export function SecuritySessionsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/security/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری دستگاه‌ها");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeOne(id: string) {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/security/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در حذف دستگاه");
      setBusy(null);
      return;
    }
    setBusy(null);
    await load();
  }

  async function revokeOthers() {
    setBusy("others");
    setError("");
    const res = await fetch("/api/security/revoke-all", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا");
      setBusy(null);
      return;
    }
    setBusy(null);
    await load();
  }

  async function logoutEverywhere() {
    if (!window.confirm("از همه‌ی دستگاه‌ها خارج می‌شوی؟")) return;
    setBusy("everywhere");
    setError("");
    await fetch("/api/security/logout-everywhere", { method: "POST" }).catch(() => {});
    await signOut({ redirect: false });
    window.location.href = "/auth/login";
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز دستگاهی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const isRevoked = Boolean(s.revokedAt);
            return (
              <li
                key={s.id}
                className={`border cut-line rounded-lg p-3 flex items-center justify-between gap-2 bg-white ${
                  isRevoked ? "opacity-50" : ""
                }`}
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {s.deviceLabel}
                    {s.isCurrent && (
                      <span className="mr-2 text-[10px] text-[var(--color-wine)] border cut-line px-2 py-0.5 rounded-full">
                        این دستگاه
                      </span>
                    )}
                    {isRevoked && (
                      <span className="mr-2 text-[10px] text-[var(--color-muted)] border cut-line px-2 py-0.5 rounded-full">
                        حذف شده
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    آخرین فعالیت: {faDate(s.lastSeenAt)} {s.ip ? ` • IP: ${s.ip}` : ""}
                  </p>
                </div>
                {!s.isCurrent && !isRevoked && (
                  <button
                    onClick={() => revokeOne(s.id)}
                    disabled={busy === s.id}
                    className="text-xs border cut-line rounded-full px-3 py-1.5 text-[var(--color-wine)] disabled:opacity-50 shrink-0"
                  >
                    {busy === s.id ? "..." : "خروج از این دستگاه"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={revokeOthers}
          disabled={busy !== null}
          className="border cut-line rounded-full px-4 py-2 text-sm font-medium bg-white disabled:opacity-50"
        >
          {busy === "others" ? "..." : "خروج از همه‌ی دستگاه‌های دیگر"}
        </button>
        <button
          onClick={logoutEverywhere}
          disabled={busy !== null}
          className="bg-red-700 text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "everywhere" ? "..." : "خروج از همه‌جا"}
        </button>
      </div>
    </div>
  );
}