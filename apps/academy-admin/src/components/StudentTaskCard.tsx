/**
 * 학생 업무 카드 컴포넌트
 *
 * 아키텍처 문서 3.1.2 섹션 참조
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@ui-core/react';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';

interface StudentTaskCardProps {
  card: StudentTaskCardType;
  onAction?: (card: StudentTaskCardType) => void;
}

const taskTypeIcons: Record<StudentTaskCardType['task_type'], React.ReactNode> = {
  risk: (
    <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  absence: (
    <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  counseling: (
    <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  new_signup: (
    <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
};

const taskTypeColors: Record<StudentTaskCardType['task_type'], { bg: string; text: string; border: string }> = {
  risk: { bg: 'var(--color-red-50)', text: 'var(--color-red-700)', border: 'var(--color-red-200)' },
  absence: { bg: 'var(--color-orange-50)', text: 'var(--color-orange-700)', border: 'var(--color-orange-200)' },
  counseling: { bg: 'var(--color-blue-50)', text: 'var(--color-blue-700)', border: 'var(--color-blue-200)' },
  new_signup: { bg: 'var(--color-green-50)', text: 'var(--color-green-700)', border: 'var(--color-green-200)' },
};

const taskTypeLabels: Record<StudentTaskCardType['task_type'], string> = {
  risk: '이탈 위험',
  absence: '결석',
  counseling: '상담 필요',
  new_signup: '신규 등록',
};

const getPriorityBadgeColor = (priority: number): string => {
  if (priority >= 70) return 'var(--color-red-600)';
  if (priority >= 40) return 'var(--color-orange-600)';
  return 'var(--color-blue-600)';
};

export function StudentTaskCard({ card, onAction }: StudentTaskCardProps) {
  const navigate = useNavigate();
  const typeConfig = taskTypeColors[card.task_type];
  const icon = taskTypeIcons[card.task_type];
  const label = taskTypeLabels[card.task_type];

  const handleAction = () => {
    if (onAction) {
      onAction(card);
    } else {
      navigate(card.action_url);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card
      variant="elevated"
      padding="md"
      style={{
        borderLeft: `var(--border-width-thick) solid ${typeConfig.border}`,
        backgroundColor: typeConfig.bg,
        cursor: 'pointer',
        transition: `transform var(--transition-base), box-shadow var(--transition-base)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'var(--transform-lift)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {/* 헤더: 아이콘 + 우선순위 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <div style={{ color: typeConfig.text }}>{icon}</div>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: typeConfig.text,
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: typeConfig.border,
          }}>
            {label}
          </span>
        </div>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-white)',
          backgroundColor: getPriorityBadgeColor(card.priority),
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderRadius: 'var(--border-radius-sm)',
        }}>
          우선순위 {card.priority}
        </span>
      </div>

      {/* 제목 (최대 2줄) */}
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text)',
        marginBottom: 'var(--spacing-xs)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {card.title}
      </h3>

      {/* 설명 (최대 3줄) */}
      <p style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--spacing-md)',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 'var(--line-height)',
      }}>
        {card.description}
      </p>

      {/* 메타 정보: 학생 이름, 생성 시간 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-secondary)',
      }}>
        {card.student_name && (
          <span>학생: {card.student_name}</span>
        )}
        <span>{formatDate(card.created_at)}</span>
      </div>

      {/* 액션 버튼 */}
      <Button
        variant="solid"
        color="primary"
        fullWidth
        onClick={handleAction}
      >
        처리하기
      </Button>
    </Card>
  );
}

