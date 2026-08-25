"use client";

import { useSession } from "next-auth/react";
import { getCompareStore } from "@/store/compare";

// مثل useCart/useRecentlyViewed: برای هر کاربر کلید مجزا، وگرنه "guest"
export function useCompare() {
  const { data: session } = useSession();
  const userKey = session?.user?.id ?? "guest";
  const store = getCompareStore(userKey);
  return store();
}