"use client";

import { useState, useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/types";
import styles from "./TaskLog.module.css";

interface LogEntry {
  time: string;
  type: string;
  taskId: string;
  message: string;
}

export default function TaskLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onopen = () => {
      setConnected(true);
      setLogs((prev) => [
        ...prev.slice(-499),
        { time: new Date().toLocaleTimeString(), type: "log", taskId: "", message: "SSE 已连接" },
      ]);
    };

    es.onerror = () => {
      setConnected(false);
    };

    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        if (sseEvent.type === "ping") return;

        const entry: LogEntry = {
          time: new Date().toLocaleTimeString(),
          type: sseEvent.type,
          taskId: sseEvent.taskId || "",
          message:
            typeof sseEvent.data === "string"
              ? sseEvent.data
              : JSON.stringify(sseEvent.data),
        };

        setLogs((prev) => [...prev.slice(-499), entry]);
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const lineClass = (type: string) => {
    switch (type) {
      case "stat": return styles.statLine;
      case "alert": return styles.alertLine;
      default: return styles.logLine;
    }
  };

  return (
    <div className={styles.log}>
      <h2>实时日志</h2>
      <div className={styles.logLines} ref={containerRef}>
        {logs.length === 0 ? (
          <div className={styles.empty}>
            {connected ? "等待事件..." : "SSE 未连接，请检查服务是否正常运行"}
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`${styles.logLine} ${lineClass(log.type)}`}>
              <span className={styles.logTime}>{log.time}</span>
              [{log.taskId ? log.taskId.slice(0, 8) : "----"}] {log.message}
            </div>
          ))
        )}
      </div>
      <button className={styles.clearBtn} onClick={() => setLogs([])}>
        清空
      </button>
    </div>
  );
}
