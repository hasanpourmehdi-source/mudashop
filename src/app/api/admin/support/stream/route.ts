import { requireAdmin } from "@/lib/requireAdmin";
import { subscribeAdmin, type ChatEvent } from "@/lib/chatBus";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function heartbeat(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.enqueue(encoder.encode(": ping\n\n"));
  } catch {
    // اتصال بسته شده
  }
}

function send(controller: ReadableStreamDefaultController<Uint8Array>, event: ChatEvent) {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  } catch {
    // اتصال بسته شده
  }
}

// استریم زنده‌ی رویدادهای همه‌ی گفتگوهای پشتیبانی برای ادمین (SSE).
// رویداد message شامل userId گفتگو است؛ ادمین فقط گفتگوی فعال را نمایش می‌دهد
// و برای بقیه بجِ نخوانده را زیاد می‌کند.
export async function GET(req: Request) {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return new Response("Forbidden", { status: 403 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const hb = setInterval(() => heartbeat(controller), 25_000);
      const unsubscribe = subscribeAdmin((event) => send(controller, event));
      const cleanup = () => {
        clearInterval(hb);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // قبلاً بسته شده
        }
      };
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}