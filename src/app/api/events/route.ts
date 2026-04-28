import { NextRequest } from "next/server";
import { onSSE } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const encoder = new TextEncoder();
  let cleanup: () => void;

  const stream = new ReadableStream({
    start(controller) {
      cleanup = onSSE((event) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // client disconnected
        }
      });

      const ping = `data: ${JSON.stringify({ type: "ping" })}\n\n`;
      controller.enqueue(encoder.encode(ping));
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
