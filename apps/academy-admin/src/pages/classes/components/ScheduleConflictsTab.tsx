/**
 * 일정 충돌 탭 컴포넌트
 * 강사/강의실 중복 일정을 탐지하고 표시
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { Card, NotificationCardLayout } from '@ui-core/react';
import { BookOpen, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useClasses, useTeachers } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { DAYS_OF_WEEK } from '../constants';
import { CardGridLayout } from '../../../components/CardGridLayout';
import type { Class } from '@services/class-service';

export function ScheduleConflictsTab() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});
  const { data: teachers } = useTeachers();
  void teachers; // [Deferred] 강사별 충돌 탐지 기능 구현 시 사용

  // 충돌 탐지
  const conflicts = useMemo(() => {
    if (!allClasses || allClasses.length === 0) return [];

    const detectedConflicts: Array<{
      id: string;
      type: 'room' | 'teacher' | 'time';
      message: string;
      classes: Class[];
      severity: 'warning' | 'error';
    }> = [];

    // 각 요일별로 분석
    DAYS_OF_WEEK.forEach(day => {
      const dayClasses = allClasses.filter(c => c.day_of_week === day.value && c.status === 'active');

      // 모든 수업 쌍 비교
      for (let i = 0; i < dayClasses.length; i++) {
        for (let j = i + 1; j < dayClasses.length; j++) {
          const class1 = dayClasses[i];
          const class2 = dayClasses[j];

          // 시간 겹침 확인
          const timeOverlap = class1.start_time < class2.end_time && class2.start_time < class1.end_time;

          if (timeOverlap) {
            // 강의실 충돌
            if (class1.room && class2.room && class1.room === class2.room) {
              detectedConflicts.push({
                id: `room-${class1.id}-${class2.id}`,
                type: 'room',
                message: `${day.label} ${class1.start_time}~${class1.end_time}: "${class1.name}"과 "${class2.name}"이 같은 강의실(${class1.room})에서 중복됩니다.`,
                classes: [class1, class2],
                severity: 'error',
              });
            }

            // 시간대 겹침 경고 (같은 시간에 여러 수업)
            const conflictId = `time-${day.value}-${class1.id}-${class2.id}`;
            if (!detectedConflicts.some(c => c.id === conflictId)) {
              detectedConflicts.push({
                id: conflictId,
                type: 'time',
                message: `${day.label} ${class1.start_time}~${class1.end_time}: "${class1.name}"과 "${class2.name}"의 시간이 겹칩니다.`,
                classes: [class1, class2],
                severity: 'warning',
              });
            }
          }
        }
      }
    });

    return detectedConflicts;
  }, [allClasses]);

  if (isLoading) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  const errorConflicts = conflicts.filter(c => c.severity === 'error');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 요약 카드 */}
      <CardGridLayout
        cards={[
          <NotificationCardLayout
            key="total"
            icon={<AlertTriangle />}
            title="전체 충돌"
            value={conflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={conflicts.length > 0 ? 'var(--color-warning-50)' : 'var(--color-success-50)'}
          />,
          <NotificationCardLayout
            key="error"
            icon={<XCircle />}
            title="심각한 충돌"
            value={errorConflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={errorConflicts.length > 0 ? 'var(--color-error-50)' : 'var(--color-gray-100)'}
          />,
          <NotificationCardLayout
            key="warning"
            icon={<AlertTriangle />}
            title="경고"
            value={warningConflicts.length}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor={warningConflicts.length > 0 ? 'var(--color-warning-50)' : 'var(--color-gray-100)'}
          />,
          <NotificationCardLayout
            key="classes"
            icon={<BookOpen />}
            title={`활성 ${terms.GROUP_LABEL}`}
            value={allClasses?.filter(c => c.status === 'active').length || 0}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-primary-50)"
          />,
        ]}
        desktopColumns={4}
        tabletColumns={2}
        mobileColumns={2}
      />

      {/* 충돌 목록 */}
      {conflicts.length === 0 ? (
        <Card padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <CheckCircle style={{ width: '48px', height: '48px', color: 'var(--color-success)', marginBottom: 'var(--spacing-md)' }} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
              충돌 없음
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              현재 활성화된 {terms.GROUP_LABEL} 일정에 충돌이 없습니다.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 심각한 충돌 (강의실 중복) */}
          {errorConflicts.length > 0 && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', color: 'var(--color-error)' }}>
                심각한 충돌 ({errorConflicts.length}건)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {errorConflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-error-50)',
                      borderLeft: 'var(--border-width-thick) solid var(--color-error)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                      {conflict.type === 'room' ? '강의실 충돌' : conflict.type === 'teacher' ? '강사 충돌' : '시간 충돌'}
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {conflict.message}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                      {conflict.classes.map(c => (
                        <span
                          key={c.id}
                          style={{
                            padding: 'var(--spacing-2xs) var(--spacing-xs)',
                            backgroundColor: c.color || 'var(--color-gray-200)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 경고 (시간 겹침) */}
          {warningConflicts.length > 0 && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', color: 'var(--color-warning)' }}>
                시간 중복 경고 ({warningConflicts.length}건)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {warningConflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-warning-50)',
                      borderLeft: 'var(--border-width-thick) solid var(--color-warning)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {conflict.message}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                      {conflict.classes.map(c => (
                        <span
                          key={c.id}
                          style={{
                            padding: 'var(--spacing-2xs) var(--spacing-xs)',
                            backgroundColor: c.color || 'var(--color-gray-200)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
