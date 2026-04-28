import { NextRequest, NextResponse } from "next/server";
import { getStatSummary, getStatRecords } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const windowSeconds = parseInt(searchParams.get("windowSeconds") || "3600", 10);

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const summary = getStatSummary(taskId);
    const records = getStatRecords(taskId, windowSeconds);

    return NextResponse.json({ summary, records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
