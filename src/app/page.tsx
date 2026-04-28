"use client";

import { useState, useCallback, useEffect } from "react";
import type { TaskConfig, SSEEvent } from "@/lib/types";
import TaskDashboard from "@/components/TaskDashboard";
import TaskConfigForm from "@/components/TaskConfig";
import TaskLog from "@/components/TaskLog";
import AlertPanel from "@/components/AlertPanel";
import StatChart from "@/components/StatChart";
import styles from "./page.module.css";

function DesktopNotifier() {
  useEffect(() => {
    if (typeof Notification === "undefined") return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const es = new EventSource("/api/events");

    es.onmessage = (event) => {
      try {
        const sse: SSEEvent = JSON.parse(event.data);
        if (sse.type !== "alert" && sse.type !== "status") return;

        const data = sse.data as { message?: string; status?: string; action?: string };
        const body = data.message || data.status || "";

        if (sse.type === "status" && data.status === "stopped") {
          new Notification(`Vigil - 任务已停止`, {
            body: `任务 ${sse.taskId?.slice(0, 8)} 已停止`,
            icon: undefined,
          });
        }

        if (sse.type === "alert" && body) {
          new Notification(`Vigil - 告警`, {
            body: body.length > 120 ? body.slice(0, 120) + "..." : body,
            icon: undefined,
          });
        }
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, []);

  return null;
}

export default function Home() {
  const [editingTask, setEditingTask] = useState<TaskConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [activeTab, setActiveTab] = useState<"log" | "alerts" | "stats">("log");

  const handleNewTask = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  const handleSelectTask = useCallback((task: TaskConfig) => {
    setEditingTask(task);
    setShowForm(true);
  }, []);

  const handleSaved = () => {
    setShowForm(false);
    setEditingTask(null);
    setRefreshFlag((f) => f + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  return (
    <>
      <DesktopNotifier />

      <header className={styles.header}>
        <h1>
          <span>V</span>igil
        </h1>
        <div className={styles.headerRight}>
          <span className={styles.version}>v0.1.0</span>
          <button className={styles.newTaskBtn} onClick={handleNewTask}>
            + 新建任务
          </button>
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.leftPanel}>
          <TaskDashboard onSelect={handleSelectTask} refreshFlag={refreshFlag} />

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "log" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("log")}
            >
              实时日志
            </button>
            <button
              className={`${styles.tab} ${activeTab === "alerts" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("alerts")}
            >
              告警面板
            </button>
            <button
              className={`${styles.tab} ${activeTab === "stats" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("stats")}
            >
              统计图表
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === "log" && <TaskLog />}
            {activeTab === "alerts" && <AlertPanel />}
            {activeTab === "stats" && <StatChart />}
          </div>
        </div>

        <div className={styles.rightPanel}>
          {showForm ? (
            <TaskConfigForm
              task={editingTask}
              onSaved={handleSaved}
              onCancel={handleCancel}
            />
          ) : (
            <div className={styles.rightEmpty}>
              <p>选择一个任务进行编辑</p>
              <p>或</p>
              <button className={styles.newTaskBtn} onClick={handleNewTask}>
                + 创建新任务
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
