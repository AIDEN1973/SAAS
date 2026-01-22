/**
 * TeacherForm Component (통합 컴포넌트)
 *
 * [업종중립] 강사 등록/수정 폼 (강사/트레이너 등)
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Schema Form actions 비활성화하여 직접 처리
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [통합] mode prop으로 create/edit 구분
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { SchemaForm } from '@schema-engine';
import { useToast } from '@ui-core/react';
import { apiClient } from '@api-sdk/core';
import type { FormSchema, FormFieldSchema } from '@schema-engine/types';
import { teacherFormSchema } from '../../../schemas/teacher.schema';
import { useTeacher } from '@hooks/use-class';

export type TeacherFormMode = 'create' | 'edit';

export interface TeacherFormProps {
  mode: TeacherFormMode;
  teacherId?: string; // edit 모드에서 필수
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onSubmitTrigger?: (triggerSubmit: () => void) => void;
}

export const TeacherForm = ({
  mode,
  teacherId,
  onSubmit,
  onSubmitTrigger,
}: TeacherFormProps) => {
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);

  // edit 모드에서만 강사 데이터 조회
  const { data: teacher, isLoading } = useTeacher(mode === 'edit' ? teacherId ?? null : null);

  // mode에 따라 스키마 조정 (비밀번호 필드 validation)
  const effectiveFormSchema = useMemo<FormSchema>(() => {
    if (mode === 'create') {
      return teacherFormSchema;
    }

    // edit 모드: 비밀번호 필드 validation 제거 (선택 입력)
    const editFields = teacherFormSchema.form.fields.map((field: FormFieldSchema) => {
      if (field.name === 'password') {
        return {
          ...field,
          ui: {
            ...field.ui,
            placeholder: '변경할 비밀번호 입력',
            description: '변경하지 않으려면 비워두세요',
          },
          validation: undefined, // required, minLength 제거
        };
      }
      if (field.name === 'password_confirm') {
        return {
          ...field,
          ui: {
            ...field.ui,
            placeholder: '비밀번호 재입력',
            description: '비밀번호를 변경할 경우에만 입력',
          },
          validation: undefined, // required, minLength 제거
        };
      }
      return field;
    });

    return {
      ...teacherFormSchema,
      form: {
        ...teacherFormSchema.form,
        fields: editFields,
        submit: {
          ...teacherFormSchema.form.submit,
          label: '수정',
        },
      },
    };
  }, [mode]);

  // defaultValues 설정
  const defaultValues = useMemo(() => {
    if (mode === 'create') {
      return {
        status: 'active',
        position: 'teacher',
      };
    }

    // edit 모드: 강사 데이터로 초기화
    if (!teacher) return {};

    return {
      position: teacher.position || '',
      name: teacher.name || '',
      phone: teacher.phone || '',
      login_id: teacher.login_id || '',
      email: teacher.email || '',
      employee_id: teacher.employee_id || '',
      specialization: teacher.specialization || '',
      hire_date: teacher.hire_date || '',
      status: teacher.status,
      profile_image: teacher.profile_image_url || undefined,
      bio: teacher.bio || '',
      notes: teacher.notes || '',
      pay_type: teacher.pay_type || '',
      base_salary: teacher.base_salary || 0,
      hourly_rate: teacher.hourly_rate || 0,
      bank_name: teacher.bank_name || '',
      bank_account: teacher.bank_account || '',
      salary_notes: teacher.salary_notes || '',
    };
  }, [mode, teacher]);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    // profile_image (File 객체)를 그대로 전달하여 상위에서 업로드 처리
    await onSubmit(data);
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

  // edit 모드에서 로딩 중
  if (mode === 'edit' && isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        로딩 중...
      </div>
    );
  }

  // edit 모드에서 데이터를 찾을 수 없음
  if (mode === 'edit' && !teacher) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        데이터를 찾을 수 없습니다.
      </div>
    );
  }

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
        defaultValues={defaultValues}
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

            const allowedEndpoints = ['teachers', 'academy_teachers', 'persons'];
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
