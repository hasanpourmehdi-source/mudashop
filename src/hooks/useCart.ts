"use client";

import { useSession } from "next-auth/react";
import { getCartStore } from "@/store/cart";

// اگر کاربر لاگین باشه از کلید user.id استفاده می‌کنیم، وگرنه "guest"
// این باعث می‌شه سبد خرید هر کاربر کاملاً مجزا باشه (per-user isolation)
export function useCart() {
  const { data: session } = useSession();
  const userKey = session?.user?.id ?? "guest";
  const store = getCartStore(userKey);
  return store();
}
