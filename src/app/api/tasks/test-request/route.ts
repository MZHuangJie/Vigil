import { NextRequest, NextResponse } from "next/server";
import { getPage, getActiveTaskIds } from "@/lib/browser";
import { getTaskStatus, getTask } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { urlPattern, requestMethod, requestBody, requestParams, requestHeaders, taskId } = body as {
      urlPattern?: string;
      requestMethod?: string;
      requestBody?: string;
      requestParams?: Record<string, string>;
      requestHeaders?: Record<string, string>;
      taskId?: string;
    };

    // If only taskId is provided, read config from DB
    if (taskId && !urlPattern) {
      const config = getTask(taskId);
      if (!config) {
        return NextResponse.json({ success: false, error: "任务不存在" }, { status: 404 });
      }
      urlPattern = config.monitor.urlPattern;
      requestMethod = config.monitor.requestMethod;
      requestBody = config.monitor.requestBody;
      requestParams = config.monitor.requestParams;
      requestHeaders = config.monitor.requestHeaders;
    }

    if (!urlPattern) {
      return NextResponse.json({ success: false, error: "缺少请求 URL" }, { status: 400 });
    }

    const params = requestParams || {};
    const paramStr = new URLSearchParams(params).toString();
    const fullUrl = paramStr
      ? `${urlPattern}${urlPattern.includes("?") ? "&" : "?"}${paramStr}`
      : urlPattern;

    const startTime = Date.now();
    const customHeaders: Record<string, string> = requestHeaders || {};
    const page = taskId ? getPage(taskId) : undefined;

    let data: unknown;
    let status: number;
    let statusText: string;

    if (page) {
      const result = await page.evaluate(
        async (opts: { url: string; method: string; body?: string; headers: Record<string, string> }) => {
          const res = await fetch(opts.url, {
            method: opts.method || "GET",
            headers: opts.headers,
            body: opts.method !== "GET" && opts.body ? opts.body : undefined,
          });
          const ct = res.headers.get("content-type") || "";
          let respData: unknown;
          if (ct.includes("json")) {
            respData = await res.json();
          } else {
            respData = await res.text();
          }
          return { status: res.status, statusText: res.statusText, ok: res.ok, data: respData };
        },
        { url: fullUrl, method: requestMethod || "GET", body: requestBody, headers: customHeaders }
      );

      status = result.status;
      statusText = result.statusText;
      data = result.data;
    } else {
      const res = await fetch(fullUrl, {
        method: requestMethod || "GET",
        headers: customHeaders,
        body: requestMethod !== "GET" && requestBody ? requestBody : undefined,
      });

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      status = res.status;
      statusText = res.statusText;
    }

    const timeTaken = Date.now() - startTime;

    const diag: Record<string, unknown> = {};
    if (taskId) {
      diag.taskExists = !!getTask(taskId);
      diag.taskDbStatus = getTaskStatus(taskId);
      diag.activePageIds = getActiveTaskIds();
      diag.hasActivePage = getActiveTaskIds().includes(taskId);
    }

    return NextResponse.json({
      success: status >= 200 && status < 300,
      status,
      statusText,
      url: fullUrl,
      timeTakenMs: timeTaken,
      body: data,
      viaBrowser: !!page,
      ...(Object.keys(diag).length > 0 ? { _diag: diag } : {}),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "请求失败",
    });
  }
}
