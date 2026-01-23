/**
 * Student Alerts Card 컴포넌트
 *
 * 학생 알림 카드 (위험 학생, 결석 학생, 상담 대기)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 * [SSOT] useIndustryTerms로 동적 라벨 사용
 */

import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { StudentAlerts } from '@hooks/use-student';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_MESSAGES } from '../../constants';

export interface StudentAlertsCardProps {
  alerts: StudentAlerts | undefined;
  isLoading?: boolean;
  onAction?: (type: 'risk' | 'absent' | 'consultation') => void;
}

export function StudentAlertsCard({ alerts, isLoading, onAction }: StudentAlertsCardProps) {
  const terms = useIndustryTerms();
  const personLabel = terms.PERSON_LABEL_PRIMARY;

  const isEmpty = !alerts || isLoading;
  const hasAlerts = !isEmpty && (alerts.risk_count > 0 || alerts.absent_count > 0 || alerts.consultation_pending_count > 0);

  const items = !isEmpty ? [
    ...(alerts.risk_count > 0 ? [{
      label: `위험 ${personLabel}`,
      value: `${alerts.risk_count}명`,
      color: 'var(--color-error)',
    }] : []),
    ...(alerts.absent_count > 0 ? [{
      label: `결석 ${personLabel}`,
      value: `${alerts.absent_count}명`,
      color: 'var(--color-error)',
    }] : []),
    ...(alerts.consultation_pending_count > 0 ? [{
      label: '상담 대기',
      value: `${alerts.consultation_pending_count}건`,
      color: 'var(--color-warning)',
    }] : []),
  ] : [];

  const listContent = isEmpty ? (
    <div style={{
      color: 'var(--color-text-secondary)',
      fontSize: 'var(--font-size-base)',
    }}>
      {EMPTY_MESSAGES.ALERT}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}>
            {item.label}
          </div>
          <div style={{
            fontWeight: 'var(--font-weight-semibold)',
            color: item.color || 'var(--color-text)',
            fontSize: 'var(--font-size-base)',
          }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <NotificationCardLayout
      title={`${personLabel} 알림`}
      isEmpty={isEmpty}
      onClick={() => hasAlerts && onAction?.('risk')}
      borderLeftColor={hasAlerts ? 'var(--color-warning)' : undefined}
      icon={<Bell style={{ width: '100%', height: '100%' }} />}
    >
      {listContent}
    </NotificationCardLayout>
  );
}

