/**
 * Quick Action Card 컴포넌트
 *
 * 빠른 액션 카드 (학생 등록, 일괄 등록, 학생 목록 보기, 상담 기록 작성, 출결 체크)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 공통 컴포넌트 사용 (ActionButtonGroup)
 */

import React from 'react';
import { Card, ActionButtonGroup } from '@ui-core/react';
import { UserPlus, Upload, List, MessageSquare, ClipboardCheck } from 'lucide-react';
import type { ActionButtonItem } from '@ui-core/react';

export interface QuickActionCardProps {
  onAction?: (action: 'register' | 'bulk' | 'list' | 'consultation' | 'attendance') => void;
}

export function QuickActionCard({ onAction }: QuickActionCardProps) {
  const actionItems: ActionButtonItem[] = [
    {
      key: 'register',
      label: '학생 등록',
      icon: <UserPlus />,
      onClick: () => onAction?.('register'),
      variant: 'outline',
    },
    {
      key: 'bulk',
      label: '일괄 등록',
      icon: <Upload />,
      onClick: () => onAction?.('bulk'),
      variant: 'outline',
    },
    {
      key: 'list',
      label: '학생 목록',
      icon: <List />,
      onClick: () => onAction?.('list'),
      variant: 'outline',
    },
    {
      key: 'consultation',
      label: '상담 기록',
      icon: <MessageSquare />,
      onClick: () => onAction?.('consultation'),
      variant: 'outline',
    },
    {
      key: 'attendance',
      label: '출결 체크',
      icon: <ClipboardCheck />,
      onClick: () => onAction?.('attendance'),
      variant: 'outline',
    },
  ];

  return (
    <Card
      padding="md"
      variant="default"
      disableHoverEffect={true}
    >
      <h3 style={{
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--spacing-md)',
        color: 'var(--color-text)',
      }}>
        빠른 액션
      </h3>
      <ActionButtonGroup
        items={actionItems}
        gap="sm"
        marginTop="none"
      />
    </Card>
  );
}

