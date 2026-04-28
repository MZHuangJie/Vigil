import { NextRequest, NextResponse } from "next/server";
import { getAllTasks, createTask, getTaskStatus } from "@/lib/db";
import type { TaskConfig } from "@/lib/types";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = getAllTasks();
    const enriched = tasks.map((task) => ({
      ...task,
      status: getTaskStatus(task.id) || "stopped",
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = crypto.randomUUID();

    const config: TaskConfig = {
      id,
      name: body.name || "未命名任务",
      enabled: body.enabled !== false,
      targetUrl: body.targetUrl || "",
      login: body.login || {
        enabled: false,
        username: "",
        password: "",
        usernameSelector: "",
        passwordSelector: "",
        submitSelector: "",
      },
      monitor: body.monitor || {
        mode: "intercept",
        urlPattern: ".*",
      },
      extraction: body.extraction || { fields: [] },
      stats: body.stats || { windowSeconds: 60, groups: [] },
      actions: body.actions || [],
    };

    createTask(config);
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
