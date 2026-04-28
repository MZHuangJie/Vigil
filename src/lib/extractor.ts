import { JSONPath } from "jsonpath-plus";
import type { ExtractionField } from "./types";

export function extractFields(
  data: unknown,
  fields: ExtractionField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const debug: string[] = [];

  for (const field of fields) {
    try {
      const values = JSONPath({ path: field.jsonPath, json: data as object | unknown[] });
      if (values.length === 0) {
        const keys = data && typeof data === "object" ? Object.keys(data as object).join(",") : "not-object";
        debug.push(`${field.jsonPath}: no match, root keys=[${keys}]`);
        result[field.name] = null;
        continue;
      }
      const value = values.length === 1 ? values[0] : values;
      result[field.name] = coerceType(value, field.type);
      debug.push(`${field.jsonPath}: found ${values.length} value(s)`);
    } catch (e) {
      debug.push(`${field.jsonPath}: error ${e instanceof Error ? e.message : String(e)}`);
      result[field.name] = null;
    }
  }

  (result as Record<string, unknown>)._debug = debug;
  return result;
}

function coerceType(value: unknown, type: ExtractionField["type"]): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => coerceType(v, type));
  }
  if (value === null || value === undefined) return null;
  switch (type) {
    case "number":
      return Number(value);
    case "string":
      return String(value);
    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return Boolean(value);
    default:
      return value;
  }
}
