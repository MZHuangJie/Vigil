import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask, deleteTask, setTaskStatus, getTaskStatus } from "@/lib/db";
import { startTask, stopTask } from "@/lib/scheduler";
import type { TaskConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = getTask(params.id);
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    return NextResponse.json({ ...task, status: getTaskStatus(params.id) || "stopped" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = getTask(params.id);
    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const body = await request.json();
    const config: TaskConfig = { ...existing, ...body, id: params.id };
    updateTask(params.id, config);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = getTask(params.id);
    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const status = getTaskStatus(params.id);
    if (status === "running") {
      await stopTask(params.id);
    }

    deleteTask(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
