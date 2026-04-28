"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskConfig, SSEEvent } from "@/lib/types";
import styles from "./TaskDashboard.module.css";

export interface TaskWithStatus extends TaskConfig {
  status: string;
  error_message?: string;
}

interface Props {
  onSelect: (task: TaskConfig) => void;
  refreshFlag: number;
}

export default function TaskDashboard({ onSelect, refreshFlag }: Props) {
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshFlag]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        if (sseEvent.type === "status") {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === sseEvent.taskId
                ? { ...t, status: (sseEvent.data as { status: string }).status || t.status }
                : t
            )
          );
        }
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, []);

  const handleStart = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/start`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "running" } : t)));
      } else {
        alert(data.error || "启动失败");
      }
    } catch {
      alert("启动失败");
    }
  };

  const handleStop = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/stop`, { method: "POST" });
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "stopped" } : t)));
      }
    } catch {
      alert("停止失败");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("确认删除此任务？")) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      alert("删除失败");
    }
  };

  const statusClass = (status: string) => {
    switch (status) {
      case "running": return styles.running;
      case "error": return styles.errorStatus;
      default: return styles.stopped;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "running": return "运行中";
      case "error": return "错误";
      default: return "已停止";
    }
  };

  if (loading) {
    return <div className={styles.dashboard}><div className={styles.empty}>加载中...</div></div>;
  }

  return (
    <div className={styles.dashboard}>
      <h2>任务列表 ({tasks.length})</h2>
      {tasks.length === 0 ? (
        <div className={styles.empty}>暂无任务，点击右侧新建</div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className={styles.taskItem}>
            <div className={styles.taskInfo}>
              <div className={styles.taskName}>
                <span className={`${styles.statusBadge} ${statusClass(task.status)}`}>
                  {statusLabel(task.status)}
                </span>
                {task.name}
              </div>
              <div className={styles.taskUrl}>{task.targetUrl}</div>
            </div>
            <div className={styles.taskActions}>
              {task.status === "running" ? (
                <button className={`${styles.btn} ${styles.stopBtn}`} onClick={() => handleStop(task.id)}>
                  停止
                </button>
              ) : (
                <button className={`${styles.btn} ${styles.startBtn}`} onClick={() => handleStart(task.id)}>
                  启动
                </button>
              )}
              <button className={`${styles.btn}`} onClick={() => onSelect(task)}>编辑</button>
              <button className={`${styles.btn} ${styles.deleteBtn}`} onClick={() => handleDelete(task.id)}>删除</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
