/**
 * useIndustryTranslations Hook Unit Tests
 *
 * Test scope:
 * - collectLabelKeys: collects all label/description/placeholder/tooltip/option keys from schema
 * - useIndustryTranslations: returns industry-translated label map from schema
 * - Edge cases: null/undefined schema, non-form schema, empty fields
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FormSchema } from '@schema-engine';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@industry/academy', () => ({
  getAcademyLabelFromI18n: vi.fn((key: string) => {
    const labels: Record<string, string> = {
      'student.name': '학생 이름',
      'student.phone': '전화번호',
      'student.grade': '학년',
      'common.submit': '저장',
      'student.status.active': '재원',
      'student.status.inactive': '퇴원',
      'student.name.description': '학생의 전체 이름을 입력하세요',
      'student.name.placeholder': '이름을 입력하세요',
      'student.name.tooltip': '학생의 실명을 입력합니다',
    };
    return labels[key] || key;
  }),
}));

// ============================================================================
// Import (after mocks)
// ============================================================================

import { useIndustryTranslations } from '../useIndustryTranslations';

// ============================================================================
// Test Helpers
// ============================================================================

function createFormSchema(overrides?: Partial<FormSchema>): FormSchema {
  return {
    type: 'form',
    version: '1.0.0',
    entity: 'student',
    form: {
      fields: [
        {
          key: 'name',
          type: 'text',
          ui: {
            labelKey: 'student.name',
          },
        },
        {
          key: 'phone',
          type: 'text',
          ui: {
            labelKey: 'student.phone',
          },
        },
      ],
    },
    ...overrides,
  } as FormSchema;
}

// ============================================================================
// Tests
// ============================================================================

describe('useIndustryTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object for null schema', () => {
    const { result } = renderHook(() => useIndustryTranslations(null));
    expect(result.current).toEqual({});
  });

  it('returns empty object for undefined schema', () => {
    const { result } = renderHook(() => useIndustryTranslations(undefined));
    expect(result.current).toEqual({});
  });

  it('returns empty object for non-form schema type', () => {
    const tableSchema = { type: 'table', version: '1.0.0', entity: 'student' } as unknown as FormSchema;
    const { result } = renderHook(() => useIndustryTranslations(tableSchema));
    expect(result.current).toEqual({});
  });

  it('returns empty object for form schema without form field', () => {
    const schema = { type: 'form', version: '1.0.0', entity: 'student' } as FormSchema;
    const { result } = renderHook(() => useIndustryTranslations(schema));
    expect(result.current).toEqual({});
  });

  it('collects and translates labelKeys from form fields', () => {
    const schema = createFormSchema();
    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current).toEqual({
      'student.name': '학생 이름',
      'student.phone': '전화번호',
    });
  });

  it('collects descriptionKey, placeholderKey, and tooltipKey', () => {
    const schema = createFormSchema({
      form: {
        fields: [
          {
            key: 'name',
            type: 'text',
            ui: {
              labelKey: 'student.name',
              descriptionKey: 'student.name.description',
              placeholderKey: 'student.name.placeholder',
              tooltipKey: 'student.name.tooltip',
            },
          },
        ],
      },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current).toEqual({
      'student.name': '학생 이름',
      'student.name.description': '학생의 전체 이름을 입력하세요',
      'student.name.placeholder': '이름을 입력하세요',
      'student.name.tooltip': '학생의 실명을 입력합니다',
    });
  });

  it('collects labelKeys from field options', () => {
    const schema = createFormSchema({
      form: {
        fields: [
          {
            key: 'status',
            type: 'select',
            ui: { labelKey: 'student.grade' },
            options: [
              { value: 'active', labelKey: 'student.status.active' },
              { value: 'inactive', labelKey: 'student.status.inactive' },
            ],
          },
        ],
      },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current['student.status.active']).toBe('재원');
    expect(result.current['student.status.inactive']).toBe('퇴원');
  });

  it('collects submit button labelKey', () => {
    const schema = createFormSchema({
      form: {
        fields: [],
        submit: { labelKey: 'common.submit' },
      },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current['common.submit']).toBe('저장');
  });

  it('returns empty translations for form with no fields', () => {
    const schema = createFormSchema({
      form: { fields: [] },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current).toEqual({});
  });

  it('deduplicates keys when same labelKey appears multiple times', () => {
    const schema = createFormSchema({
      form: {
        fields: [
          { key: 'name1', type: 'text', ui: { labelKey: 'student.name' } },
          { key: 'name2', type: 'text', ui: { labelKey: 'student.name' } },
        ],
      },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    // Should contain the key only once
    expect(Object.keys(result.current)).toHaveLength(1);
    expect(result.current['student.name']).toBe('학생 이름');
  });

  it('handles fields without ui property gracefully', () => {
    const schema = createFormSchema({
      form: {
        fields: [
          { key: 'raw_field', type: 'text' },
          { key: 'name', type: 'text', ui: { labelKey: 'student.name' } },
        ],
      },
    } as Partial<FormSchema>);

    const { result } = renderHook(() => useIndustryTranslations(schema));

    expect(result.current).toEqual({
      'student.name': '학생 이름',
    });
  });
});
