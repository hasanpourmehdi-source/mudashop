"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  status: "ACTIVE" | "BANNED";
  createdAt: string;
  _count: { orders: number };
};

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Record<string, string>>({});

  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  function load() {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateUser(id: string, data: Partial<Pick<User, "role" | "status">>) {
    setError((e) => ({ ...e, [id]: "" }));
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((e) => ({ ...e, [id]: body.error ?? "خطا در ذخیره تغییرات" }));
      return;
    }
    load();
  }

  async function handleResetPassword(id: string) {
    if (newPassword.trim().length < 6) {
      setError((e) => ({ ...e, [id]: "رمز جدید باید حداقل ۶ کاراکتر باشد" }));
      return;
    }
    setSavingPassword(true);
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setSavingPassword(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((e) => ({ ...e, [id]: body.error ?? "خطا در تغییر رمز" }));
      return;
    }
    setPasswordEditId(null);
    setNewPassword("");
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">کاربران ({users.length})</h1>
      <div className="space-y-3 max-w-2xl">
        {users.map((user) => {
          const isSelf = user.id === session?.user?.id;
          return (
            <div key={user.id} className="border cut-line rounded-lg p-4 bg-white text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{user.name ?? user.email}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      user.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.status === "ACTIVE" ? "فعال" : "غیرفعال"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-ochre)]/20 text-[var(--color-ochre)]">
                    {user.role === "ADMIN" ? "ادمین" : "مشتری"}
                  </span>
                </div>
              </div>
              <p className="text-[var(--color-muted)] text-xs mb-3">
                {user.email} · {user._count.orders} سفارش ·{" "}
                {new Date(user.createdAt).toLocaleDateString("fa-IR")}
              </p>

              {isSelf ? (
                <p className="text-xs text-[var(--color-muted)]">
                  این حساب شماست — نقش/وضعیت آن از این پنل قابل تغییر نیست.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.id, { role: e.target.value as User["role"] })}
                    className="border cut-line rounded-lg px-2 py-1 text-xs bg-white"
                  >
                    <option value="CUSTOMER">مشتری</option>
                    <option value="ADMIN">ادمین</option>
                  </select>
                  <button
                    onClick={() =>
                      updateUser(user.id, { status: user.status === "ACTIVE" ? "BANNED" : "ACTIVE" })
                    }
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      user.status === "ACTIVE"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {user.status === "ACTIVE" ? "غیرفعال کردن" : "فعال کردن"}
                  </button>
                  <button
                    onClick={() => {
                      setPasswordEditId(passwordEditId === user.id ? null : user.id);
                      setNewPassword("");
                    }}
                    className="text-xs text-[var(--color-wine)] hover:underline"
                  >
                    تغییر رمز
                  </button>
                </div>
              )}

              {passwordEditId === user.id && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t cut-line">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="رمز جدید (حداقل ۶ کاراکتر)"
                    className="flex-1 border cut-line rounded-lg px-2 py-1 text-xs bg-white"
                  />
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    disabled={savingPassword}
                    className="text-xs bg-[var(--color-wine)] text-white px-3 py-1 rounded-full disabled:opacity-50"
                  >
                    {savingPassword ? "..." : "ذخیره"}
                  </button>
                </div>
              )}

              {error[user.id] && <p className="text-xs text-red-600 mt-1">{error[user.id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
