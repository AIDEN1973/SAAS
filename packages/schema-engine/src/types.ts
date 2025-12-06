/**
 * Schema Types
 * 
 * [불변 규칙] 스키마는 논리적 구조만 포함, Tailwind 클래스 문자열 사용 금지
 */

import { SpacingToken, ColorToken, SizeToken } from '@design-system/core';

/**
 * Schema Version
 */
export interface SchemaVersion {
  version: string;
  minSupportedClient: string;
  entity: string;
}

/**
 * Layout Schema
 * [불변 규칙] Tailwind 클래스 문자열 사용 금지, props 기반 전달
 */
export interface LayoutSchema {
  columns?: 1 | 2 | 3 | 4;
  columnGap?: SpacingToken;
  rowGap?: SpacingToken;
}

/**
 * Form Field Schema
 */
export interface FormFieldSchema {
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  options?: Array<{ label: string; value: string }>;
  size?: SizeToken;
  layout?: LayoutSchema;
}

/**
 * Form Schema
 */
export interface FormSchema extends SchemaVersion {
  form: {
    layout?: LayoutSchema;
    fields: FormFieldSchema[];
    submit?: {
      label: string;
      variant?: 'solid' | 'outline' | 'ghost';
      color?: ColorToken;
      size?: SizeToken;
    };
  };
}

/**
 * Table Column Schema
 */
export interface TableColumnSchema {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: 'text' | 'date' | 'number' | 'currency' | 'custom';
}

/**
 * Table Schema
 */
export interface TableSchema extends SchemaVersion {
  table: {
    columns: TableColumnSchema[];
    pagination?: {
      pageSize: number;
    };
    virtualization?: boolean;
  };
}

/**
 * UI Schema (통합)
 */
export type UISchema = FormSchema | TableSchema;

