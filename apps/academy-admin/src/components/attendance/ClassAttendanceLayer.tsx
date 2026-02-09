/**
 * ClassAttendanceLayer Component
 *
 * 우측 레이어에 표시되는 수업별 출석 입력 화면
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Button, Badge, DataTable, Modal } from '@ui-core/react';
import { Users, MessageCircle, MessageCircleMore } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { p } from '../../utils';
import { StudentAttendanceRow } from './StudentAttendanceRow';
import type { ClassAttendanceLayerProps, StudentAttendanceState } from './types';
import type { AttendanceStatus } from '@services/attendance-service';
import type { Student } from '@services/student-service';

export const ClassAttendanceLayer: React.FC<ClassAttendanceLayerProps> = ({
  classInfo,
  students,
  attendanceStates,
  checkInLogsMap,
  onAttendanceChange,
  onBulkCheckIn,
  onSaveStudent,
  isSaving,
}) => {
  const terms = useIndustryTerms();
  const [showAlimtalkModal, setShowAlimtalkModal] = useState(false);
  const [selectedStudentForAlimtalk, setSelectedStudentForAlimtalk] = useState<Student | null>(null);
  const [isSendingAlimtalk, setIsSendingAlimtalk] = useState(false);
  const [sentAlimtalkStudentIds, setSentAlimtalkStudentIds] = useState<Set<string>>(new Set());

  // 알림톡 발송 핸들러
  const handleOpenAlimtalkModal = useCallback((student: Student) => {
    setSelectedStudentForAlimtalk(student);
    setShowAlimtalkModal(true);
  }, []);

  const handleSendAlimtalk = useCallback(async () => {
    if (!selectedStudentForAlimtalk) return;

    setIsSendingAlimtalk(true);
    try {
      // TODO: 실제 알림톡 발송 API 호출
      console.log('[ClassAttendanceLayer] 알림톡 발송:', {
        studentId: selectedStudentForAlimtalk.id,
        studentName: selectedStudentForAlimtalk.name,
        classInfo: classInfo,
      });
      // 임시로 1초 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSentAlimtalkStudentIds(prev => new Set(prev).add(selectedStudentForAlimtalk.id));
      setShowAlimtalkModal(false);
      setSelectedStudentForAlimtalk(null);
    } finally {
      setIsSendingAlimtalk(false);
    }
  }, [selectedStudentForAlimtalk, classInfo]);

  // 출석 통계 계산
  const stats = useMemo(() => {
    const total = students.length;
    let present = 0;
    let late = 0;
    let absent = 0;

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
      }
    });

    return { total, present, late, absent };
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

  const handleStatusChange = useCallback(
    (studentId: string, currentStatus: AttendanceStatus | null) => (status: AttendanceStatus) => {
      // 토글 방식: 이미 선택된 버튼을 다시 클릭하면 상태 취소 (null로 변경)
      const newStatus = currentStatus === status ? null : status;

      if (import.meta.env?.DEV) {
        console.log('[ClassAttendanceLayer] 🔄 출석 상태 변경:', {
          studentId,
          currentStatus,
          clickedStatus: status,
          newStatus,
          isToggle: currentStatus === status,
        });
      }

      // 출석/지각 상태로 변경 시 현재 시간 자동 설정
      const updates: Partial<StudentAttendanceState> = {
        status: newStatus,
        manual_status_override: true,
        user_modified: true,
        ai_predicted: false,
      };

      // 출석 또는 지각 상태로 변경할 때 check_in_time 설정
      if (newStatus === 'present' || newStatus === 'late') {
        const currentTime = new Date().toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        updates.check_in_time = currentTime;
      }

      onAttendanceChange(studentId, updates);
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

      {/* 일괄 등원 버튼 */}
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
      </div>

      {/* 학생 목록 테이블 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        <DataTable
          data={students}
          columns={[
            {
              key: 'profile',
              label: terms.PERSON_LABEL_PRIMARY,
              width: '100px',
              render: (_, student) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
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
                        fontWeight: 'var(--font-weight-bold)',
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
              ),
            },
            {
              key: 'order',
              label: `${terms.ATTENDANCE_LABEL}번호`,
              width: '60px',
              align: 'center' as const,
              render: (_, student) => (
                <span>{student.attendance_number || '-'}</span>
              ),
            },
            {
              key: 'attendance',
              label: `${terms.ATTENDANCE_LABEL}상태`,
              width: 'auto',
              render: (_, student) => {
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
                    student={student}
                    attendanceState={state}
                    onCheckInChange={handleCheckInChange(student.id)}
                    onStatusChange={handleStatusChange(student.id, state.status)}
                    onSave={(stateOverride) => onSaveStudent(student.id, stateOverride)}
                    isKioskCheckIn={isKioskCheckIn}
                    disabled={isSaving}
                    classStartTime={classInfo.start_time}
                    hideStudentInfo={true}
                  />
                );
              },
            },
            {
              key: 'alimtalk',
              label: '알림톡',
              width: '80px',
              align: 'center' as const,
              render: (_, student) => {
                const isSent = sentAlimtalkStudentIds.has(student.id);
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenAlimtalkModal(student)}
                    disabled={isSaving}
                  >
                    {isSent ? (
                      <MessageCircleMore size={16} color="var(--color-success)" />
                    ) : (
                      <MessageCircle size={16} />
                    )}
                  </Button>
                );
              },
            },
          ]}
          keyExtractor={(student) => student.id}
          emptyMessage={`이 수업에 등록된 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 없습니다.`}
          emptyIcon={Users}
          stickyHeader={false}
        />
      </div>

      {/* 알림톡 발송 확인 모달 */}
      <Modal
        isOpen={showAlimtalkModal}
        onClose={() => {
          setShowAlimtalkModal(false);
          setSelectedStudentForAlimtalk(null);
        }}
        title="알림톡 발송"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setShowAlimtalkModal(false);
                setSelectedStudentForAlimtalk(null);
              }}
              style={{ flex: 1 }}
              disabled={isSendingAlimtalk}
            >
              취소
            </Button>
            <Button
              variant="solid"
              color="primary"
              size="md"
              onClick={handleSendAlimtalk}
              style={{ flex: 1 }}
              disabled={isSendingAlimtalk}
            >
              {isSendingAlimtalk ? '발송 중...' : '확인'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text-primary)' }}>
          알림톡을 <strong>{selectedStudentForAlimtalk?.name}</strong> {terms.PERSON_LABEL_PRIMARY}의 보호자에게 발송합니다.
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
          {terms.ATTENDANCE_LABEL}상태 알림이 카카오톡으로 전송됩니다.
        </p>
      </Modal>
    </div>
  );
};
