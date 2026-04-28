"use client";

import { useState, useCallback } from "react";
import type { StatRecord } from "@/lib/types";
import styles from "./StatChart.module.css";

interface StatSummary {
  field_name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export default function StatChart() {
  const [taskId, setTaskId] = useState("");
  const [windowSeconds, setWindowSeconds] = useState(3600);
  const [summary, setSummary] = useState<StatSummary[]>([]);
  const [records, setRecords] = useState<StatRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!taskId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?taskId=${encodeURIComponent(taskId)}&windowSeconds=${windowSeconds}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || []);
        setRecords(data.records || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [taskId, windowSeconds]);

  const maxValue = Math.max(...records.map((r) => r.value), 1);

  return (
    <div className={styles.chart}>
      <h2>统计图表</h2>
      <div className={styles.controls}>
        <input value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="输入任务 ID" style={{ width: 280 }} />
        <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))} placeholder="窗口(秒)" style={{ width: 80 }} />
        <button onClick={fetchStats} disabled={loading}>
          {loading ? "加载中..." : "查询"}
        </button>
      </div>

      {summary.length > 0 && (
        <>
          <div className={styles.summaryGrid}>
            {summary.map((s, i) => (
              <div key={i} className={styles.summaryCard}>
                <div className={styles.summaryLabel}>{s.field_name} (avg)</div>
                <div className={styles.summaryValue}>{s.avg.toFixed(2)}</div>
                <div className={styles.summaryLabel}>min: {s.min} / max: {s.max}</div>
              </div>
            ))}
          </div>
          {records.length > 0 && (
            <div className={styles.barChart}>
              {records.slice(-60).map((r, i) => (
                <div
                  key={i}
                  className={styles.bar}
                  style={{ height: `${(r.value / maxValue) * 100}%` }}
                  title={`${r.field_name}: ${r.value} at ${r.created_at}`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && summary.length === 0 && (
        <div className={styles.empty}>输入任务 ID 后点击查询</div>
      )}
    </div>
  );
}
