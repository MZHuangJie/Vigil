"use client";

import { useState, useEffect, useCallback } from "react";
import type { StatRecord, TaskConfig } from "@/lib/types";
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
  const [tasks, setTasks] = useState<TaskConfig[]>([]);
  const [taskId, setTaskId] = useState("");
  const [windowSeconds, setWindowSeconds] = useState(3600);
  const [summary, setSummary] = useState<StatSummary[]>([]);
  const [records, setRecords] = useState<StatRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => setTasks(data))
      .catch(() => {});
  }, []);

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
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">-- 选择任务 --</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
        <div className={styles.empty}>选择任务后点击查询</div>
      )}
    </div>
  );
}
