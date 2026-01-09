/**
 * SMS 작성 컴포넌트
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않음
 * [불변 규칙] 모든 스타일은 design-system 토큰만 사용한다.
 *
 * ## 기능
 * - SMS/LMS 타입 자동 판별 (90바이트 기준)
 * - 바이트 수 실시간 표시
 * - 예약 발송 지원
 * - %고객명% 치환 지원
 */

import React, { useState, useCallback, useMemo } from 'react';

/**
 * SMS 바이트 수 계산 (EUC-KR 기준)
 */
function calculateSmsBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3131 && code <= 0x318e) ||
      (code >= 0x1100 && code <= 0x11ff)
    ) {
      bytes += 2;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else {
      bytes += 2;
    }
  }
  return bytes;
}

export interface SmsComposerProps {
  /** 수신자 목록 */
  recipients?: Array<{
    phone: string;
    name?: string;
  }>;
  /** 초기 메시지 */
  initialMessage?: string;
  /** 초기 제목 (LMS/MMS 전용) */
  initialTitle?: string;
  /** 발송 완료 시 콜백 */
  onSend?: (data: {
    message: string;
    title?: string;
    messageType: 'SMS' | 'LMS';
    recipients: Array<{ phone: string; name?: string }>;
    scheduled?: { date: string; time: string };
  }) => void;
  /** 취소 시 콜백 */
  onCancel?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 테스트 모드 표시 */
  showTestModeIndicator?: boolean;
  /** 테스트 모드 여부 */
  isTestMode?: boolean;
}

export const SmsComposer: React.FC<SmsComposerProps> = ({
  recipients = [],
  initialMessage = '',
  initialTitle = '',
  onSend,
  onCancel,
  isLoading = false,
  disabled = false,
  showTestModeIndicator = true,
  isTestMode = true,
}) => {
  const [message, setMessage] = useState(initialMessage);
  const [title, setTitle] = useState(initialTitle);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // 바이트 수 및 메시지 타입 계산
  const byteInfo = useMemo(() => {
    const bytes = calculateSmsBytes(message);
    const messageType = bytes > 90 ? 'LMS' : 'SMS';
    const maxBytes = messageType === 'SMS' ? 90 : 2000;
    return { bytes, messageType, maxBytes };
  }, [message]);

  // 유효성 검사
  const isValid = useMemo(() => {
    if (!message.trim()) return false;
    if (recipients.length === 0) return false;
    if (byteInfo.bytes > 2000) return false;
    if (isScheduled) {
      if (!scheduleDate || !scheduleTime) return false;
    }
    return true;
  }, [message, recipients, byteInfo.bytes, isScheduled, scheduleDate, scheduleTime]);

  // 발송 처리
  const handleSend = useCallback(() => {
    if (!isValid || isLoading || disabled) return;

    onSend?.({
      message,
      title: byteInfo.messageType === 'LMS' ? title : undefined,
      messageType: byteInfo.messageType as 'SMS' | 'LMS',
      recipients,
      scheduled: isScheduled ? { date: scheduleDate, time: scheduleTime } : undefined,
    });
  }, [
    isValid,
    isLoading,
    disabled,
    onSend,
    message,
    title,
    byteInfo.messageType,
    recipients,
    isScheduled,
    scheduleDate,
    scheduleTime,
  ]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--border-radius-md)',
        border: '1px solid var(--color-gray-300)',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
          }}
        >
          문자 발송
        </h3>
        {showTestModeIndicator && isTestMode && (
          <span
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            테스트 모드
          </span>
        )}
      </div>

      {/* 수신자 정보 */}
      <div
        style={{
          padding: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--border-radius-sm)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          수신자
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text)',
          }}
        >
          {recipients.length > 0 ? (
            recipients.length === 1 ? (
              <span>
                {recipients[0].name || recipients[0].phone}
                {recipients[0].name && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)' }}>
                    ({recipients[0].phone})
                  </span>
                )}
              </span>
            ) : (
              <span>{recipients.length}명</span>
            )
          ) : (
            <span style={{ color: 'var(--color-text-tertiary)' }}>수신자가 없습니다</span>
          )}
        </div>
      </div>

      {/* 제목 (LMS일 때만 표시) */}
      {byteInfo.messageType === 'LMS' && (
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            제목 (LMS)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문자 제목 (최대 44바이트)"
            maxLength={44}
            disabled={disabled}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderBottom: '1px solid var(--color-gray-300)',
              backgroundColor: 'var(--color-white)',
              fontSize: 'var(--font-size-base)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* 메시지 입력 */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          <label
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            메시지
          </label>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: byteInfo.bytes > byteInfo.maxBytes ? 'var(--color-error)' : 'var(--color-text-secondary)',
            }}
          >
            <strong>{byteInfo.bytes}</strong>/{byteInfo.maxBytes} bytes ({byteInfo.messageType})
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요. %고객명%을 사용하면 수신자 이름으로 치환됩니다."
          rows={5}
          disabled={disabled}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm)',
            border: '1px solid var(--color-gray-300)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'var(--color-white)',
            fontSize: 'var(--font-size-base)',
            lineHeight: 'var(--line-height)',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--font-family)',
          }}
        />
        <div
          style={{
            marginTop: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          SMS: 90바이트 이하 / LMS: 2,000바이트 이하
        </div>
      </div>

      {/* 예약 발송 */}
      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={isScheduled}
            onChange={(e) => setIsScheduled(e.target.checked)}
            disabled={disabled}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text)',
            }}
          >
            예약 발송
          </span>
        </label>

        {isScheduled && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-sm)',
            }}
          >
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              disabled={disabled}
              style={{
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--color-gray-300)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
              }}
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              disabled={disabled}
              style={{
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--color-gray-300)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
              }}
            />
          </div>
        )}
        {isScheduled && (
          <div
            style={{
              marginTop: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            예약 발송은 현재 시간 기준 10분 이후부터 가능합니다.
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--spacing-sm)',
          marginTop: 'var(--spacing-sm)',
        }}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              backgroundColor: 'var(--color-white)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-gray-300)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-base)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={!isValid || isLoading || disabled}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: isValid && !disabled ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
            color: isValid && !disabled ? 'var(--color-white)' : 'var(--color-text-tertiary)',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: !isValid || isLoading || disabled ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? '발송 중...' : isScheduled ? '예약 발송' : '발송'}
        </button>
      </div>
    </div>
  );
};

SmsComposer.displayName = 'SmsComposer';
