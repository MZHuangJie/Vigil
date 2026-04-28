import type { NextApiRequest, NextApiResponse } from "next";
import { onSSE } from "@/lib/scheduler";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // 禁用 Nagle 确保小块数据立即发送
  if (res.socket) {
    res.socket.setNoDelay(true);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (data: string) => {
    res.write(data);
    res.flushHeaders();
  };

  const cleanup = onSSE((event) => {
    try {
      send(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      cleanup();
    }
  });

  send(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  send(`data: ${JSON.stringify({ type: "log", taskId: "", data: { message: "事件通道已就绪" } })}\n\n`);

  req.on("close", () => {
    cleanup();
  });
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
