/**
 * ClassAttendanceLayer Component
 *
 * 우측 레이어에 표시되는 수업별 출석 입력 화면
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useMemo, useCallback } from 'react';
import { Button, Badge, EmptyState } from '@ui-core/react';
import { Users } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { p } from '../../utils';
import { StudentAttendanceRow } from './StudentAttendanceRow';
import type { ClassAttendanceLayerProps } from './types';
import type { AttendanceStatus } from '@services/attendance-service';

export const ClassAttendanceLayer: React.FC<ClassAttendanceLayerProps> = ({
  classInfo,
  students,
  attendanceStates,
  checkInLogsMap,
  onAttendanceChange,
  onBulkCheckIn,
  onBulkCheckOut,
  onSave,
  isSaving,
  onClose,
}) => {
  const terms = useIndustryTerms();

  // 출석 통계 계산
  const stats = useMemo(() => {
    const total = students.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    students.forEach((student) => {
      const state = attendanceStates[student.id];
      if (!state) return;

      if (state.check_in) {
        if (state.status === 'late') {
          late++;
        } else if (state.status === 'present') {
          present++;
        }
      } else if (state.status === 'absent') {
        absent++;
      } else if (state.status === 'excused') {
        excused++;
      }
    });

    return { total, present, late, absent, excused };
  }, [students, attendanceStates]);

  // 개별 학생 출결 상태 변경 핸들러
  const handleCheckInChange = useCallback(
    (studentId: string) => (checked: boolean, time?: string) => {
      onAttendanceChange(studentId, {
        check_in: checked,
        check_in_time: time,
        user_modified: true,
        ai_predicted: false,
      });
    },
    [onAttendanceChange]
  );

  const handleCheckOutChange = useCallback(
    (studentId: string) => (checked: boolean, time?: string) => {
      onAttendanceChange(studentId, {
        check_out: checked,
        check_out_time: time,
        user_modified: true,
        ai_predicted: false,
      });
    },
    [onAttendanceChange]
  );

  const handleStatusChange = useCallback(
    (studentId: string) => (status: AttendanceStatus) => {
      onAttendanceChange(studentId, {
        status,
        manual_status_override: true,
        user_modified: true,
        ai_predicted: false,
      });
    },
    [onAttendanceChange]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* 출석 현황 배지 버튼 - 본문 기간필터 버튼과 세로 정렬 */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          marginTop: 'calc(var(--spacing-xl) - var(--spacing-lg))',
        }}
      >
        <Badge variant="solid" color="success" style={{ border: 'var(--border-width-thin) solid transparent' }}>
          {terms.PRESENT_LABEL} ({stats.present}명)
        </Badge>
        <Badge variant="solid" color="warning" style={{ border: 'var(--border-width-thin) solid transparent' }}>
          {terms.LATE_LABEL} ({stats.late}명)
        </Badge>
        <Badge variant="solid" color="error" style={{ border: 'var(--border-width-thin) solid transparent' }}>
          {terms.ABSENCE_LABEL} ({stats.absent}명)
        </Badge>
      </div>
      {/* 구분선 - CardGridLayout 상단 테두리와 수평 정렬 */}
      <div style={{ borderBottom: 'var(--border-width-thin) solid var(--color-text)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }} />

      {/* 일괄 액션 버튼 */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-md) 0',
          borderBottom: 'var(--border-width-thin) solid var(--color-border-light)',
        }}
      >
        <Button variant="outline" size="sm" onClick={onBulkCheckIn} disabled={isSaving}>
          일괄 {terms.CHECK_IN_LABEL}
        </Button>
        <Button variant="outline" size="sm" onClick={onBulkCheckOut} disabled={isSaving}>
          일괄 {terms.CHECK_OUT_LABEL}
        </Button>
      </div>

      {/* 학생 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            message={`이 수업에 등록된 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 없습니다.`}
          />
        ) : (
          students.map((student) => {
            const state = attendanceStates[student.id] || {
              student_id: student.id,
              check_in: false,
              check_out: false,
              status: 'present' as AttendanceStatus,
              user_modified: false,
            };
            const log = checkInLogsMap.get(student.id);
            const isKioskCheckIn = log?.check_in_method === 'kiosk_phone';

            return (
              <StudentAttendanceRow
                key={student.id}
                student={student}
                attendanceState={state}
                onCheckInChange={handleCheckInChange(student.id)}
                onCheckOutChange={handleCheckOutChange(student.id)}
                onStatusChange={handleStatusChange(student.id)}
                isKioskCheckIn={isKioskCheckIn}
                disabled={isSaving}
                classStartTime={classInfo.start_time}
              />
            );
          })
        )}
      </div>

      {/* 하단 액션 버튼 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-md) 0',
          borderTop: 'var(--border-width-thin) solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <Button variant="outline" size="md" onClick={onClose} disabled={isSaving}>
          닫기
        </Button>
        <Button variant="solid" color="primary" size="md" onClick={onSave} disabled={isSaving}>
          {isSaving ? terms.MESSAGES.LOADING : terms.MESSAGES.SAVE}
        </Button>
      </div>
    </div>
  );
};
