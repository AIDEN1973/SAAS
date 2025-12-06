/**
 * Meta-Schema Validator
 * 
 * [불변 규칙] 스키마 구조는 다음 단계에서 검증:
 * - 개발(local dev)
 * - CI 빌드 단계
 * - 테넌트 배포 시
 * - Schema Registry에 등록 시점
 */

import { z } from 'zod';
import { FormSchema, TableSchema, SchemaVersion } from './types';

/**
 * Schema Version Validator
 */
const schemaVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  minSupportedClient: z.string().regex(/^\d+\.\d+\.\d+$/),
  entity: z.string().min(1),
});

/**
 * Layout Schema Validator
 */
const layoutSchema = z.object({
  columns: z.enum(['1', '2', '3', '4']).optional(),
  columnGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
  rowGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
});

/**
 * Form Field Schema Validator
 */
const formFieldSchema = z.object({
  type: z.enum(['text', 'email', 'password', 'number', 'select', 'textarea', 'checkbox', 'radio']),
  name: z.string().min(1),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
  layout: layoutSchema.optional(),
});

/**
 * Form Schema Validator
 */
export const formSchemaValidator = schemaVersionSchema.extend({
  form: z.object({
    layout: layoutSchema.optional(),
    fields: z.array(formFieldSchema),
    submit: z.object({
      label: z.string(),
      variant: z.enum(['solid', 'outline', 'ghost']).optional(),
      color: z.enum(['primary', 'secondary', 'success', 'warning', 'error', 'info']).optional(),
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    }).optional(),
  }),
});

/**
 * Table Column Schema Validator
 */
const tableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  width: z.string().optional(),
  sortable: z.boolean().optional(),
  render: z.enum(['text', 'date', 'number', 'currency', 'custom']).optional(),
});

/**
 * Table Schema Validator
 */
export const tableSchemaValidator = schemaVersionSchema.extend({
  table: z.object({
    columns: z.array(tableColumnSchema),
    pagination: z.object({
      pageSize: z.number().min(1),
    }).optional(),
    virtualization: z.boolean().optional(),
  }),
});

/**
 * Schema Validator
 */
export function validateSchema(schema: unknown): {
  valid: boolean;
  errors?: z.ZodError;
} {
  try {
    // Form Schema 검증 시도
    formSchemaValidator.parse(schema);
    return { valid: true };
  } catch (formError) {
    if (formError instanceof z.ZodError) {
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
 */
export function checkSchemaVersion(
  schema: SchemaVersion,
  clientVersion: string
): {
  compatible: boolean;
  requiresUpdate?: boolean;
  requiresMigration?: boolean;
} {
  const [schemaMajor, schemaMinor] = schema.version.split('.').map(Number);
  const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);

  // Major 버전 변경: Migration 필요
  if (schemaMajor > clientMajor) {
    return {
      compatible: false,
      requiresUpdate: true,
      requiresMigration: true,
    };
  }

  // Minor 버전 변경: Client 업데이트 필요
  if (schemaMajor === clientMajor && schemaMinor > clientMinor) {
    return {
      compatible: false,
      requiresUpdate: true,
      requiresMigration: false,
    };
  }

  // 호환 가능
  return { compatible: true };
}

