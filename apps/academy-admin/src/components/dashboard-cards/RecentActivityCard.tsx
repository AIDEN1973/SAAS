/**
 * Recent Activity Card 컴포넌트
 *
 * 최근 활동 카드 (최근 등록된 학생, 최근 상담 기록, 최근 출결 이벤트, 최근 태그 추가/변경)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [SSOT] useIndustryTerms로 동적 라벨 사용
 */

import React, { useState } from 'react';
import { Card, Button } from '@ui-core/react';
import type { RecentActivity } from '@hooks/use-student';
import { toKST } from '@lib/date-utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { DATE_FORMATS } from '../../constants';
import { User, MessageSquare, Calendar, Tag } from 'lucide-react';

export interface RecentActivityCardProps {
  activity: RecentActivity | undefined;
  isLoading?: boolean;
  onAction?: (type: 'student' | 'consultation' | 'attendance' | 'tag', id?: string) => void;
}

type ActivityTab = 'students' | 'consultations' | 'attendance' | 'tags';

export function RecentActivityCard({ activity, isLoading, onAction }: RecentActivityCardProps) {
  const terms = useIndustryTerms();
  const personLabel = terms.PERSON_LABEL_PRIMARY;

  const isEmpty = !activity || isLoading;
  const [activeTab, setActiveTab] = useState<ActivityTab>('students');

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    return toKST(dateString).format(DATE_FORMATS.SHORT);
  };

  const getTabIcon = (tab: ActivityTab) => {
    switch (tab) {
      case 'students':
        return <User size={16} />;
      case 'consultations':
        return <MessageSquare size={16} />;
      case 'attendance':
        return <Calendar size={16} />;
      case 'tags':
        return <Tag size={16} />;
    }
  };

  const getTabLabel = (tab: ActivityTab) => {
    switch (tab) {
      case 'students':
        return personLabel;
      case 'consultations':
        return terms.CONSULTATION_LABEL;
      case 'attendance':
        return terms.ATTENDANCE_LABEL;
      case 'tags':
        return terms.TAG_LABEL;
    }
  };

  return (
    <Card
      padding="lg"
      style={{
        opacity: isEmpty ? 'var(--opacity-inactive)' : 'var(--opacity-full)',
      }}
      disableHoverEffect={true}
    >
      {/* 탭 버튼 */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-lg)',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--color-gray-200)',
        paddingBottom: 'var(--spacing-sm)',
      }}>
        {(['students', 'consultations', 'attendance', 'tags'] as ActivityTab[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: 'var(--font-size-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
            }}
          >
            {getTabIcon(tab)}
            {getTabLabel(tab)}
          </Button>
        ))}
      </div>

      {/* 활동 목록 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        minHeight: '200px',
      }}>
        {isEmpty ? (
          <div style={{
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            padding: 'var(--spacing-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}>
            {getTabIcon(activeTab)}
            <span>활동 없음</span>
          </div>
        ) : (
          <>
            {activeTab === 'students' && (
              <>
                {activity.recentStudents.length === 0 ? (
                  <div style={{
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                  }}>
                    최근 등록된 {personLabel} 없음
                  </div>
                ) : (
                  activity.recentStudents.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-sm)',
                        cursor: onAction ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background-color 0.2s ease',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (onAction) {
                          e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => onAction?.('student', student.id)}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}>
                        <User size={18} style={{ color: 'var(--color-primary)' }} />
                        <div style={{
                          color: 'var(--color-text)',
                          fontSize: 'var(--font-size-base)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}>
                          {student.name}
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
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
                  <div style={{
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                  }}>
                    최근 상담 기록 없음
                  </div>
                ) : (
                  activity.recentConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-sm)',
                        cursor: onAction ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background-color 0.2s ease',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (onAction) {
                          e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => onAction?.('consultation', consultation.id)}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}>
                        <MessageSquare size={18} style={{ color: 'var(--color-primary)' }} />
                        <div style={{
                          color: 'var(--color-text)',
                          fontSize: 'var(--font-size-base)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}>
                          {consultation.consultation_type}
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
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
                  <div style={{
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                  }}>
                    최근 출결 이벤트 없음
                  </div>
                ) : (
                  activity.recentAttendanceEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-sm)',
                        cursor: onAction ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background-color 0.2s ease',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (onAction) {
                          e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => onAction?.('attendance', event.id)}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}>
                        <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                        <div style={{
                          color: 'var(--color-text)',
                          fontSize: 'var(--font-size-base)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}>
                          {event.status}
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
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
                  <div style={{
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    padding: 'var(--spacing-xl)',
                  }}>
                    최근 태그 변경 없음
                  </div>
                ) : (
                  activity.recentTagChanges.map((tag) => (
                    <div
                      key={tag.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--spacing-sm)',
                        cursor: onAction ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background-color 0.2s ease',
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (onAction) {
                          e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => onAction?.('tag', tag.id)}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}>
                        <Tag size={18} style={{ color: 'var(--color-primary)' }} />
                        <div style={{
                          color: 'var(--color-text)',
                          fontSize: 'var(--font-size-base)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}>
                          태그 추가
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
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
