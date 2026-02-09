/**
 * StudentAttendanceRow Component
 *
 * 개별 학생의 등원 처리 행
 * - 등원 버튼 1개로 출석/지각 자동 판정
 * - 등원 시간 vs 수업 시작 시간 비교로 present/late 결정
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React, { useState, useRef } from 'react';
import { Badge, Button, TimeInput, Modal, Popover, PopoverMenu, PopoverMenuItem, PopoverMenuDivider } from '@ui-core/react';
import { X, Clock, LogIn } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { p } from '../../utils';
import { ATTENDANCE_TIME_CONFIG } from './constants';
import type { StudentAttendanceRowProps } from './types';

/**
 * 등원 시간과 수업 시작 시간을 비교하여 출석/지각 자동 판정
 */
function determineAttendanceStatus(
  checkInTime: string,
  classStartTime?: string,
): 'present' | 'late' {
  if (!classStartTime) return 'present';

  const [ciH, ciM] = checkInTime.split(':').map(Number);
  const [csH, csM] = classStartTime.split(':').map(Number);
  const checkInMinutes = ciH * 60 + ciM;
  const classStartMinutes = csH * 60 + csM;
  const diff = checkInMinutes - classStartMinutes;

  return diff > ATTENDANCE_TIME_CONFIG.LATE_THRESHOLD_MINUTES ? 'late' : 'present';
}

export const StudentAttendanceRow: React.FC<StudentAttendanceRowProps> = ({
  student,
  attendanceState,
  onStatusChange,
  onCheckInChange,
  onSave,
  disabled = false,
  classStartTime,
  hideStudentInfo = false,
}) => {
  const terms = useIndustryTerms();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTimeEditModal, setShowTimeEditModal] = useState(false);
  const [showCheckInPopover, setShowCheckInPopover] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const checkInButtonRef = useRef<HTMLButtonElement>(null);

  // 시간 포맷팅 (HH:mm → 오전/오후 H시 m분)
  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':').map(Number);
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour}시 ${minute}분`;
  };

  // 현재 시간 가져오기
  const getCurrentTime = (): string => {
    return new Date().toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 현재 상태가 등원 완료인지 (present 또는 late)
  const isCheckedIn = attendanceState.status === 'present' || attendanceState.status === 'late';

  // 등원 버튼 클릭 핸들러
  const handleCheckInClick = () => {
    if (isCheckedIn && attendanceState.check_in_time) {
      // 이미 등원 상태: Popover 표시 (시간 변경, 등원 취소)
      setShowCheckInPopover(prev => !prev);
    } else {
      // 미등원 상태: 확인 모달 표시
      setShowConfirmModal(true);
    }
  };

  // 등원 처리 확인 (자동 판정 + 저장)
  const handleConfirmCheckIn = async () => {
    const currentTime = getCurrentTime();
    const autoStatus = determineAttendanceStatus(currentTime, classStartTime);

    onCheckInChange(true, currentTime);
    onStatusChange(autoStatus);

    setIsSaving(true);
    try {
      await onSave({
        status: autoStatus,
        check_in: true,
        check_in_time: currentTime,
      });
    } finally {
      setIsSaving(false);
    }
    setShowConfirmModal(false);
  };

  // 등원 취소 모달 열기
  const handleOpenCancelModal = () => {
    setShowCancelModal(true);
    setShowCheckInPopover(false);
  };

  // 등원 취소 확인
  const handleConfirmCancel = async () => {
    onStatusChange(attendanceState.status!);

    setIsSaving(true);
    try {
      await onSave({ status: null, check_in: false, check_in_time: undefined });
    } finally {
      setIsSaving(false);
    }
    setShowCancelModal(false);
  };

  // 시간 변경 모달 열기
  const handleOpenTimeEdit = () => {
    setEditTimeValue(attendanceState.check_in_time || getCurrentTime());
    setShowTimeEditModal(true);
    setShowCheckInPopover(false);
  };

  // 시간 변경 저장 (재판정 포함)
  const handleSaveTimeEdit = async () => {
    if (editTimeValue && /^\d{1,2}:\d{2}$/.test(editTimeValue)) {
      const [hour, min] = editTimeValue.split(':');
      const normalizedTime = `${hour.padStart(2, '0')}:${min}`;

      // 시간 변경 시 출석/지각 재판정
      const newStatus = determineAttendanceStatus(normalizedTime, classStartTime);

      onCheckInChange(true, normalizedTime);
      onStatusChange(newStatus);

      setIsSaving(true);
      try {
        await onSave({
          status: newStatus,
          check_in: true,
          check_in_time: normalizedTime,
        });
      } finally {
        setIsSaving(false);
      }
    }
    setShowTimeEditModal(false);
  };

  // 등원 버튼 색상 및 라벨 결정
  const getCheckInButtonProps = () => {
    if (attendanceState.status === 'present' && attendanceState.check_in_time) {
      return { color: 'success' as const, variant: 'solid' as const };
    }
    if (attendanceState.status === 'late' && attendanceState.check_in_time) {
      return { color: 'warning' as const, variant: 'solid' as const };
    }
    return { color: 'primary' as const, variant: 'outline' as const };
  };

  const buttonProps = getCheckInButtonProps();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-md)',
        padding: hideStudentInfo ? '0' : 'var(--spacing-sm) var(--spacing-md)',
        borderBottom: hideStudentInfo ? 'none' : 'var(--border-width-thin) solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: hideStudentInfo ? 'auto' : 'var(--touch-target-min)',
      }}
    >
      {/* 학생 정보 */}
      {!hideStudentInfo && (
        <div
          style={{
            flex: '1 1 auto',
            minWidth: 'var(--width-button-min)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
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
      )}

      {/* 등원 상태 버튼 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
        }}
      >
        {/* scheduled 상태일 때는 배지만 표시 */}
        {attendanceState.status === 'scheduled' ? (
          <Badge variant="soft" color="info">
            {terms.PRESENT_LABEL} 대기
          </Badge>
        ) : (
          <>
            {/* 등원 버튼 */}
            <Button
              ref={checkInButtonRef}
              variant={buttonProps.variant}
              color={buttonProps.color}
              size="sm"
              onClick={handleCheckInClick}
              disabled={disabled || isSaving}
              style={isCheckedIn && attendanceState.check_in_time ? { padding: 0, overflow: 'hidden' } : undefined}
            >
              {isCheckedIn && attendanceState.check_in_time ? (
                <span style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 var(--spacing-sm)',
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    {attendanceState.status === 'late' ? terms.LATE_LABEL : terms.PRESENT_LABEL}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 var(--spacing-sm)' }}>
                    {formatTime(attendanceState.check_in_time)}
                  </span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <LogIn size={14} />
                  {terms.CHECK_IN_LABEL}
                </span>
              )}
            </Button>

            {/* 등원 Popover (시간 변경, 취소) */}
            <Popover
              isOpen={showCheckInPopover}
              onClose={() => setShowCheckInPopover(false)}
              anchorEl={checkInButtonRef.current}
              placement="bottom-start"
            >
              <PopoverMenu>
                <PopoverMenuItem
                  icon={<Clock size={16} strokeWidth={1.5} />}
                  onClick={handleOpenTimeEdit}
                >
                  {terms.CHECK_IN_LABEL}시간 변경
                </PopoverMenuItem>
                <PopoverMenuDivider />
                <PopoverMenuItem
                  icon={<X size={16} strokeWidth={1.5} />}
                  onClick={handleOpenCancelModal}
                >
                  {terms.CHECK_IN_LABEL} 취소
                </PopoverMenuItem>
              </PopoverMenu>
            </Popover>

            {/* 등원 확인 모달 */}
            <Modal
              isOpen={showConfirmModal}
              onClose={() => setShowConfirmModal(false)}
              title={`${terms.CHECK_IN_LABEL} 처리`}
              size="sm"
              footer={
                <>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowConfirmModal(false)}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    취소
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    size="md"
                    onClick={handleConfirmCheckIn}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '확인'}
                  </Button>
                </>
              }
            >
              <p style={{
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-primary)',
              }}>
                {formatTime(getCurrentTime())}
              </p>
              <p style={{ color: 'var(--color-text-primary)' }}>
                지금 시간으로 {terms.CHECK_IN_LABEL} 처리를 하시겠어요?
              </p>
              <p style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text)',
              }}>
                {terms.CHECK_IN_LABEL} 시간에 따라 {terms.PRESENT_LABEL}/{terms.LATE_LABEL}{p.이가(terms.LATE_LABEL)} 자동으로 결정됩니다.
              </p>
            </Modal>

            {/* 시간 변경 모달 */}
            <Modal
              isOpen={showTimeEditModal}
              onClose={() => setShowTimeEditModal(false)}
              title={`${terms.CHECK_IN_LABEL}시간 변경`}
              size="sm"
              footer={
                <>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowTimeEditModal(false)}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    취소
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    size="md"
                    onClick={handleSaveTimeEdit}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '확인'}
                  </Button>
                </>
              }
            >
              <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
                {terms.CHECK_IN_LABEL} 시간을 변경하시겠어요?
              </p>
              <TimeInput
                value={editTimeValue}
                onChange={(e) => setEditTimeValue(e.target.value)}
                size="md"
                fullWidth
              />
              <p style={{
                marginTop: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text)',
              }}>
                시간 변경 시 {terms.PRESENT_LABEL}/{terms.LATE_LABEL}{p.이가(terms.LATE_LABEL)} 재판정됩니다.
              </p>
            </Modal>

            {/* 등원 취소 확인 모달 */}
            <Modal
              isOpen={showCancelModal}
              onClose={() => setShowCancelModal(false)}
              title={`${terms.CHECK_IN_LABEL} 취소`}
              size="sm"
              footer={
                <>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowCancelModal(false)}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    취소
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    size="md"
                    onClick={handleConfirmCancel}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  >
                    {isSaving ? '처리 중...' : '확인'}
                  </Button>
                </>
              }
            >
              <p style={{ color: 'var(--color-text-primary)' }}>
                {student.name} {terms.PERSON_LABEL_PRIMARY}의 {terms.CHECK_IN_LABEL}을(를) 취소하시겠어요?
              </p>
            </Modal>
          </>
        )}
      </div>
    </div>
  );
};
