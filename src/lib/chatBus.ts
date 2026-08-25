import { EventEmitter } from "events";

// ================= باس رویداد چت (پیام‌رسانی زنده) =================
// یک صف/باس درون‌حافظه (In-Process) که پیام‌های جدید و «در حال نوشتن» را بین
// کلاینت‌ها پخش می‌کند. چون پروژه cron/ردیس ندارد، این ساده‌ترین راه برای
// لحظه‌ای‌کردن چت است و برای یک نمونه (single instance) درست کار می‌کند.
// کانال هر کاربر: "user:<id>" برای پیام‌های توی مکالمه‌ی خودش
// کانال ادمین: "admin" برای همه‌ی رویدادهای همه‌ی گفتگوها

export type ChatMessageDto = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  message: string;
  createdAt: string;
};

export type ChatEvent =
  | { type: "message"; userId: string; message: ChatMessageDto }
  | { type: "typing"; userId: string; sender: "CUSTOMER" | "ADMIN"; typing: boolean };

const bus = new EventEmitter();
bus.setMaxListeners(0); // هر اتصال SSE یک شنونده است

export function publishUserEvent(userId: string, event: ChatEvent) {
  bus.emit(`user:${userId}`, event);
}

export function publishAdminEvent(event: ChatEvent) {
  bus.emit("admin", event);
}

export function subscribeUser(userId: string, listener: (e: ChatEvent) => void): () => void {
  bus.on(`user:${userId}`, listener);
  return () => {
    bus.off(`user:${userId}`, listener);
  };
}

export function subscribeAdmin(listener: (e: ChatEvent) => void): () => void {
  bus.on("admin", listener);
  return () => {
    bus.off("admin", listener);
  };
}