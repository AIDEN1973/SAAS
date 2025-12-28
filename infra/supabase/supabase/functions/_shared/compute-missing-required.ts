// LAYER: EDGE_FUNCTION_SHARED
/**
 * 필수/선택/조건부 필수 자동 판정 엔진
 *
 * Inline Execution에서 필드 자동 판정에 사용
 * SSOT: 서버에서만 판정 (프론트는 판정 주체 아님)
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// FieldRule 타입 정의 (Edge Function 환경에서는 packages 경로 접근 불가)
export type FieldRule =
  | { type: 'required_if'; field: string; equals: unknown; required: string[] }
  | { type: 'required_unless'; field: string; equals: unknown; required: string[] }
  | { type: 'one_of_required'; fields: string[] };

export interface MissingRequiredResult {
  missing_required: string[];
  satisfied: boolean;
  reason?: string;
  debug?: Record<string, unknown>;
}

/**
 * Zod 스키마에서 필수 필드 추출
 */
function extractRequiredFieldsFromSchema(schema: z.ZodTypeAny): string[] {
  const required: string[] = [];

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      // optional()이 없으면 필수
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
  }

  return required;
}

/**
 * 조건부 필수 규칙 평가
 */
function evaluateFieldRule(
  rule: FieldRule,
  params: Record<string, unknown>
): string[] {
  const missing: string[] = [];

  if (rule.type === 'required_if') {
    // field가 equals와 같으면 required 필드들이 필수
    const fieldValue = params[rule.field];
    if (fieldValue === rule.equals || (Array.isArray(fieldValue) && fieldValue.length > 0)) {
      // 조건이 활성화됨
      for (const requiredField of rule.required) {
        // nested 필드 처리 (예: "guardians[].name")
        if (requiredField.includes('[]')) {
          // 배열 필드 처리
          const [arrayField, nestedField] = requiredField.split('[]');
          const arrayValue = params[arrayField];
          if (Array.isArray(arrayValue) && arrayValue.length > 0) {
            // 배열의 각 요소에 nestedField가 있는지 확인
            for (let i = 0; i < arrayValue.length; i++) {
              const item = arrayValue[i];
              if (typeof item === 'object' && item !== null) {
                const itemObj = item as Record<string, unknown>;
                if (!itemObj[nestedField.replace('.', '')] || itemObj[nestedField.replace('.', '')] === '') {
                  missing.push(`${arrayField}[${i}].${nestedField.replace('.', '')}`);
                }
              }
            }
          }
        } else {
          // 일반 필드
          if (!params[requiredField] || params[requiredField] === '') {
            missing.push(requiredField);
          }
        }
      }
    }
  } else if (rule.type === 'required_unless') {
    // field가 equals와 다르면 required 필드들이 필수
    const fieldValue = params[rule.field];
    if (fieldValue !== rule.equals && !(Array.isArray(fieldValue) && fieldValue.length > 0)) {
      // 조건이 활성화됨
      for (const requiredField of rule.required) {
        if (!params[requiredField] || params[requiredField] === '') {
          missing.push(requiredField);
        }
      }
    }
  } else if (rule.type === 'one_of_required') {
    // fields 중 하나라도 존재/유효하면 OK
    const hasAny = rule.fields.some(field => {
      const value = params[field];
      return value !== undefined && value !== null && value !== '';
    });
    if (!hasAny) {
      // 모두 없으면 첫 번째 필드를 missing으로 표시 (실제로는 "중 하나는 필수" 메시지)
      missing.push(`one_of:${rule.fields.join(',')}`);
    }
  }

  return missing;
}

/**
 * 필수/선택/조건부 필수 자동 판정
 *
 * @param draft_params 현재 수집된 파라미터 (partial)
 * @param schema Intent의 paramsSchema (Zod)
 * @param field_rules 조건부 필수 규칙 배열
 * @returns missing_required, satisfied, reason
 */
export function computeMissingRequired(
  draft_params: Record<string, unknown>,
  schema: z.ZodTypeAny,
  field_rules?: FieldRule[]
): MissingRequiredResult {
  const missing: string[] = [];
  const debug: Record<string, unknown> = {};

  // 1. 스키마 기반 Required 필드 추출
  const schemaRequired = extractRequiredFieldsFromSchema(schema);
  debug.schema_required = schemaRequired;

  // 스키마에서 필수 필드 확인
  for (const field of schemaRequired) {
    if (!draft_params[field] || draft_params[field] === '') {
      missing.push(field);
    }
  }

  // 2. field_rules 기반 Conditional Required 평가
  if (field_rules && field_rules.length > 0) {
    debug.field_rules_count = field_rules.length;
    for (const rule of field_rules) {
      const ruleMissing = evaluateFieldRule(rule, draft_params);
      missing.push(...ruleMissing);
      debug[`rule_${rule.type}`] = ruleMissing;
    }
  }

  // 중복 제거
  const uniqueMissing = [...new Set(missing)];

  return {
    missing_required: uniqueMissing,
    satisfied: uniqueMissing.length === 0,
    reason: uniqueMissing.length > 0
      ? `필수 필드 누락: ${uniqueMissing.join(', ')}`
      : '모든 필수 필드가 충족되었습니다.',
    debug,
  };
}

