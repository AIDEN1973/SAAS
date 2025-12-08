/**
 * Meta-Schema Validator
 * 
 * [불�? 규칙] ?�키�?구조???�음 ?�계?�서 검�?
 * - 개발(local dev)
 * - CI 빌드 ?�계
 * - ?�넌??배포 ?? * - Schema Registry???�록 ?�점
 */

import { z } from 'zod';
import { FormSchema, TableSchema, SchemaVersion, ConditionRule, MultiConditionRule } from './types';

/**
 * Schema Version Validator
 * 
 * SDUI v1.1: minClient ?�용 (minSupportedClient???�위 ?�환??
 */
const schemaVersionBase = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  minClient: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),  // SDUI v1.1
  minSupportedClient: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),  // ?�위 ?�환??  entity: z.string().min(1),
});

const schemaVersionSchema = schemaVersionBase.refine((data) => {
  // minClient ?�는 minSupportedClient �??�나???�수
  return !!(data.minClient || data.minSupportedClient);
}, {
  message: 'minClient ?�는 minSupportedClient �??�나???�수?�니??',
});

/**
 * Layout Schema Validator
 * 
 * SDUI v1.1: columns�?number�??�장 (1-12)
 */
const layoutSchema = z.object({
  type: z.enum(['grid', 'section', 'tabs', 'stepper', 'drawer', 'modal', 'responsive']).optional(),  // SDUI v1.1
  columns: z.union([z.number().min(1).max(12), z.enum(['1', '2', '3', '4'])]).optional(),  // SDUI v1.1: number ?�장
  columnGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
  rowGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
  // SDUI v1.1: tabs, stepper, responsive ���̾ƿ� ����
  tabs: z.array(z.object({
    key: z.string(),
    labelKey: z.string().optional(),
    label: z.string().optional(),
    fields: z.array(z.string()).optional(),
  })).optional(),
  steps: z.array(z.object({
    key: z.string(),
    labelKey: z.string().optional(),
    label: z.string().optional(),
    fields: z.array(z.string()).optional(),
  })).optional(),
  responsive: z.object({
    mobile: z.any().optional(),
    tablet: z.any().optional(),
    desktop: z.any().optional(),
  }).optional(),
});

/**
 * Condition Rule Validator (?�일 조건)
 * 
 * SDUI v1.1: then/else 구조 지?? ?�로???�산??지?? */
const conditionRuleSchema: z.ZodType<ConditionRule> = z.object({
  field: z.string().min(1),
  op: z.enum(['==', '!=', 'eq', 'ne', 'in', 'not_in', 'exists', 'not_exists', 'gt', 'gte', 'lt', 'lte', '>', '>=', '<', '<=']),  // SDUI v1.1: 비교 연산자
  value: z.any().optional(),  // exists/not_exists의 경우 불필요
  // SDUI v1.1: then/else 구조 구조
  then: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  else: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  // ?�위 ?�환?? 기존 action ?�드
  action: z.enum(['show', 'hide', 'enable', 'disable', 'require']).optional(),
}).refine((data) => {
  // ?�️ 중요: value가 undefined??ConditionRule?� Meta-Schema ?�계?�서 거�?
  // eq/ne/in/not_in/gt/gte/lt/lte ?�산?�는 value가 ?�수 (exists/not_exists ?�외)
  if (data.op !== 'exists' && data.op !== 'not_exists' && data.value === undefined) {
    return false;
  }
  return true;
}, {
  message: 'eq/ne/in/not_in/gt/gte/lt/lte ?�산?�는 value가 ?�수?�니?? exists/not_exists ?�산?�만 value가 불필?�합?�다.',
}).refine((data) => {
  // SDUI v1.1: in/not_in ?�산?�는 value�??�칼???�는 배열 모두 ?�용
  // 배열??경우: fieldValue?� expected 배열 �?교집??차집???�단
  // ?�칼?�인 경우: 기존 ?�작 ?��?
  // (?�후 intersects/not_intersects ?�산?�로 ??명확?�게 분리 가??
  // ?�재??배열 ?�용?�로 처리
  return true;
});

/**
 * Multi Condition Rule Validator (복수 조건 AND/OR)
 * 
 * SDUI v1.1: then/else 구조 지원
 */
const multiConditionRuleSchema: z.ZodType<MultiConditionRule> = z.object({
  conditions: z.array(conditionRuleSchema).min(1),
  logic: z.enum(['and', 'or']),
  // SDUI v1.1: then/else 구조 (action보다 ?�선)
  then: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  else: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  // ?�위 ?�환?? 기존 action ?�드
  action: z.enum(['show', 'hide', 'enable', 'disable', 'require']).optional(),
});

/**
 * Form Field Schema Validator
 * 
 * [불�? 규칙] Tailwind ?�래??문자???�용 금�? 검�? * [불�? 규칙] Field kind�?options 강제 검?? * [불�? 규칙] ConditionRule 구조??검�?가?? */
const formFieldSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['text', 'email', 'phone', 'number', 'password', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'datetime', 'custom']),  // SDUI v1.1: custom 추�?
  ui: z.object({
    // SDUI v1.1: i18n 지원
    labelKey: z.string().optional(),
    label: z.string().optional(),  // 하위 호환성
    placeholderKey: z.string().optional(),
    placeholder: z.string().optional(),  // 하위 호환성
    descriptionKey: z.string().optional(),
    description: z.string().optional(),  // 하위 호환성
    tooltipKey: z.string().optional(),
    tooltip: z.string().optional(),  // 하위 호환성
    colSpan: z.number().min(1).max(12).optional(),
  }).optional(),
  // SDUI v1.1: options의 i18n 지원
  options: z.array(z.object({
    value: z.string(),
    labelKey: z.string().optional(),  // SDUI v1.1
    label: z.string().optional(),  // 하위 호환성
  })).optional(),
  defaultValue: z.any().optional(),
  condition: conditionRuleSchema.optional(),  // ?�일 조건 (?�위 ?�환??
  conditions: multiConditionRuleSchema.optional(),  // 복수 조건 (AND/OR)
  // SDUI v1.1: Custom Widget 지원
  customComponentType: z.string().optional(),
  validation: z.object({
    // SDUI v1.1: messageKey 지원
    required: z.union([
      z.boolean(),
      z.string(),
      z.object({
        messageKey: z.string().optional(),
        message: z.string().optional(),
      }),
    ]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.object({
      value: z.string(),  // JSON serializable ?�턴 문자??(?? "^010[0-9]{8}$")
      messageKey: z.string().optional(),  // SDUI v1.1
      message: z.string().optional(),  // 하위 호환성
    }).optional(),
    validate: z.function().optional(),
  }).optional(),
}).refine((data) => {
  // select/multiselect/radio는 options 필수
  if (['select', 'multiselect', 'radio'].includes(data.kind)) {
    return data.options && data.options.length > 0;
  }
  return true;
}, {
  message: 'select/multiselect/radio 필드는 options가 필수입니다.',
}).refine((data) => {
  // text/textarea/date 등은 options가 존재하면 안됨 (custom 제외)
  if (!['select', 'multiselect', 'radio', 'custom'].includes(data.kind)) {
    return !data.options || data.options.length === 0;
  }
  return true;
}, {
  message: 'text/textarea/date/datetime/number/password/email/phone/checkbox 필드는 options를 가질 수 없습니다.',
}).refine((data) => {
  // SDUI v1.1: custom kind는 customComponentType 필수
  if (data.kind === 'custom' && !data.customComponentType) {
    return false;
  }
  return true;
}, {
  message: 'custom kind 필드는 customComponentType이 필수입니다.',
}).refine((data) => {
  // options 유효성 검사 강화
  if (data.options && data.options.length > 0) {
    // options.value 중복 검사
    const values = data.options.map((opt) => opt.value);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      return false;
    }
    // options.labelKey 또는 label 중 하나는 필수 (SDUI v1.1)
    if (data.options.some((opt) => !opt.labelKey && (!opt.label || opt.label.trim() === ''))) {
      return false;
    }
  }
  return true;
}, {
  message: 'options.value는 중복될 수 없으며, options.labelKey 또는 label 중 하나는 필수입니다.',
}).refine((data) => {
  // Tailwind 클래스 문자열 사용 금지 검사
  // ui.label, ui.placeholder는 Tailwind 클래스 패턴을 포함하여 스키마에 저장되지 않도록 검사
  const tailwindPattern = /^(p|m|w|h|text|bg|border|rounded|flex|grid|col|row|gap|space|justify|items|self|place)-/;
  if (data.ui?.label && tailwindPattern.test(data.ui.label)) {
    return false;
  }
  if (data.ui?.placeholder && tailwindPattern.test(data.ui.placeholder)) {
    return false;
  }
  return true;
}, {
  message: '스키마에는 Tailwind 클래스를 직접 사용할 수 없습니다. props 기반으로 전달해야 합니다.',
}).refine((data) => {
  // ConditionRule 충돌 검사: 단일 조건 + 복수 조건 동시 존재 금지
  if (data.condition && data.conditions) {
    return false;
  }
  return true;
}, {
  message: 'condition과 conditions를 동시에 사용할 수 없습니다. conditions가 있으면 condition은 무시됩니다.',
}).refine((data) => {
  // MultiConditionRule의 conditions 배열은 최소 1개 이상의 조건이 필요합니다.
  if (data.conditions && data.conditions.conditions.length === 0) {
    return false;
  }
  return true;
}, {
  message: 'MultiConditionRule의 conditions 배열은 최소 1개 이상의 조건이 필요합니다.',
});

/**
 * Form Schema Validator
 */
export const formSchemaValidator = schemaVersionBase.extend({
  form: z.object({
    layout: layoutSchema.optional(),
    fields: z.array(formFieldSchema),
    submit: z.object({
      labelKey: z.string().optional(),  // SDUI v1.1
      label: z.string().optional(),  // 하위 호환성
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    }).optional(),
  }),
});

/**
 * Table Column Schema Validator
 * 
 * SDUI v1.1: i18n 지원, width를 number로 변경
 */
const tableColumnSchema = z.object({
  key: z.string().min(1),
  labelKey: z.string().optional(),  // SDUI v1.1
  label: z.string().optional(),  // 하위 호환성
  width: z.union([z.number(), z.string()]).optional(),  // SDUI v1.1: number 지원
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),  // SDUI v1.1
  type: z.enum(['text', 'number', 'date', 'tag', 'badge', 'custom']).optional(),  // SDUI v1.1
  render: z.enum(['text', 'date', 'number', 'currency', 'custom']).optional(),  // 하위 호환성
}).refine((data) => {
  // labelKey 또는 label 중 하나는 필수
  return !!(data.labelKey || data.label);
}, {
  message: 'labelKey 또는 label 중 하나는 필수입니다.',
});
export const tableSchemaValidator = schemaVersionBase.extend({
  table: z.object({
    dataSource: z.object({  // SDUI v1.1: API 기반 ?�이???�스
      type: z.literal('api'),
      endpoint: z.string().min(1),
      method: z.enum(['GET', 'POST']).optional(),
    }),
    columns: z.array(tableColumnSchema),
    rowActions: z.array(z.string()).optional(),  // SDUI v1.1
    bulkActions: z.array(z.string()).optional(),  // SDUI v1.1
    pagination: z.object({
      pageSizeOptions: z.array(z.number()).optional(),  // SDUI v1.1
      defaultPageSize: z.number().min(1).optional(),  // SDUI v1.1
      pageSize: z.number().min(1).optional(),  // 하위 호환성
    }).optional(),
    selection: z.enum(['none', 'single', 'multiple']).optional(),  // SDUI v1.1
    virtualization: z.boolean().optional(),
  }),
});

/**
 * Schema Validator
 * 
 * [불�? 규칙] ?�행 ?�드 존재??검�??�함
 */
export function validateSchema(schema: unknown): {
  valid: boolean;
  errors?: z.ZodError;
} {
  try {
    // Form Schema 검증 시도
    const parsed = formSchemaValidator.parse(schema) as FormSchema;
    
    // condition과 conditions 충돌 검사
    // 참조 필드 존재 검사: condition/conditions에서 참조하는 필드가 스키마에 반드시 존재해야 함
    const fieldNames = new Set(parsed.form.fields.map((f) => f.name));
    const missingFields: string[] = [];
    const conditionConflictFields: string[] = [];
    const selfReferentialFields: string[] = [];
    const validateFunctionFields: string[] = [];
    
    for (const field of parsed.form.fields) {
      // 중요: condition과 conditions를 동시에 사용할 수 없습니다.
      // conditions가 있는 경우 condition은 금지됩니다.
      if (field.condition && field.conditions) {
        conditionConflictFields.push(`필드 "${field.name}"에서 condition과 conditions를 동시에 사용할 수 없습니다. conditions가 있는 경우 condition은 금지됩니다.`);
      }
      
      // ⚠️ 중요: validate 함수는 Registry 기반 스키마에서 사용 불가
      // Registry에 저장되는 스키마는 JSONB이므로 함수를 직렬화할 수 없음
      if (field.validation?.validate && typeof field.validation.validate === 'function') {
        validateFunctionFields.push(`필드 "${field.name}": validate 함수는 Registry 기반 스키마에서 사용할 수 없습니다. fallbackSchema(로컬 TypeScript 파일) 전용입니다.`);
      }
      
      // 단일 조건 검사
      if (field.condition) {
        if (!fieldNames.has(field.condition.field)) {
          missingFields.push(`필드 "${field.name}"의 condition이 참조하는 필드 "${field.condition.field}"가 스키마에 존재하지 않습니다.`);
        }
        
        // setValue self-referential 검증
        const referencedFields = new Set([field.condition.field]);
        if (field.condition.then?.setValue !== undefined || field.condition.else?.setValue !== undefined) {
          if (referencedFields.has(field.name)) {
            selfReferentialFields.push(`필드 "${field.name}": setValue 대상 필드가 condition에서 참조하는 필드와 동일합니다. self-referential setValue는 금지됩니다.`);
          }
        }
      }
      
      // 복수 조건 검사
      if (field.conditions) {
        const referencedFields = new Set<string>();
        for (const rule of field.conditions.conditions) {
          if (!fieldNames.has(rule.field)) {
            missingFields.push(`필드 "${field.name}"의 conditions가 참조하는 필드 "${rule.field}"가 스키마에 존재하지 않습니다.`);
          }
          referencedFields.add(rule.field);
        }
        
        // setValue self-referential 검증
        if (field.conditions.then?.setValue !== undefined || field.conditions.else?.setValue !== undefined) {
          if (referencedFields.has(field.name)) {
            selfReferentialFields.push(`필드 "${field.name}": setValue 대상 필드가 conditions에서 참조하는 필드와 동일합니다. self-referential setValue는 금지됩니다.`);
          }
        }
      }
    }
    
    if (conditionConflictFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: conditionConflictFields.join(' '),
          },
        ]),
      };
    }
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: missingFields.join(' '),
          },
        ]),
      };
    }
    
    if (selfReferentialFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: selfReferentialFields.join(' '),
          },
        ]),
      };
    }
    
    if (validateFunctionFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: validateFunctionFields.join(' '),
          },
        ]),
      };
    }
    
    return { valid: true };
  } catch (formError) {
    if (formError instanceof z.ZodError) {
      // Table Schema 검�??�도
      // Table Schema 검증 시도
      try {
        tableSchemaValidator.parse(schema);
        return { valid: true };
      } catch (tableError) {
        if (tableError instanceof z.ZodError) {
          return {
            valid: false,
            errors: tableError,
          };
        }
      }
    }
    return {
      valid: false,
      errors: formError as z.ZodError,
    };
  }
}

/**
 * Schema Version 체크
 * 
 * SDUI v1.1: minClient를 사용하여 클라이언트 버전 호환성 체크
 */
export function checkSchemaVersion(
  schema: SchemaVersion,
  clientVersion: string
): {
  compatible: boolean;
  requiresUpdate?: boolean;
  requiresMigration?: boolean;
} {
  // SDUI v1.1: minClient�??�용?�여 ?�라?�언??버전�?비교
  // SDUI v1.1: minClient를 사용하여 클라이언트 버전을 비교
  const minClientVersion = schema.minClient || schema.minSupportedClient;
  if (!minClientVersion) {
    // minClient가 없으면 호환 가능하다고 간주 (하위 호환성)
    return { compatible: true };
  }

  const [minClientMajor, minClientMinor] = minClientVersion.split('.').map(Number);
  const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);

  // ?�라?�언??버전??minClient보다 ??���??�데?�트 ?�요
  // 클라이언트 버전이 minClient보다 낮으면 업데이트 필요
  if (clientMajor < minClientMajor || (clientMajor === minClientMajor && clientMinor < minClientMinor)) {
    return {
      compatible: false,
      requiresUpdate: true,
      requiresMigration: false,  // minClient 체크??Migration�?무�?
    };
  }

  // 호환 가능
  return { compatible: true };
}














