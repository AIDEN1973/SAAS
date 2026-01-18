/**
 * CreateStudentForm Component
 *
 * [업종중립] PERSON 등록 폼 (학생/수강생/회원 등)
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Schema Form actions 비활성화하여 직접 처리
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 */

import { useCallback, useRef, useEffect } from 'react';
import { SchemaForm } from '@schema-engine';
import { useToast } from '@ui-core/react';
import { apiClient } from '@api-sdk/core';
import type { FormSchema } from '@schema-engine/types';
import type { CreateStudentInput, Gender, StudentStatus } from '@services/student-service';

export interface CreateStudentFormProps {
  onClose?: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
  effectiveFormSchema: FormSchema;
  onSubmitTrigger?: (triggerSubmit: () => void) => void;
}

export const CreateStudentForm = ({
  onSubmit,
  effectiveFormSchema,
  onSubmitTrigger,
}: CreateStudentFormProps) => {
  // onClose is unused but kept for API compatibility
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    const input: CreateStudentInput = {
      name: String(data.name ?? ''),
      birth_date: data.birth_date ? String(data.birth_date) : undefined,
      gender: data.gender ? (data.gender as Gender) : undefined,
      phone: data.phone ? String(data.phone) : undefined,
      attendance_number: data.attendance_number ? String(data.attendance_number) : undefined,
      father_phone: data.father_phone ? String(data.father_phone) : undefined,
      mother_phone: data.mother_phone ? String(data.mother_phone) : undefined,
      address: data.address ? String(data.address) : undefined,
      school_name: data.school_name ? String(data.school_name) : undefined,
      grade: data.grade ? String(data.grade) : undefined,
      status: (data.status || 'active') as StudentStatus,
      notes: data.notes ? String(data.notes) : undefined,
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

            const allowedEndpoints = ['students', 'guardians', 'consultations', 'attendance_logs', 'classes', 'tags', 'tag_assignments', 'student_classes'];
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
