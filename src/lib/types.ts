export interface ExtractionField {
  name: string;
  jsonPath: string;
  type: "string" | "number" | "boolean";
}

export interface StatGroup {
  fieldName: string;
  aggregation: "count" | "sum" | "avg" | "min" | "max";
  threshold?: number;
  operator?: "gt" | "lt" | "eq" | "gte" | "lte";
}

export interface StatAction {
  id: string;
  type: "log" | "toast" | "webhook" | "dingtalk" | "wework" | "wework_user";
  condition: string;
  config: {
    webhookUrl?: string;
    messageTemplate: string;
    corpId?: string;
    agentId?: string;
    corpSecret?: string;
    toUser?: string;
  };
}

export interface TaskConfig {
  id: string;
  name: string;
  enabled: boolean;
  targetUrl: string;
  login: {
    enabled: boolean;
    loginUrl?: string;
    username: string;
    password: string;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    successIndicator?: string;
  };
  monitor: {
    mode: "intercept" | "poll";
    urlPattern: string;
    pollIntervalMs?: number;
    requestMethod?: string;
    requestBody?: string;
    requestParams?: Record<string, string>;
    requestHeaders?: Record<string, string>;
  };
  extraction: {
    fields: ExtractionField[];
    targetField?: string;
  };
  stats: {
    windowSeconds: number;
    groups: StatGroup[];
  };
  actions: StatAction[];
}

export type TaskStatus = "stopped" | "running" | "error";

export interface TaskRecord {
  id: string;
  name: string;
  enabled: number;
  config: string;
  status: TaskStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRecord {
  id: number;
  task_id: string;
  type: "log" | "alert" | "stat";
  data: string;
  created_at: string;
}

export interface StatRecord {
  id: number;
  task_id: string;
  field_name: string;
  value: number;
  created_at: string;
}

export interface ExtractedData {
  taskId: string;
  timestamp: string;
  fields: Record<string, unknown>;
  raw: unknown;
}

export interface StatResult {
  fieldName: string;
  aggregation: string;
  value: number;
  threshold?: number;
  operator?: string;
  triggered: boolean;
}

export interface SSEEvent {
  type: "stat" | "alert" | "log" | "status" | "ping";
  taskId?: string;
  data: unknown;
}
