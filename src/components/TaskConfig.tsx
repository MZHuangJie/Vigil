"use client";

import { useState } from "react";
import type { TaskConfig, ExtractionField, StatGroup, StatAction } from "@/lib/types";
import styles from "./TaskConfig.module.css";

interface Props {
  task?: TaskConfig | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TaskConfigForm({ task, onSaved, onCancel }: Props) {
  const [name, setName] = useState(task?.name || "");
  const [targetUrl, setTargetUrl] = useState(task?.targetUrl || "");
  const [loginEnabled, setLoginEnabled] = useState(task?.login?.enabled || false);
  const [loginUrl, setLoginUrl] = useState(task?.login?.loginUrl || "");
  const [username, setUsername] = useState(task?.login?.username || "");
  const [password, setPassword] = useState(task?.login?.password || "");
  const [usernameSelector, setUsernameSelector] = useState(task?.login?.usernameSelector || "");
  const [passwordSelector, setPasswordSelector] = useState(task?.login?.passwordSelector || "");
  const [submitSelector, setSubmitSelector] = useState(task?.login?.submitSelector || "");
  const [successIndicator, setSuccessIndicator] = useState(task?.login?.successIndicator || "");

  const [monitorMode, setMonitorMode] = useState<"intercept" | "poll">(task?.monitor?.mode || "intercept");
  const [urlPattern, setUrlPattern] = useState(task?.monitor?.urlPattern || "");
  const [pollIntervalMs, setPollIntervalMs] = useState(task?.monitor?.pollIntervalMs || 5000);
  const [requestMethod, setRequestMethod] = useState(task?.monitor?.requestMethod || "GET");
  const [requestBody, setRequestBody] = useState(task?.monitor?.requestBody || "");

  const [fields, setFields] = useState<ExtractionField[]>(task?.extraction?.fields || []);
  const [targetField, setTargetField] = useState(task?.extraction?.targetField || "");

  const [windowSeconds, setWindowSeconds] = useState(task?.stats?.windowSeconds || 60);
  const [groups, setGroups] = useState<StatGroup[]>(task?.stats?.groups || []);
  const [actions, setActions] = useState<StatAction[]>(task?.actions || []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addField = () => {
    setFields([...fields, { name: "", jsonPath: "", type: "string" }]);
  };

  const updateField = (index: number, update: Partial<ExtractionField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...update };
    setFields(updated);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    setGroups([...groups, { fieldName: "", aggregation: "count" }]);
  };

  const updateGroup = (index: number, update: Partial<StatGroup>) => {
    const updated = [...groups];
    updated[index] = { ...updated[index], ...update };
    setGroups(updated);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([
      ...actions,
      {
        id: crypto.randomUUID(),
        type: "log",
        condition: "",
        config: { messageTemplate: "" },
      },
    ]);
  };

  const updateAction = (index: number, update: Partial<StatAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...update };
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const buildConfig = (): TaskConfig => ({
    id: task?.id || "",
    name,
    enabled: task?.enabled ?? true,
    targetUrl,
    login: {
      enabled: loginEnabled,
      loginUrl: loginUrl || undefined,
      username,
      password,
      usernameSelector,
      passwordSelector,
      submitSelector,
      successIndicator: successIndicator || undefined,
    },
    monitor: {
      mode: monitorMode,
      urlPattern,
      pollIntervalMs: monitorMode === "poll" ? pollIntervalMs : undefined,
      requestMethod: monitorMode === "poll" ? requestMethod : undefined,
      requestBody: monitorMode === "poll" ? requestBody : undefined,
    },
    extraction: {
      fields,
      targetField: targetField || undefined,
    },
    stats: {
      windowSeconds,
      groups,
    },
    actions,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("请输入任务名称");
      return;
    }
    if (!targetUrl.trim()) {
      setError("请输入目标 URL");
      return;
    }

    setLoading(true);
    try {
      const config = buildConfig();
      const url = task?.id ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = task?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>{task?.id ? "编辑任务" : "新建任务"}</h2>

      <div className={styles.formGroup}>
        <label>任务名称 *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入任务名称" />
      </div>

      <div className={styles.formGroup}>
        <label>目标 URL *</label>
        <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://example.com" />
      </div>

      {/* Login Section */}
      <div className={styles.section}>
        <h3>登录配置</h3>
        <div className={`${styles.formGroup} ${styles.checkbox}`}>
          <input type="checkbox" id="loginEnabled" checked={loginEnabled} onChange={(e) => setLoginEnabled(e.target.checked)} />
          <label htmlFor="loginEnabled">启用自动登录</label>
        </div>
        {loginEnabled && (
          <>
            <div className={styles.formGroup}>
              <label>登录页 URL</label>
              <input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://example.com/login" />
            </div>
            <div className={styles.formGroup}>
              <label>用户名</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>用户名选择器</label>
              <input value={usernameSelector} onChange={(e) => setUsernameSelector(e.target.value)} placeholder="#username, input[name=user]" />
            </div>
            <div className={styles.formGroup}>
              <label>密码选择器</label>
              <input value={passwordSelector} onChange={(e) => setPasswordSelector(e.target.value)} placeholder="#password, input[name=pass]" />
            </div>
            <div className={styles.formGroup}>
              <label>登录按钮选择器</label>
              <input value={submitSelector} onChange={(e) => setSubmitSelector(e.target.value)} placeholder="button[type=submit], #login-btn" />
            </div>
            <div className={styles.formGroup}>
              <label>登录成功指示器 (可选)</label>
              <input value={successIndicator} onChange={(e) => setSuccessIndicator(e.target.value)} placeholder="CSS选择器或页面文本" />
            </div>
          </>
        )}
      </div>

      {/* Monitor Section */}
      <div className={styles.section}>
        <h3>监听配置</h3>
        <div className={styles.formGroup}>
          <label>监听模式</label>
          <select value={monitorMode} onChange={(e) => setMonitorMode(e.target.value as "intercept" | "poll")}>
            <option value="intercept">拦截模式</option>
            <option value="poll">定时轮询</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>URL 匹配正则</label>
          <input value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} placeholder=".*" />
        </div>
        {monitorMode === "poll" && (
          <>
            <div className={styles.formGroup}>
              <label>轮询间隔 (毫秒)</label>
              <input type="number" value={pollIntervalMs} onChange={(e) => setPollIntervalMs(Number(e.target.value))} />
            </div>
            <div className={styles.formGroup}>
              <label>请求方法</label>
              <select value={requestMethod} onChange={(e) => setRequestMethod(e.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            {requestMethod !== "GET" && (
              <div className={styles.formGroup}>
                <label>请求体 (JSON)</label>
                <textarea value={requestBody} onChange={(e) => setRequestBody(e.target.value)} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Extraction Section */}
      <div className={styles.section}>
        <h3>字段提取</h3>
        <div className={styles.formGroup}>
          <label>主统计目标字段 (可选)</label>
          <input value={targetField} onChange={(e) => setTargetField(e.target.value)} placeholder="字段别名" />
        </div>
        <h4>提取字段列表</h4>
        {fields.map((field, i) => (
          <div key={i} className={styles.fieldRow}>
            <input value={field.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="字段别名" />
            <input value={field.jsonPath} onChange={(e) => updateField(i, { jsonPath: e.target.value })} placeholder="$.data.value" />
            <select value={field.type} onChange={(e) => updateField(i, { type: e.target.value as ExtractionField["type"] })}>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <button type="button" className={styles.removeBtn} onClick={() => removeField(i)}>删除</button>
          </div>
        ))}
        <button type="button" className={styles.addBtn} onClick={addField}>+ 添加字段</button>
      </div>

      {/* Stats Section */}
      <div className={styles.section}>
        <h3>统计规则</h3>
        <div className={styles.formGroup}>
          <label>统计时间窗口 (秒)</label>
          <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))} />
        </div>
        <h4>分组统计</h4>
        {groups.map((group, i) => (
          <div key={i} className={styles.fieldRow}>
            <input value={group.fieldName} onChange={(e) => updateGroup(i, { fieldName: e.target.value })} placeholder="字段名" />
            <select value={group.aggregation} onChange={(e) => updateGroup(i, { aggregation: e.target.value as StatGroup["aggregation"] })}>
              <option value="count">count</option>
              <option value="sum">sum</option>
              <option value="avg">avg</option>
              <option value="min">min</option>
              <option value="max">max</option>
            </select>
            <input type="number" value={group.threshold || ""} onChange={(e) => updateGroup(i, { threshold: e.target.value ? Number(e.target.value) : undefined })} placeholder="阈值" style={{ width: 80 }} />
            <select value={group.operator || ""} onChange={(e) => updateGroup(i, { operator: e.target.value as StatGroup["operator"] || undefined })} style={{ width: 70 }}>
              <option value="">--</option>
              <option value="gt">gt</option>
              <option value="lt">lt</option>
              <option value="eq">eq</option>
              <option value="gte">gte</option>
              <option value="lte">lte</option>
            </select>
            <button type="button" className={styles.removeBtn} onClick={() => removeGroup(i)}>删除</button>
          </div>
        ))}
        <button type="button" className={styles.addBtn} onClick={addGroup}>+ 添加统计组</button>
      </div>

      {/* Actions Section */}
      <div className={styles.section}>
        <h3>触发行为</h3>
        {actions.map((action, i) => (
          <div key={action.id || i}>
            <div className={styles.fieldRow}>
              <select value={action.type} onChange={(e) => updateAction(i, { type: e.target.value as StatAction["type"] })} style={{ width: 110 }}>
                <option value="log">log</option>
                <option value="toast">toast</option>
                <option value="webhook">webhook</option>
                <option value="dingtalk">dingtalk</option>
                <option value="wework">wework</option>
                <option value="wework_user">wework_user</option>
              </select>
              {action.type !== "wework_user" ? (
                <input value={action.config.webhookUrl || ""} onChange={(e) => updateAction(i, { config: { ...action.config, webhookUrl: e.target.value } })} placeholder="Webhook URL" />
              ) : (
                <input value={action.config.toUser || ""} onChange={(e) => updateAction(i, { config: { ...action.config, toUser: e.target.value } })} placeholder="接收人 UserID" />
              )}
              <button type="button" className={styles.removeBtn} onClick={() => removeAction(i)}>删除</button>
            </div>
            {action.type === "wework_user" && (
              <div className={styles.fieldRow} style={{ marginTop: 4 }}>
                <input value={action.config.corpId || ""} onChange={(e) => updateAction(i, { config: { ...action.config, corpId: e.target.value } })} placeholder="企业 ID (corpId)" />
                <input value={action.config.agentId || ""} onChange={(e) => updateAction(i, { config: { ...action.config, agentId: e.target.value } })} placeholder="应用 ID (agentId)" />
                <input type="password" value={action.config.corpSecret || ""} onChange={(e) => updateAction(i, { config: { ...action.config, corpSecret: e.target.value } })} placeholder="应用 Secret" />
              </div>
            )}
          </div>
        ))}
        <button type="button" className={styles.addBtn} onClick={addAction}>+ 添加行为</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="submit" className={styles.submitBtn} disabled={loading} style={{ flex: 1 }}>
          {loading ? "保存中..." : "保存任务"}
        </button>
        <button type="button" className={styles.removeBtn} onClick={onCancel} style={{ padding: "10px 20px" }}>
          取消
        </button>
      </div>
    </form>
  );
}
