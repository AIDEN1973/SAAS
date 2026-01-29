/**
 * StudentAttendanceRow Component
 *
 * 개별 학생의 출석 정보 입력/표시 행
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useMemo } from 'react';
import { Badge, Button } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { StudentAttendanceRowProps } from './types';

export const StudentAttendanceRow: React.FC<StudentAttendanceRowProps> = ({
  student,
  attendanceState,
  onStatusChange,
  disabled = false,
}) => {
  const terms = useIndustryTerms();

  // 상태 배지 색상
  const statusBadgeColor = useMemo(() => {
    switch (attendanceState.status) {
      case 'present':
        return 'success';
      case 'late':
        return 'warning';
      case 'absent':
        return 'error';
      case 'excused':
        return 'gray';
      case 'scheduled':
        return 'blue';
      default:
        return 'gray';
    }
  }, [attendanceState.status]);

  // [DEBUG] scheduled 상태 디버깅
  if (import.meta.env?.DEV && attendanceState.status === 'scheduled') {
    console.log('[StudentAttendanceRow] scheduled 상태:', {
      studentName: student.name,
      status: attendanceState.status,
      check_in: attendanceState.check_in,
      check_in_time: attendanceState.check_in_time,
      check_out: attendanceState.check_out,
      statusBadgeColor,
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        borderBottom: 'var(--border-width-thin) solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: 'var(--touch-target-min)',
      }}
    >
      {/* 학생 정보 */}
      <div
        style={{
          flex: '1 1 auto',
          minWidth: '120px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* 프로필 이미지 */}
        {student.profile_image_url && (
          <img
            src={student.profile_image_url}
            alt={student.name}
            loading="lazy"
            decoding="async"
            style={{
              width: 'var(--spacing-xl)',
              height: 'var(--spacing-xl)',
              borderRadius: 'var(--border-radius-full)',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {student.name}
          </div>
        </div>
      </div>

      {/* 출석 상태 버튼 그룹 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}
      >
        {/* scheduled 상태일 때는 배지만 표시 */}
        {attendanceState.status === 'scheduled' ? (
          <Badge variant="soft" color="info">
            출석 대기
          </Badge>
        ) : (
          <>
            <Button
              variant={attendanceState.status === 'present' ? 'solid' : 'outline'}
              color="success"
              size="sm"
              onClick={() => onStatusChange('present')}
              disabled={disabled}
            >
              {terms.PRESENT_LABEL}
            </Button>
            <Button
              variant={attendanceState.status === 'late' ? 'solid' : 'outline'}
              color="warning"
              size="sm"
              onClick={() => onStatusChange('late')}
              disabled={disabled}
            >
              {terms.LATE_LABEL}
            </Button>
            <Button
              variant={attendanceState.status === 'absent' ? 'solid' : 'outline'}
              color="error"
              size="sm"
              onClick={() => onStatusChange('absent')}
              disabled={disabled}
            >
              {terms.ABSENCE_LABEL}
            </Button>
            <Button
              variant={attendanceState.status === 'excused' ? 'solid' : 'outline'}
              color="info"
              size="sm"
              onClick={() => onStatusChange('excused')}
              disabled={disabled}
            >
              {terms.EXCUSED_LABEL}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
