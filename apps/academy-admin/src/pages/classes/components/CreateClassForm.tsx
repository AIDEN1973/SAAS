/**
 * CreateClassForm Component
 *
 * [업종중립] 수업 등록 폼 (학원/피트니스 등)
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Schema Form actions 비활성화하여 직접 처리
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 */

import { useCallback, useRef, useEffect } from 'react';
import { SchemaForm } from '@schema-engine';
import { useToast } from '@ui-core/react';
import { apiClient } from '@api-sdk/core';
import type { FormSchema } from '@schema-engine/types';
import type { CreateClassInput, DayOfWeek, ClassStatus } from '@services/class-service';

export interface CreateClassFormProps {
  onClose?: () => void;
  onSubmit: (data: CreateClassInput) => Promise<void>;
  effectiveFormSchema: FormSchema;
  onSubmitTrigger?: (triggerSubmit: () => void) => void;
}

export const CreateClassForm = ({
  onSubmit,
  effectiveFormSchema,
  onSubmitTrigger,
}: CreateClassFormProps) => {
  // onClose is unused but kept for API compatibility
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    // 스키마에서 받은 데이터를 CreateClassInput 형식으로 변환
    // subject: 직접입력 선택 시 subject_custom 값 사용
    const subjectValue = data.subject === '__custom__'
      ? (data.subject_custom ? String(data.subject_custom) : undefined)
      : (data.subject ? String(data.subject) : undefined);

    const input: CreateClassInput = {
      name: String(data.name ?? ''),
      subject: subjectValue,
      // grade: 배열 또는 단일 값 지원
      grade: data.grade && Array.isArray(data.grade) && data.grade.length > 0
        ? data.grade
        : data.grade
        ? String(data.grade)
        : undefined,
      // day_of_week: 배열 또는 단일 값 지원
      day_of_week: data.day_of_week && Array.isArray(data.day_of_week) && data.day_of_week.length > 0
        ? data.day_of_week as DayOfWeek[]
        : data.day_of_week
        ? data.day_of_week as DayOfWeek
        : undefined,
      start_time: data.start_time ? String(data.start_time) : undefined,
      end_time: data.end_time ? String(data.end_time) : undefined,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      status: (data.status || 'active') as ClassStatus,
      teacher_ids: data.teacher_ids && Array.isArray(data.teacher_ids) && data.teacher_ids.length > 0
        ? data.teacher_ids
        : undefined,
    };
    await onSubmit(input);
  }, [onSubmit]);

  // Expose submit trigger to parent
  useEffect(() => {
    if (onSubmitTrigger) {
      onSubmitTrigger(() => {
        const form = formRef.current?.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      });
    }
  }, [onSubmitTrigger]);

  return (
    <div
      ref={formRef}
      style={{
        width: 'var(--width-full)',
      }}
    >
      {/* [SSOT] CSS 변수 기반 스타일 - Modal 내부에서 Card 테두리/패딩 제거 */}
      <style>
        {`
          .schema-form-no-border {
            border: none !important;
            box-shadow: var(--shadow-none) !important;
            padding: var(--spacing-none) !important;
            background-color: transparent !important;
          }
          .schema-form-no-border > div {
            padding: var(--spacing-none) !important;
          }
          .schema-form-no-border form {
            padding: var(--spacing-none) !important;
          }
        `}
      </style>
      <SchemaForm
        schema={{
          ...effectiveFormSchema,
          form: {
            ...effectiveFormSchema.form,
            // [불변 규칙] Modal footer에 버튼이 있으므로 내부 submit 버튼 제거
            submit: undefined,
            // [불변 규칙] actions 비활성화하여 직접 처리
            actions: [],
          },
          actions: [],
        }}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
        className="schema-form-no-border"
        disableCardPadding={true}
        cardStyle={{
          border: 'none',
          boxShadow: 'none',
          padding: 0,
          backgroundColor: 'transparent',
        }}
        cardVariant="elevated"
        actionContext={{
          apiCall: async (endpoint: string, method: string, body?: unknown) => {
            const endpointNoSlash = endpoint.replace(/^\//, '');
            const endpointPath = endpointNoSlash.split('?')[0];
            const endpointBase = endpointPath.split('/')[0];

            const allowedEndpoints = ['classes', 'teachers', 'class_teachers'];
            if (!allowedEndpoints.includes(endpointBase)) {
              throw new Error(`허용되지 않은 endpoint: ${endpoint}`);
            }

            const hasQuery = endpointNoSlash.includes('?');
            if (hasQuery && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
              throw new Error(`쿼리스트링이 포함된 쓰기 요청은 허용하지 않습니다: ${endpoint}`);
            }

            switch (method.toUpperCase()) {
              case 'POST':
                {
                  const resourceOnly = endpointPath;
                  const response = await apiClient.post(resourceOnly, body as Record<string, unknown>);
                  if (response.error) {
                    throw new Error(response.error.message);
                  }
                  return response.data;
                }
              case 'PATCH':
              case 'PUT':
                {
                  const parts = endpointPath.split('/').filter(Boolean);
                  if (parts.length !== 2) {
                    throw new Error(`잘못된 endpoint 형식입니다 (resource/id만 허용): ${endpoint}`);
                  }
                  const [resource, id] = parts;
                  const response = await apiClient.patch(resource, id, body as Record<string, unknown>);
                  if (response.error) {
                    throw new Error(response.error.message);
                  }
                  return response.data;
                }
              case 'DELETE':
                {
                  const parts = endpointPath.split('/').filter(Boolean);
                  if (parts.length !== 2) {
                    throw new Error(`잘못된 endpoint 형식입니다 (resource/id만 허용): ${endpoint}`);
                  }
                  const [resource, id] = parts;
                  const response = await apiClient.delete(resource, id);
                  if (response.error) {
                    throw new Error(response.error.message);
                  }
                  return response.data;
                }
              case 'GET':
              default:
                {
                  throw new Error('GET은 Schema actionContext에서 허용하지 않습니다. 데이터 조회는 useQuery/useMutation을 사용하세요.');
                }
            }
          },
          showToast: (message: string, variant?: string) => {
            const toastVariant = variant === 'success' ? 'success' : variant === 'error' ? 'error' : variant === 'warning' ? 'warning' : 'info';
            toast(message, toastVariant);
          },
        }}
      />
    </div>
  );
};
