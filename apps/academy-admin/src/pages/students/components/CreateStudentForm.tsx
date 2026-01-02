/**
 * CreateStudentForm Component
 *
 * 학생 등록 폼
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Schema Form actions 비활성화하여 직접 처리
 */

import React, { useState, useCallback } from 'react';
import { SchemaForm } from '@schema-engine';
import { useToast, useResponsiveMode, isMobile, isTablet, Button } from '@ui-core/react';
import { apiClient } from '@api-sdk/core';
import type { FormSchema } from '@schema-engine/types';
import type { CreateStudentInput, Gender, StudentStatus } from '@services/student-service';

export interface CreateStudentFormProps {
  onClose: () => void;
  onSubmit: (data: CreateStudentInput) => Promise<void>;
  effectiveFormSchema: FormSchema;
}

export const CreateStudentForm: React.FC<CreateStudentFormProps> = ({
  onClose,
  onSubmit,
  effectiveFormSchema,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const input: CreateStudentInput = {
        name: String(data.name ?? ''),
        birth_date: data.birth_date ? String(data.birth_date) : undefined,
        gender: data.gender ? (data.gender as Gender) : undefined,
        phone: data.phone ? String(data.phone) : undefined,
        email: data.email ? String(data.email) : undefined,
        address: data.address ? String(data.address) : undefined,
        school_name: data.school_name ? String(data.school_name) : undefined,
        grade: data.grade ? String(data.grade) : undefined,
        status: (data.status || 'active') as StudentStatus,
        notes: data.notes ? String(data.notes) : undefined,
      };
      await onSubmit(input);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const showHeader = !isMobileMode && !isTabletMode;
  const isInDrawer = isMobileMode || isTabletMode;

  return (
    <div style={showHeader ? { marginBottom: 'var(--spacing-md)' } : {}}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>학생 등록</h3>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            닫기
          </Button>
        </div>
      )}
      <SchemaForm
        schema={{
          ...effectiveFormSchema,
          form: {
            ...effectiveFormSchema.form,
            actions: [],
          },
          actions: [],
        }}
        onSubmit={handleSubmit}
        defaultValues={{
          status: 'active',
        }}
        disableCardPadding={isInDrawer}
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
