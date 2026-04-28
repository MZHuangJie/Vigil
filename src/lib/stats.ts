import type { TaskConfig, ExtractedData, StatResult } from "./types";
import { addStatRecord, getStatRecords } from "./db";
import { emitSSE } from "./scheduler";
import { sendNotification } from "./notifier";

export function processExtractedData(config: TaskConfig, data: ExtractedData): void {
  for (const [fieldName, rawValue] of Object.entries(data.fields)) {
    if (fieldName === "_debug") continue;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "boolean") continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const v of values) {
      const numValue = Number(v);
      if (isNaN(numValue)) continue;
      addStatRecord(config.id, fieldName, numValue);
    }
  }

  const results = computeStats(config);

  if (config.extraction.targetField) {
    const targetResult = results.find((r) => r.fieldName === config.extraction.targetField);
    if (targetResult) {
      const allRecords = getStatRecords(config.id, config.stats.windowSeconds || 60);
      const count = allRecords.filter((r) => r.field_name === config.extraction.targetField).length;
      emitSSE({
        type: "stat",
        taskId: config.id,
        data: `${count}个${targetResult.fieldName}的${aggLabel(targetResult.aggregation)}是${targetResult.value}`,
      });
    }
  }

  checkThresholds(config, results);
}

export function computeStats(config: TaskConfig): StatResult[] {
  const windowSeconds = config.stats.windowSeconds || 60;
  const records = getStatRecords(config.id, windowSeconds);
  const results: StatResult[] = [];

  for (const group of config.stats.groups) {
    const fieldRecords = records.filter((r) => r.field_name === group.fieldName);
    const values = fieldRecords.map((r) => r.value);

    let value = 0;
    switch (group.aggregation) {
      case "count":
        value = values.length;
        break;
      case "sum":
        value = values.reduce((a, b) => a + b, 0);
        break;
      case "avg":
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case "min":
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case "max":
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
    }

    let triggered = false;
    if (group.threshold !== undefined && group.operator) {
      triggered = evaluateThreshold(value, group.operator, group.threshold);
      if (triggered) {
        emitSSE({
          type: "alert",
          taskId: config.id,
          data: {
            fieldName: group.fieldName,
            aggregation: group.aggregation,
            value,
            threshold: group.threshold,
            operator: group.operator,
          },
        });
      }
    }

    results.push({
      fieldName: group.fieldName,
      aggregation: group.aggregation,
      value,
      threshold: group.threshold,
      operator: group.operator,
      triggered,
    });
  }

  return results;
}

function evaluateThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt": return value > threshold;
    case "lt": return value < threshold;
    case "eq": return value === threshold;
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    default: return false;
  }
}

function aggLabel(agg: string): string {
  switch (agg) {
    case "count": return "计数";
    case "sum": return "总和";
    case "avg": return "平均值";
    case "min": return "最小值";
    case "max": return "最大值";
    default: return agg;
  }
}

function checkThresholds(config: TaskConfig, results: StatResult[]): void {
  const triggered = results.filter((r) => r.triggered);

  for (const action of config.actions) {
    const relatedGroups = config.stats.groups.filter((g) => {
      if (!g.threshold || !g.operator) return false;
      const result = triggered.find((r) => r.fieldName === g.fieldName);
      return result !== undefined;
    });

    if (relatedGroups.length === 0) continue;

    const message = compileTemplate(action.config.messageTemplate, config, relatedGroups);
    sendNotification(action, message, config);
  }
}

function compileTemplate(
  template: string,
  config: TaskConfig,
  groups: Array<{ fieldName: string; threshold?: number; operator?: string }>
): string {
  let result = template.replace(/\{\{taskName\}\}/gi, config.name);

  const group = groups[0];
  if (group) {
    result = result.replace(/\{\{fieldName\}\}/gi, group.fieldName);
    result = result.replace(/\{\{threshold\}\}/gi, String(group.threshold ?? ""));
    result = result.replace(/\{\{operator\}\}/gi, group.operator ?? "");
  }

  const now = new Date();
  const windowMs = (config.stats.windowSeconds || 60) * 1000;
  const windowFrom = new Date(now.getTime() - windowMs);

  result = result.replace(/\{\{windowFrom\}\}/gi, windowFrom.toISOString());
  result = result.replace(/\{\{windowTo\}\}/gi, now.toISOString());

  const summary = groups.map((g) => `${g.fieldName}: ${g.operator} ${g.threshold}`).join(", ");
  result = result.replace(/\{\{statSummary\}\}/gi, summary);

  return result;
}
