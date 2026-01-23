/**
 * Quick Action Card 컴포넌트
 *
 * 빠른 액션 카드 (학생 등록, 일괄 등록, 학생 목록 보기, 상담 기록 작성, 출결 체크)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 공통 컴포넌트 사용 (ActionButtonGroup)
 * [SSOT] useIndustryTerms로 동적 라벨 사용
 */

import React from 'react';
import { Card, ActionButtonGroup } from '@ui-core/react';
import { UserPlus, Upload, List, MessageSquare, ClipboardCheck } from 'lucide-react';
import type { ActionButtonItem } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';

export interface QuickActionCardProps {
  onAction?: (action: 'register' | 'bulk' | 'list' | 'consultation' | 'attendance') => void;
}

export function QuickActionCard({ onAction }: QuickActionCardProps) {
  const terms = useIndustryTerms();
  const personLabel = terms.PERSON_LABEL_PRIMARY;

  const actionItems: ActionButtonItem[] = [
    {
      key: 'register',
      label: `${personLabel} 등록`,
      icon: <UserPlus />,
      onClick: () => onAction?.('register'),
      variant: 'solid',
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
      label: `${personLabel} 목록`,
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
      padding="lg"
      disableHoverEffect={true}
    >
      <ActionButtonGroup
        items={actionItems}
        gap="md"
        marginTop="none"
      />
    </Card>
  );
}
