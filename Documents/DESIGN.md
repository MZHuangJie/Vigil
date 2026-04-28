# Vigil — 网页请求监控与自动化工具

## 项目概述

Vigil 是一个基于 Puppeteer + Next.js 的网页请求监控系统。它可以：
1. 在真实浏览器中打开指定网页并自动登录
2. 监听匹配规则的 HTTP 请求
3. 按定时或事件驱动提取响应数据中的指定字段
4. 对提取的字段值进行统计
5. 根据统计结果触发预设行为

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    用户界面 (Next.js)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  任务配置    │  │   实时看板    │  │   告警面板    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼────────────────┼──────────────────┼──────────┘
          │                │                  │
┌─────────┼────────────────┼──────────────────┼──────────┐
│         ▼                ▼                  ▼           │
│                    API 路由层 (Route Handlers)            │
│  POST /api/tasks  GET /api/tasks  DELETE /api/tasks/:id  │
│  GET  /api/stats  POST /api/events                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────┐
│                      ▼                                    │
│                 核心引擎 (Puppeteer)                       │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ 登录模块  │  │ 请求拦截器  │  │   定时调度器         │ │
│  │ 自动填写  │  │ page.on()  │  │   setInterval()     │ │
│  │ 维持会话  │  │ 模式匹配   │  │   cron 表达式       │ │
│  └──────────┘  └─────┬──────┘  └──────────┬───────────┘ │
└──────────────────────┼─────────────────────┼────────────┘
                       │                     │
┌──────────────────────┼─────────────────────┼────────────┐
│                      ▼                     ▼             │
│                   数据处理层                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ 字段提取     │  │  统计分析    │  │   行为执行      │  │
│  │ JSONPath     │  │  计数/聚合   │  │  通知/日志     │  │
│  │ 正则匹配    │  │  阈值判断   │  │  Webhook/钉钉  │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 数据模型

### TaskConfig（任务配置）
```typescript
interface TaskConfig {
  id: string;
  name: string;                    // 任务名称
  enabled: boolean;                // 是否启用

  // 目标站点
  targetUrl: string;               // 要打开的网页 URL
  login: {
    enabled: boolean;              // 是否需要登录
    loginUrl?: string;             // 登录页 URL
    username: string;              // 用户名
    password: string;              // 密码
    usernameSelector: string;      // 用户名输入框选择器
    passwordSelector: string;      // 密码输入框选择器
    submitSelector: string;        // 登录按钮选择器
    successIndicator?: string;     // 登录成功标志（选择器或文本）
  };

  // 监听规则
  monitor: {
    mode: "intercept" | "poll";    // 拦截模式 / 定时轮询
    urlPattern: string;            // 匹配的请求 URL 正则
    pollIntervalMs?: number;       // 轮询间隔（毫秒）
    requestMethod?: string;        // 轮询时的请求方法
    requestBody?: string;          // 轮询时的请求体
  };

  // 字段提取
  extraction: {
    fields: ExtractionField[];     // 要提取的字段列表
    targetField?: string;          // 主统计目标字段
  };

  // 统计规则
  stats: {
    windowSeconds: number;         // 统计时间窗口（秒）
    groups: StatGroup[];           // 分组统计规则
  };

  // 行为定义
  actions: StatAction[];           // 触发行为
}
```

### ExtractionField（提取字段）
```typescript
interface ExtractionField {
  name: string;                    // 字段别名
  jsonPath: string;                // JSONPath 表达式，如 $.data.items[*].status
  type: "string" | "number" | "boolean";
}
```

### StatGroup（统计组）
```typescript
interface StatGroup {
  fieldName: string;               // 按哪个字段分组统计
  aggregation: "count" | "sum" | "avg" | "min" | "max";
  threshold?: number;              // 阈值（触发条件）
  operator?: "gt" | "lt" | "eq" | "gte" | "lte";
}
```

### StatAction（行为）
```typescript
interface StatAction {
  id: string;
  type: "log" | "toast" | "webhook" | "dingtalk" | "wework";
  condition: string;               // 触发条件描述
  config: {
    webhookUrl?: string;           // Webhook 地址
    messageTemplate: string;       // 消息模板，支持 {{fieldName}} 变量
  };
}
```

## 工作流程

```
1. 用户创建任务 → 配置 URL、登录、监听规则、字段、统计、行为
2. 点击启动 → Puppeteer 打开浏览器 → 访问目标页面
3. 需要登录 → 自动填写表单 → 提交 → 验证登录成功
4. 进入监听状态：
   a. 拦截模式：page.on('response') 拦截所有请求
   b. 轮询模式：定时调用 page.evaluate() 发起 fetch
5. 请求 URL 匹配 urlPattern → 解析响应 JSON
6. 按 extraction.fields 提取字段值
7. 按 stats.groups 分组统计（时间窗口内）
8. 统计结果触发 actions：
   - 阈值超标 → 发送 Webhook/钉钉/企微通知
   - 状态变更 → 写入本地日志
   - 异常波动 → 桌面 Toast 提醒
```

## 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 14 (App Router) | 前后端一体 |
| 浏览器引擎 | Puppeteer | Chromium 自动化 |
| 数据提取 | jsonpath | JSONPath 表达式解析 |
| 定时任务 | node-cron | Cron 表达式支持 |
| 通知 | node-fetch | Webhook HTTP 调用 |
| UI | React 18 + CSS Modules | 组件化界面 |
| 状态管理 | React Context | 跨组件共享任务状态 |
| 持久化 | SQLite (better-sqlite3) | 任务配置 + 统计历史 |

## 目录结构

```
Vigil/
├── Documents/
│   └── DESIGN.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── tasks/
│   │       │   ├── route.ts          # GET/POST 任务列表
│   │       │   └── [id]/
│   │       │       └── route.ts      # GET/DELETE 单个任务
│   │       ├── events/
│   │       │   └── route.ts          # SSE 实时事件流
│   │       └── stats/
│   │           └── route.ts          # GET 统计数据
│   ├── lib/
│   │   ├── types.ts                  # 类型定义
│   │   ├── db.ts                     # SQLite 封装
│   │   ├── browser.ts               # Puppeteer 启动/管理
│   │   ├── monitor.ts               # 请求拦截/监听
│   │   ├── login.ts                 # 自动登录
│   │   ├── extractor.ts            # JSONPath 字段提取
│   │   ├── scheduler.ts            # 定时任务调度
│   │   ├── stats.ts                 # 统计分析
│   │   └── notifier.ts             # 通知发送
│   └── components/
│       ├── TaskConfig.tsx           # 任务配置表单
│       ├── TaskDashboard.tsx        # 任务运行状态
│       ├── TaskLog.tsx              # 实时日志流
│       ├── AlertPanel.tsx           # 告警面板
│       └── StatChart.tsx            # 统计图表
├── package.json
├── tsconfig.json
├── next.config.mjs
├── .env.example
└── README.md
```

## 消息模板语法

```
任务 {{taskName}} 触发告警：
字段 {{fieldName}} 值为 {{value}}，{{operator}} 阈值 {{threshold}}
统计窗口：{{windowFrom}} ~ {{windowTo}}
当前统计：{{statSummary}}
```

## 第一期实现范围

- [ ] 任务 CRUD（创建/读取/删除任务）
- [ ] 登录自动化
- [ ] 请求拦截 + 定时轮询
- [ ] JSONPath 字段提取
- [ ] 计数统计 + 阈值判断
- [ ] Webhook 通知
- [ ] 实时日志面板
- [ ] 任务启停控制
