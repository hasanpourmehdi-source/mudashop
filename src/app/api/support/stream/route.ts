import { auth } from "@/lib/auth";
import { subscribeUser, type ChatEvent } from "@/lib/chatBus";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function heartbeat(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.enqueue(encoder.encode(": ping\n\n"));
  } catch {
    // اتصال بسته شده -- نادیده بگیر
  }
}

function send(controller: ReadableStreamDefaultController<Uint8Array>, event: ChatEvent) {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  } catch {
    // اتصال بسته شده
  }
}

// استریم زنده‌ی رویدادهای مکالمه‌ی پشتیبانی برای مشتری (Server-Sent Events).
// کوکی سشن به‌صورت خودکار ارسال می‌شه (هم‌ریشه). رویدادها: "message" و "typing".
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const hb = setInterval(() => heartbeat(controller), 25_000);
      const unsubscribe = subscribeUser(userId, (event) => send(controller, event));
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
    cancel() {
      // اگر مصرف‌کننده سمت کلاینت ببندد (بدون abort درخواست)
      // شنونده از طریق abort رویدادِ پایین رفتن اتصال پاک می‌شود؛ اینجا هیچ کاری لازم نیست
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