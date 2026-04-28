import { JSONPath } from "jsonpath-plus";
import type { ExtractionField } from "./types";

export function extractFields(
  data: unknown,
  fields: ExtractionField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    try {
      const values = JSONPath({ path: field.jsonPath, json: data as object | unknown[] });
      if (values.length === 0) {
        result[field.name] = null;
        continue;
      }
      const value = values.length === 1 ? values[0] : values;
      result[field.name] = coerceType(value, field.type);
    } catch {
      result[field.name] = null;
    }
  }

  return result;
}

function coerceType(value: unknown, type: ExtractionField["type"]): unknown {
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
