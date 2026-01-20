/**
 * StudentAttendanceRow Component
 *
 * 개별 학생의 출석 정보 입력/표시 행
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useCallback, useMemo } from 'react';
import { Badge, Select } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { AttendanceCheckbox } from './AttendanceCheckbox';
import { determineLateStatus } from './utils';
import { LAYOUT_SIZES } from './constants';
import type { StudentAttendanceRowProps } from './types';
import type { AttendanceStatus } from '@services/attendance-service';

export const StudentAttendanceRow: React.FC<StudentAttendanceRowProps> = ({
  student,
  attendanceState,
  onCheckInChange,
  onCheckOutChange,
  onStatusChange,
  isKioskCheckIn = false,
  disabled = false,
  classStartTime,
}) => {
  const terms = useIndustryTerms();

  // 등원 시간 변경 시 자동 상태 판정
  const handleCheckInChange = useCallback(
    (checked: boolean, time?: string) => {
      if (!checked) {
        // 체크 해제
        onCheckInChange(false, undefined);
        return;
      }

      // 체크 시 시간 기반 자동 상태 판정
      let newStatus: AttendanceStatus = 'present';

      if (time && classStartTime && !attendanceState.manual_status_override) {
        const determinedStatus = determineLateStatus(time, classStartTime);
        if (determinedStatus) {
          newStatus = determinedStatus;
        }
      }

      onCheckInChange(true, time);

      // 자동 상태 판정이 필요한 경우에만 상태 변경
      if (!attendanceState.manual_status_override && newStatus !== attendanceState.status) {
        onStatusChange(newStatus);
      }
    },
    [onCheckInChange, onStatusChange, classStartTime, attendanceState.manual_status_override, attendanceState.status]
  );

  // 학생 정보 표시
  const studentInfo = useMemo(() => {
    const grade = student.grade ? `${student.grade}${terms.GRADE_LABEL}` : '';
    return grade;
  }, [student.grade, terms.GRADE_LABEL]);

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
      default:
        return 'gray';
    }
  }, [attendanceState.status]);

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
          minWidth: `${LAYOUT_SIZES.STUDENT_INFO_MIN_WIDTH}px`,
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
          {studentInfo && (
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {studentInfo}
            </div>
          )}
        </div>
      </div>

      {/* 등원 체크 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            minWidth: `${LAYOUT_SIZES.CHECKBOX_LABEL_MIN_WIDTH}px`,
          }}
        >
          {terms.CHECK_IN_LABEL}
        </span>
        <AttendanceCheckbox
          checked={attendanceState.check_in}
          time={attendanceState.check_in_time}
          onChange={handleCheckInChange}
          disabled={disabled}
          isKiosk={isKioskCheckIn}
          label={`${student.name} 등원`}
        />
      </div>

      {/* 하원 체크 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            minWidth: `${LAYOUT_SIZES.CHECKBOX_LABEL_MIN_WIDTH}px`,
          }}
        >
          {terms.CHECK_OUT_LABEL}
        </span>
        <AttendanceCheckbox
          checked={attendanceState.check_out}
          time={attendanceState.check_out_time}
          onChange={onCheckOutChange}
          disabled={disabled}
          label={`${student.name} 하원`}
        />
      </div>

      {/* 출석 상태 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          minWidth: `${LAYOUT_SIZES.TIME_BADGE_MIN_WIDTH}px`,
        }}
      >
        <Select
          value={attendanceState.status}
          onChange={(value) => onStatusChange(value as AttendanceStatus)}
          options={[
            { value: 'present', label: terms.PRESENT_LABEL },
            { value: 'late', label: terms.LATE_LABEL },
            { value: 'absent', label: terms.ABSENCE_LABEL },
            { value: 'excused', label: terms.EXCUSED_LABEL },
          ]}
          size="sm"
          disabled={disabled}
        />
      </div>

      {/* 상태 배지 (지각 시에만 표시) */}
      {attendanceState.status === 'late' && attendanceState.check_in && (
        <Badge variant="soft" color={statusBadgeColor}>
          {terms.LATE_LABEL}
        </Badge>
      )}
    </div>
  );
};
