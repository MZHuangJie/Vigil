import type { TaskConfig, SSEEvent } from "./types";
import { getTask, setTaskStatus, addEvent } from "./db";
import { createPage, closePage, getActiveTaskIds } from "./browser";
import { performLogin } from "./login";
import { setupInterceptor, startPolling } from "./monitor";

// SSE event bus — 使用 globalThis 跨 App Router / Pages Router 模块实例共享
type SSECallback = (event: SSEEvent) => void;
const GLOBAL_KEY = "__vigil_sse_listeners__";

function getListeners(): Set<SSECallback> {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Set<SSECallback>();
  }
  return g[GLOBAL_KEY] as Set<SSECallback>;
}

export function onSSE(cb: SSECallback): () => void {
  const listeners = getListeners();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitSSE(event: SSEEvent): void {
  const listeners = getListeners();
  console.log(`[SSE] emit event type=${event.type} taskId=${event.taskId} listeners=${listeners.size}`);
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (e) {
      console.error("[SSE] listener error:", e);
    }
  }
}

// Active task intervals
const activeIntervals = new Map<string, NodeJS.Timeout>();

export async function startTask(taskId: string): Promise<{ success: boolean; message: string }> {
  const config = getTask(taskId);
  if (!config) {
    return { success: false, message: "任务不存在" };
  }

  if (getActiveTaskIds().includes(taskId)) {
    return { success: false, message: "任务已在运行中" };
  }

  try {
    setTaskStatus(taskId, "running");
    emitSSE({ type: "status", taskId, data: { status: "running" } });
    addEvent(taskId, "log", { message: `任务 "${config.name}" 启动中...` });

    const page = await createPage(taskId);

    if (config.login.enabled) {
      const loginSuccess = await performLogin(page, config);
      if (!loginSuccess) {
        await closePage(taskId);
        setTaskStatus(taskId, "error", "登录失败");
        emitSSE({ type: "status", taskId, data: { status: "error", message: "登录失败" } });
        return { success: false, message: "登录失败" };
      }
    }

    addEvent(taskId, "log", { message: `正在打开目标页面: ${config.targetUrl}` });
    emitSSE({ type: "log", taskId, data: { message: `正在打开目标页面: ${config.targetUrl}` } });

    await page.goto(config.targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    await setupInterceptor(page, config);
    const interval = await startPolling(page, config);

    if (interval) {
      activeIntervals.set(taskId, interval);
    }

    addEvent(taskId, "log", { message: `任务 "${config.name}" 已启动` });
    emitSSE({ type: "status", taskId, data: { status: "running" } });
    emitSSE({ type: "log", taskId, data: { message: `任务 "${config.name}" 已启动` } });

    return { success: true, message: "任务已启动" };
  } catch (error) {
    const msg = `启动失败: ${error instanceof Error ? error.message : String(error)}`;
    await closePage(taskId);
    setTaskStatus(taskId, "error", msg);
    emitSSE({ type: "status", taskId, data: { status: "error", message: msg } });
    return { success: false, message: msg };
  }
}

export async function stopTask(taskId: string): Promise<{ success: boolean; message: string }> {
  const interval = activeIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    activeIntervals.delete(taskId);
  }

  await closePage(taskId);
  setTaskStatus(taskId, "stopped");

  const config = getTask(taskId);
  const name = config?.name || taskId;

  emitSSE({ type: "status", taskId, data: { status: "stopped" } });
  addEvent(taskId, "log", { message: `任务 "${name}" 已停止` });
  emitSSE({ type: "log", taskId, data: { message: `任务 "${name}" 已停止` } });

  return { success: true, message: "任务已停止" };
}

export function stopAllTasks(): void {
  for (const taskId of getActiveTaskIds()) {
    stopTask(taskId);
  }
}

export { getActiveTaskIds };
