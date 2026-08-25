"use client";

import { useSession } from "next-auth/react";
import { getRecentlyViewedStore } from "@/store/recentlyViewed";

// مثل useCart: برای هر کاربر کلید مجزا، وگرنه "guest"
export function useRecentlyViewed() {
  const { data: session } = useSession();
  const userKey = session?.user?.id ?? "guest";
  const store = getRecentlyViewedStore(userKey);
  return store();
}