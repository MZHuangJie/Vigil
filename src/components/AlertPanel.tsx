"use client";

import { useState, useEffect } from "react";
import type { SSEEvent } from "@/lib/types";
import styles from "./AlertPanel.module.css";

interface Alert {
  time: string;
  taskId: string;
  action?: string;
  message: string;
  level?: string;
}

export default function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        if (sseEvent.type !== "alert") return;

        const data = sseEvent.data as { action?: string; message?: string; level?: string };
        const entry: Alert = {
          time: new Date().toLocaleTimeString(),
          taskId: sseEvent.taskId || "",
          action: data.action,
          message: data.message || JSON.stringify(data),
          level: data.level,
        };

        setAlerts((prev) => [...prev.slice(-199), entry]);
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, []);

  return (
    <div className={styles.panel}>
      <h2>告警面板 ({alerts.length})</h2>
      <div className={styles.alertList}>
        {alerts.length === 0 ? (
          <div className={styles.empty}>暂无告警</div>
        ) : (
          alerts.map((alert, i) => (
            <div key={i} className={`${styles.alertItem} ${alert.level === "toast" ? styles.toast : ""}`}>
              <div className={styles.alertTime}>{alert.time} [{alert.taskId.slice(0, 8)}]</div>
              <div className={styles.alertMsg}>
                {alert.action && <span className={styles.alertAction}>[{alert.action}]</span>}
                {alert.message}
              </div>
            </div>
          ))
        )}
      </div>
      <button className={styles.clearBtn} onClick={() => setAlerts([])}>
        清空
      </button>
    </div>
  );
}
