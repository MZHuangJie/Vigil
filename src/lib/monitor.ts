import type { Page, HTTPResponse } from "puppeteer";
import type { TaskConfig, ExtractedData } from "./types";
import { extractFields } from "./extractor";
import { processExtractedData } from "./stats";
import { emitSSE } from "./scheduler";
import { addEvent } from "./db";

export async function setupInterceptor(page: Page, config: TaskConfig): Promise<void> {
  if (config.monitor.mode === "intercept") {
    const urlPattern = new RegExp(config.monitor.urlPattern);
    const throttleMs = config.monitor.throttleMs || 0;
    const lastFired = new Map<string, number>();

    page.on("response", async (response: HTTPResponse) => {
      try {
        const url = response.url();
        if (!urlPattern.test(url)) return;

        if (throttleMs > 0) {
          const now = Date.now();
          const last = lastFired.get(url) || 0;
          if (now - last < throttleMs) return;
          lastFired.set(url, now);
        }

        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json") && !contentType.includes("text")) return;

        const body = await response.json().catch(() => response.text());
        const data: ExtractedData = {
          taskId: config.id,
          timestamp: new Date().toISOString(),
          fields: extractFields(body, config.extraction.fields),
          raw: body,
        };

        const fieldsSummary = Object.entries(data.fields)
          .filter(([k]) => k !== "_debug")
          .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join(", ");
        addEvent(config.id, "stat", { url, fields: fieldsSummary });
        emitSSE({ type: "stat", taskId: config.id, data: `提取: ${fieldsSummary}` });

        processExtractedData(config, data);
      } catch {
        // silently ignore non-JSON responses or parse errors
      }
    });
  }
}

export async function startPolling(page: Page, config: TaskConfig): Promise<NodeJS.Timeout | null> {
  if (config.monitor.mode !== "poll" || !config.monitor.pollIntervalMs) {
    return null;
  }

  const baseUrl = config.monitor.urlPattern;
  const params = config.monitor.requestParams || {};
  const paramStr = new URLSearchParams(params).toString();
  const fullUrl = paramStr ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${paramStr}` : baseUrl;

  const interval = setInterval(async () => {
    try {
      const result = await page.evaluate(
        (opts: { url: string; method: string; body: string; headers: Record<string, string> }) => {
          return fetch(opts.url, {
            method: opts.method || "GET",
            headers: opts.headers,
            body: opts.method !== "GET" ? opts.body : undefined,
          }).then((res) => res.json());
        },
        {
          url: fullUrl,
          method: config.monitor.requestMethod || "GET",
          body: config.monitor.requestBody || "",
          headers: config.monitor.requestHeaders || {},
        }
      );

      const data: ExtractedData = {
        taskId: config.id,
        timestamp: new Date().toISOString(),
        fields: extractFields(result, config.extraction.fields),
        raw: result,
      };

      const fieldsSummary = Object.entries(data.fields)
        .filter(([k]) => k !== "_debug")
        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(", ");
      addEvent(config.id, "stat", { url: fullUrl, fields: fieldsSummary });
      emitSSE({ type: "stat", taskId: config.id, data: `提取: ${fieldsSummary}` });

      processExtractedData(config, data);
    } catch (error) {
      addEvent(config.id, "log", {
        message: `轮询请求失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }, config.monitor.pollIntervalMs);

  return interval;
}
