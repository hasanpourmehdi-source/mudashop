"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full text-center text-sm font-medium text-red-600 border cut-line rounded-lg py-3 bg-white hover:bg-red-50 transition-colors"
    >
      خروج از حساب
    </button>
  );
}
