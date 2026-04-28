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
  const [requestParams, setRequestParams] = useState<Array<{ key: string; value: string }>>(
    task?.monitor?.requestParams
      ? Object.entries(task.monitor.requestParams).map(([key, value]) => ({ key, value }))
      : []
  );
  const [requestHeaders, setRequestHeaders] = useState<Array<{ key: string; value: string }>>(
    task?.monitor?.requestHeaders
      ? Object.entries(task.monitor.requestHeaders).map(([key, value]) => ({ key, value }))
      : []
  );

  const [fields, setFields] = useState<ExtractionField[]>(task?.extraction?.fields || []);
  const [targetField, setTargetField] = useState(task?.extraction?.targetField || "");

  const [windowSeconds, setWindowSeconds] = useState(task?.stats?.windowSeconds || 60);
  const [groups, setGroups] = useState<StatGroup[]>(task?.stats?.groups || []);
  const [actions, setActions] = useState<StatAction[]>(task?.actions || []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    timeTakenMs?: number;
    body?: unknown;
    error?: string;
    viaBrowser?: boolean;
    _diag?: Record<string, unknown>;
  } | null>(null);
  const [testing, setTesting] = useState(false);

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

  const addParam = () => {
    setRequestParams([...requestParams, { key: "", value: "" }]);
  };

  const updateParam = (index: number, update: Partial<{ key: string; value: string }>) => {
    const updated = [...requestParams];
    updated[index] = { ...updated[index], ...update };
    setRequestParams(updated);
  };

  const removeParam = (index: number) => {
    setRequestParams(requestParams.filter((_, i) => i !== index));
  };

  const addHeader = () => {
    setRequestHeaders([...requestHeaders, { key: "", value: "" }]);
  };

  const updateHeader = (index: number, update: Partial<{ key: string; value: string }>) => {
    const updated = [...requestHeaders];
    updated[index] = { ...updated[index], ...update };
    setRequestHeaders(updated);
  };

  const removeHeader = (index: number) => {
    setRequestHeaders(requestHeaders.filter((_, i) => i !== index));
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
      requestBody: monitorMode === "poll" && requestMethod !== "GET" ? requestBody : undefined,
      requestParams: monitorMode === "poll" && requestMethod === "GET"
        ? Object.fromEntries(requestParams.filter((p) => p.key.trim()).map((p) => [p.key, p.value]))
        : undefined,
      requestHeaders:
        requestHeaders.filter((h) => h.key.trim()).length > 0
          ? Object.fromEntries(requestHeaders.filter((h) => h.key.trim()).map((h) => [h.key, h.value]))
          : undefined,
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

  const handleTestRequest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");

    const params = Object.fromEntries(requestParams.filter((p) => p.key.trim()).map((p) => [p.key, p.value]));
    const headers = Object.fromEntries(requestHeaders.filter((h) => h.key.trim()).map((h) => [h.key, h.value]));
    const payload: Record<string, unknown> = {
      urlPattern,
      requestMethod,
      requestParams: requestMethod === "GET" && Object.keys(params).length > 0 ? params : undefined,
      requestHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    };
    if (requestMethod !== "GET" && requestBody) {
      payload.requestBody = requestBody;
    }
    if (task?.id) {
      payload.taskId = task.id;
    }

    try {
      const res = await fetch("/api/tasks/test-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "请求失败" });
    } finally {
      setTesting(false);
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
          <div style={{ display: "flex", gap: 8 }}>
            <input value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} placeholder=".*" style={{ flex: 1 }} />
            <button type="button" className={styles.testBtn} disabled={testing} onClick={handleTestRequest}>
              {testing ? "测试中..." : "测试请求"}
            </button>
          </div>
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
            {requestMethod === "GET" && (
              <>
                <h4>请求参数</h4>
                {requestParams.map((param, i) => (
                  <div key={i} className={styles.fieldRow}>
                    <input
                      value={param.key}
                      onChange={(e) => updateParam(i, { key: e.target.value })}
                      placeholder="参数名"
                      style={{ flex: 1 }}
                    />
                    <input
                      value={param.value}
                      onChange={(e) => updateParam(i, { value: e.target.value })}
                      placeholder="参数值"
                      style={{ flex: 2 }}
                    />
                    <button type="button" className={styles.removeBtn} onClick={() => removeParam(i)}>删除</button>
                  </div>
                ))}
                <button type="button" className={styles.addBtn} onClick={addParam}>+ 添加参数</button>
              </>
            )}
            <h4>自定义请求头</h4>
            {requestHeaders.map((header, i) => (
              <div key={i} className={styles.fieldRow}>
                <input
                  value={header.key}
                  onChange={(e) => updateHeader(i, { key: e.target.value })}
                  placeholder="Header 名 如 New-Api-User"
                  style={{ flex: 1 }}
                />
                <input
                  value={header.value}
                  onChange={(e) => updateHeader(i, { value: e.target.value })}
                  placeholder="Header 值"
                  style={{ flex: 2 }}
                />
                <button type="button" className={styles.removeBtn} onClick={() => removeHeader(i)}>删除</button>
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={addHeader}>+ 添加请求头</button>
          </>
        )}
        {testResult && (
          <div className={styles.testResult} style={{ marginTop: 12 }}>
            <div className={testResult.success ? styles.testSuccess : styles.testFail}>
              {testResult.success ? "✓ 请求成功" : "✗ 请求失败"}
              {testResult.status !== undefined && ` (HTTP ${testResult.status})`}
              {testResult.timeTakenMs !== undefined && ` · ${testResult.timeTakenMs}ms`}
              {testResult.viaBrowser && " · 通过浏览器"}
            </div>
            {testResult.error && <div className={styles.testError}>{testResult.error}</div>}
            {testResult.body !== undefined && (
              <pre className={styles.testBody}>{JSON.stringify(testResult.body, null, 2)}</pre>
            )}
            {testResult._diag && (
              <pre className={styles.testBody} style={{ background: "#1a1d2e", color: "#8b9dc3", fontSize: 11 }}>
                {JSON.stringify(testResult._diag, null, 2)}
              </pre>
            )}
            {!testResult.success && !testResult.viaBrowser && loginEnabled && (
              <div className={styles.testError} style={{ color: "#f0a020" }}>
                提示：需要先保存并启动任务（完成登录），测试请求才能携带浏览器中的认证信息
              </div>
            )}
          </div>
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
              {(action.type === "log" || action.type === "toast") && (
                <input
                  value={action.config.messageTemplate || ""}
                  onChange={(e) => updateAction(i, { config: { ...action.config, messageTemplate: e.target.value } })}
                  placeholder="消息模板"
                  style={{ flex: 2 }}
                />
              )}
              {(action.type === "webhook" || action.type === "dingtalk" || action.type === "wework") && (
                <input
                  value={action.config.webhookUrl || ""}
                  onChange={(e) => updateAction(i, { config: { ...action.config, webhookUrl: e.target.value } })}
                  placeholder="Webhook URL"
                  style={{ flex: 2 }}
                />
              )}
              {action.type === "wework_user" && (
                <input
                  value={action.config.toUser || ""}
                  onChange={(e) => updateAction(i, { config: { ...action.config, toUser: e.target.value } })}
                  placeholder="接收人 UserID"
                  style={{ flex: 2 }}
                />
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
