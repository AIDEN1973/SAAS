/**
 * 키오스크 출석 체크 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [목적]
 * - 태블릿 단말기에서 학생 본인 휴대폰 번호 입력으로 출석 체크
 * - 인증 불필요 (공개 키오스크 모드)
 * - 출석 완료 시 보호자에게 자동 알림 발송
 *
 * [요구사항]
 * - 큰 글씨, 간단한 UI (태블릿 전용)
 * - 휴대폰 번호 입력만으로 즉시 출석 체크
 * - 성공/실패 메시지를 명확하게 표시
 * - Policy 기반 기능 제어 (kiosk.enabled)
 *
 * [Zero-Management]
 * - 보호자 알림은 자동 발송 (kiosk.auto_notify_guardian)
 * - 별도 관리자 개입 불필요
 */

import React, { useState, useCallback } from 'react';
import { Container, Card, Button, Input, useModal } from '@ui-core/react';
import { getApiContext } from '@api-sdk/core';
import { logError, logInfo } from '../utils';

interface KioskCheckInResponse {
  success: boolean;
  student: {
    id: string;
    name: string;
  };
  attendance: {
    id: string;
    occurred_at: string;
    check_in_method: string;
  };
  message: string;
}

interface KioskCheckInError {
  error: string;
  hint?: string;
  details?: string;
}

export function KioskCheckInPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<{
    studentName: string;
    time: string;
  } | null>(null);

  // 휴대폰 번호 입력 시 자동 하이픈 추가
  const handlePhoneChange = useCallback((value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');

    // 자동 하이픈 추가
    let formatted = numbers;
    if (numbers.length > 3 && numbers.length <= 7) {
      formatted = `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length > 7) {
      formatted = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }

    setPhoneNumber(formatted);
  }, []);

  // 출석 체크 실행
  const handleCheckIn = useCallback(async () => {
    if (!phoneNumber) {
      showAlert('알림', '휴대폰 번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // kiosk-check-in Edge Function 호출
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/kiosk-check-in`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            student_phone: phoneNumber.replace(/-/g, ''), // 하이픈 제거
          }),
        }
      );

      const data: unknown = await response.json();

      if (!response.ok) {
        const errorData = data as KioskCheckInError;
        logError('KioskCheckInPage:CheckInFailed', {
          error: errorData.error,
          status: response.status,
          hint: errorData.hint,
        });

        showAlert(
          '출석 실패',
          errorData.error + (errorData.hint ? `\n\n${errorData.hint}` : '')
        );
        setIsLoading(false);
        return;
      }

      const successData = data as KioskCheckInResponse;

      // 성공 메시지 표시
      setLastCheckIn({
        studentName: successData.student.name,
        time: new Date(successData.attendance.occurred_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      });

      logInfo('KioskCheckInPage:CheckInSuccess', '출석 체크 완료', {
        studentId: successData.student.id,
        attendanceId: successData.attendance.id,
      });

      // 입력 필드 초기화 (다음 학생 입력 대기)
      setPhoneNumber('');

      // 3초 후 성공 메시지 자동 숨김
      setTimeout(() => {
        setLastCheckIn(null);
      }, 3000);

    } catch (error) {
      logError('KioskCheckInPage:NetworkError', error);
      showAlert(
        '오류',
        '네트워크 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, tenantId, showAlert]);

  // Enter 키로 출석 체크
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      void handleCheckIn();
    }
  }, [handleCheckIn, isLoading]);

  return (
    <Container maxWidth="md" className="kiosk-check-in-page">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}>
        <Card style={{ width: '100%', maxWidth: '500px', padding: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>
            출석 체크
          </h1>

          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '3rem' }}>
            학생 본인의 휴대폰 번호를 입력해주세요
          </p>

          {/* 성공 메시지 */}
          {lastCheckIn && (
            <div style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '2rem',
              borderRadius: '8px',
              marginBottom: '2rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
            }}>
              <div>{lastCheckIn.studentName} 학생</div>
              <div style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
                {lastCheckIn.time} 출석 완료!
              </div>
            </div>
          )}

          {/* 휴대폰 번호 입력 */}
          <div style={{ marginBottom: '2rem' }}>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="010-1234-5678"
              disabled={isLoading}
              style={{
                fontSize: '2rem',
                padding: '1.5rem',
                textAlign: 'center',
                width: '100%',
              }}
              autoFocus
            />
          </div>

          {/* 출석 버튼 */}
          <Button
            onClick={handleCheckIn}
            disabled={isLoading || !phoneNumber}
            style={{
              width: '100%',
              fontSize: '1.8rem',
              padding: '1.5rem',
              fontWeight: 'bold',
            }}
          >
            {isLoading ? '처리 중...' : '출석하기'}
          </Button>

          {/* 안내 메시지 */}
          <div style={{
            marginTop: '2rem',
            fontSize: '1rem',
            color: '#999',
          }}>
            <p>출석 완료 시 보호자님께 자동으로 알림이 발송됩니다.</p>
          </div>
        </Card>

        {/* 관리자 페이지로 돌아가기 (작은 링크) */}
        <div style={{ marginTop: '2rem' }}>
          <a
            href="/attendance"
            style={{
              fontSize: '0.9rem',
              color: '#999',
              textDecoration: 'none',
            }}
          >
            관리자 페이지로 돌아가기
          </a>
        </div>
      </div>
    </Container>
  );
}
