"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getCartStore } from "@/store/cart";

export function CartUserSync() {
  const { data: session, status } = useSession();
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (mergedFor.current === session.user.id) return;

    const guestStore = getCartStore("guest");
    const userStore = getCartStore(session.user.id);

    const guestItems = guestStore.getState().items;
    if (guestItems.length > 0) {
      guestItems.forEach((item) => userStore.getState().addItem(item));
      guestStore.getState().clear();
    }

    mergedFor.current = session.user.id;
  }, [status, session?.user?.id]);

  return null;
}
