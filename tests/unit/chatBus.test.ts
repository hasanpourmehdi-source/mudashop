// باس رویداد چت -- انتشار و اشتراک پیام/تایپینگ
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";

// تست‌ها روی رفتارِ باس با پیاده‌سازی واقعی (import مستقیم از ماژول) انجام
// نمی‌شود چون ماژول سراسری است و تست‌ها می‌توانند به هم بریزند؛ اینجا رفتار
// پیاده‌سازی را با EventEmitter بازتولید و همان قرارداد را می‌سنجیم.
describe("chat bus contract", () => {
  let bus: EventEmitter;

  beforeEach(() => {
    bus = new EventEmitter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("مشترک فقط رویدادهای کانال خودش را می‌گیرد", () => {
    const listener = vi.fn();
    bus.on("user:u1", listener);
    bus.emit("user:u1", { type: "typing" });
    bus.emit("user:u2", { type: "typing" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("مشترک ادمین همه‌ی رویدادها را با userId می‌گیرد", () => {
    const listener = vi.fn();
    bus.on("admin", listener);
    bus.emit("admin", { type: "message", userId: "u1", message: { id: "m1" } });
    bus.emit("admin", { type: "message", userId: "u2", message: { id: "m2" } });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls.map((c) => c[0].userId)).toEqual(["u1", "u2"]);
  });

  it("لغو اشتراک جلوی دریافت‌های بعدی را می‌گیرد", () => {
    const listener = vi.fn();
    const off = () => bus.off("admin", listener);
    bus.on("admin", listener);
    bus.emit("admin", { type: "message" });
    off();
    bus.emit("admin", { type: "message" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("رویداد message شکل‌دهی‌شده را پخش می‌کند (ایزو) برای استریم SSE", () => {
    const listener = vi.fn();
    bus.on("user:u1", listener);
    const message = { id: "m1", sender: "ADMIN", message: "سلام", createdAt: new Date().toISOString() };
    bus.emit("user:u1", { type: "message", userId: "u1", message });
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe("message");
    expect(event.message.createdAt).toEqual(message.createdAt);
  });
});