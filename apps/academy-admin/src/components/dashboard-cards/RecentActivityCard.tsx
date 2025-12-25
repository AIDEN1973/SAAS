/**
 * Recent Activity Card 컴포넌트
 *
 * 최근 활동 카드 (최근 등록된 학생, 최근 상담 기록, 최근 출결 이벤트, 최근 태그 추가/변경)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 */

import React, { useState } from 'react';
import { Card, Button } from '@ui-core/react';
import type { RecentActivity } from '@hooks/use-student';
import { toKST } from '@lib/date-utils';
// [SSOT] Barrel export를 통한 통합 import
import { DATE_FORMATS } from '../../constants';

export interface RecentActivityCardProps {
  activity: RecentActivity | undefined;
  isLoading?: boolean;
  onAction?: (type: 'student' | 'consultation' | 'attendance' | 'tag', id?: string) => void;
}

type ActivityTab = 'students' | 'consultations' | 'attendance' | 'tags';

export function RecentActivityCard({ activity, isLoading, onAction }: RecentActivityCardProps) {
  const isEmpty = !activity || isLoading;
  const [activeTab, setActiveTab] = useState<ActivityTab>('students');

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    return toKST(dateString).format(DATE_FORMATS.SHORT);
  };

  return (
    <Card
      padding="md"
      variant="default"
      style={{
        opacity: isEmpty ? 'var(--opacity-inactive)' : 'var(--opacity-full)',
      }}
      disableHoverEffect={true}
    >
      <h3 style={{
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--spacing-md)',
        color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)',
      }}>
        최근 활동
      </h3>

      {/* 탭 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
        {(['students', 'consultations', 'attendance', 'tags'] as ActivityTab[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            {tab === 'students' && '학생'}
            {tab === 'consultations' && '상담'}
            {tab === 'attendance' && '출결'}
            {tab === 'tags' && '태그'}
          </Button>
        ))}
      </div>

      {/* 활동 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', minHeight: 'var(--spacing-3xl)' }}>
        {isEmpty ? (
          <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
            활동 없음
          </div>
        ) : (
          <>
            {activeTab === 'students' && (
              <>
                {activity.recentStudents.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}>최근 등록된 학생 없음</div>
                ) : (
                  activity.recentStudents.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-xs)',
                        cursor: onAction ? 'pointer' : 'default',
                      }}
                      onClick={() => onAction?.('student', student.id)}
                    >
                      <div style={{
                        color: 'var(--color-text)',
                        fontSize: 'var(--font-size-base)',
                      }}>{student.name}</div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {formatDate(student.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'consultations' && (
              <>
                {activity.recentConsultations.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}>최근 상담 기록 없음</div>
                ) : (
                  activity.recentConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-xs)',
                        cursor: onAction ? 'pointer' : 'default',
                      }}
                      onClick={() => onAction?.('consultation', consultation.id)}
                    >
                      <div style={{
                        color: 'var(--color-text)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {consultation.consultation_type}
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {formatDate(consultation.consultation_date)}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'attendance' && (
              <>
                {activity.recentAttendanceEvents.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}>최근 출결 이벤트 없음</div>
                ) : (
                  activity.recentAttendanceEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-xs)',
                        cursor: onAction ? 'pointer' : 'default',
                      }}
                      onClick={() => onAction?.('attendance', event.id)}
                    >
                      <div style={{
                        color: 'var(--color-text)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {event.status}
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {formatDate(event.occurred_at)}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'tags' && (
              <>
                {activity.recentTagChanges.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)' }}>최근 태그 변경 없음</div>
                ) : (
                  activity.recentTagChanges.map((tag) => (
                    <div
                      key={tag.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-xs)',
                        cursor: onAction ? 'pointer' : 'default',
                      }}
                      onClick={() => onAction?.('tag', tag.id)}
                    >
                      <div style={{
                        color: 'var(--color-text)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        태그 추가
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-base)',
                      }}>
                        {formatDate(tag.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

