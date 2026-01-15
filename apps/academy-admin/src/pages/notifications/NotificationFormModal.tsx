/**
 * Notification Form Modal/Drawer Component
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] 메시지 발송 폼 UI 컴포넌트 (재사용)
 *
 * P2-2 개선: NotificationsPage의 중복 폼 제거
 * - "history" 탭과 "send" 탭에서 동일한 폼이 중복 정의되어 있었음
 * - 별도 컴포넌트로 추출하여 재사용성 향상
 *
 * @see NotificationsPage.tsx - 메시지 발송 폼 사용처
 */

import React from 'react';
import { Modal, Drawer } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import type { FormSchema } from '@schema-engine';
import { apiClient } from '@api-sdk/core';

export interface NotificationFormModalProps {
  /** 폼 표시 여부 */
  isOpen: boolean;
  /** 폼 닫기 핸들러 */
  onClose: () => void;
  /** 폼 제출 핸들러 */
  onSubmit: (data: Record<string, unknown>) => void;
  /** 스키마 정의 */
  schema: FormSchema;
  /** 기본값 (AI 초안 등) */
  defaultValues?: Record<string, unknown> | null;
  /** 폼 타이틀 */
  title: string;
  /** 반응형 모드 */
  isMobileMode: boolean;
  isTabletMode: boolean;
  /** Alert 표시 함수 */
  showAlert: (message: string, title: string) => void;
}

/**
 * Notification Form Modal/Drawer
 *
 * 반응형:
 * - 모바일: Bottom Drawer
 * - 태블릿: Right Drawer
 * - 데스크톱: Modal
 */
export const NotificationFormModal: React.FC<NotificationFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  schema,
  defaultValues,
  title,
  isMobileMode,
  isTabletMode,
  showAlert,
}) => {
  // actionContext 공통 로직
  const actionContext = {
    apiCall: async (endpoint: string, method: string, body?: unknown) => {
      if (method === 'POST') {
        const response = await apiClient.post(endpoint, body as Record<string, unknown>);
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      }
      const response = await apiClient.get(endpoint);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    showToast: (message: string, variant?: string) => {
      showAlert(
        message,
        variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림'
      );
    },
  };

  // 모바일/태블릿: Drawer
  if (isMobileMode || isTabletMode) {
    return (
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        position={isMobileMode ? 'bottom' : 'right'}
        width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
      >
        <SchemaForm
          schema={schema}
          onSubmit={onSubmit}
          defaultValues={defaultValues || {}}
          actionContext={actionContext}
        />
      </Drawer>
    );
  }

  // 데스크톱: Modal
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <SchemaForm
        schema={schema}
        onSubmit={onSubmit}
        defaultValues={defaultValues || {}}
        actionContext={actionContext}
      />
    </Modal>
  );
};
