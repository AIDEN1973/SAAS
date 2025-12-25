/**
 * QR 출결 페이지
 *
 * 아키텍처 문서 3.3.5 섹션 참조
 *
 * URL 형식: /attend?q={signed_token}
 *
 * 인증 처리:
 * - 학부모/학생 앱 로그인 상태 → 자동 인증 (JWT 토큰 확인)
 * - 비로그인 브라우저 접근 → SMS 본인 인증 또는 temporary token 발급
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Card, Button, Input, useModal } from '@ui-core/react';
import { useSession } from '@hooks/use-auth';
import { useQRAttendance } from '@hooks/use-attendance';

export function QRAttendancePage() {
  const [searchParams] = useSearchParams();
  const { showAlert } = useModal();
  const q = searchParams.get('q'); // signed_token
  const { data: session } = useSession();
  const user = session?.user;

  const [authStep, setAuthStep] = useState<'checking' | 'authenticated' | 'sms' | 'fallback'>('checking');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const { verifyQRToken, sendOTP, verifyOTP, submitAttendance, submitAttendanceWithFallback } = useQRAttendance();

  const handleSubmitAttendance = useCallback(async (studentId: string, authMethod: string) => {
    if (!q) return;

    try {
      // GPS 좌표 수집 시도 (선택적)
      let gps: { lat?: number; lng?: number } = {};
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          gps = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (gpsError) {
          // GPS 수집 실패해도 계속 진행
          console.warn('GPS 수집 실패:', gpsError);
        }
      }

      const result = await submitAttendance({
        qrToken: q,
        studentId,
        authMethod,
        gps,
      });

      if (result.success) {
        showAlert('성공', '출결이 처리되었습니다.');
        // 성공 화면 표시 후 자동 닫기
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        showAlert('오류', result.error || '출결 처리에 실패했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '출결 처리에 실패했습니다.';
      showAlert('오류', message);
    }
  }, [q, submitAttendance, showAlert]);

  useEffect(() => {
    if (!q) {
      showAlert('오류', 'QR 토큰이 없습니다.');
      return;
    }

    // 1. QR 토큰 검증
    verifyQRToken(q)
      .then((result) => {
        if (result.valid) {
          // 2. 인증 상태 확인
          if (user) {
            // 로그인 상태 → 자동 인증
            setAuthStep('authenticated');
            void handleSubmitAttendance(user.id, 'jwt');
          } else {
            // 비로그인 상태 → SMS 인증 또는 보조 인증
            setAuthStep('sms');
          }
        } else {
          showAlert('오류', result.error || '유효하지 않은 QR 코드입니다.');
        }
      })
      .catch((error) => {
        console.error('QR 토큰 검증 실패:', error);
        showAlert('오류', 'QR 코드를 확인할 수 없습니다.');
      });
  }, [q, user, verifyQRToken, handleSubmitAttendance, showAlert]);

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      showAlert('알림', '전화번호를 입력해주세요.');
      return;
    }

    try {
      await sendOTP(phone);
      setOtpSent(true);
      showAlert('성공', '인증번호가 발송되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('알림', '인증번호를 입력해주세요.');
      return;
    }

    try {
      const result = await verifyOTP(phone, otp);
      if (result.success && result.studentId) {
        setAuthStep('authenticated');
        void handleSubmitAttendance(result.studentId, 'sms_auth');
      } else {
        showAlert('오류', result.error || '인증에 실패했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '인증에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleFallbackAuth = async () => {
    if (!studentId.trim() || !birthDate.trim()) {
      showAlert('알림', '학생 ID와 생년월일을 입력해주세요.');
      return;
    }

    try {
      const result = await submitAttendanceWithFallback({
        qrToken: q!,
        studentId,
        birthDate: birthDate.replace(/-/g, '').slice(0, 4), // YYYYMMDD -> YYYY
      });

      if (result.success) {
        showAlert('성공', '출결이 처리되었습니다.');
        // 성공 화면 표시 후 자동 닫기
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        showAlert('오류', result.error || '출결 처리에 실패했습니다.');
        setAuthStep('fallback');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '출결 처리에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  if (authStep === 'checking') {
    return (
      <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>QR 코드를 확인하는 중...</p>
        </Card>
      </Container>
    );
  }

  if (authStep === 'authenticated') {
    return (
      <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>출결을 처리하는 중...</p>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Card padding="lg" variant="elevated" style={{ width: '100%' }}>
        <h1 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-md)',
          textAlign: 'center',
          color: 'var(--color-text)'
        }}>
          출결 인증
        </h1>

        {authStep === 'sms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {!otpSent ? (
              <>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text)'
                  }}>
                    전화번호
                  </label>
                  <Input
                    type="tel"
                    placeholder="010-1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                  />
                </div>
                <Button
                  variant="solid"
                  color="primary"
                  fullWidth
                  onClick={handleSendOTP}
                >
                  인증번호 발송
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setAuthStep('fallback')}
                >
                  다른 방법으로 인증
                </Button>
              </>
            ) : (
              <>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text)'
                  }}>
                    인증번호
                  </label>
                  <Input
                    type="text"
                    placeholder="6자리 인증번호"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    fullWidth
                    maxLength={6}
                  />
                </div>
                <Button
                  variant="solid"
                  color="primary"
                  fullWidth
                  onClick={handleVerifyOTP}
                >
                  인증하기
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                >
                  다시 발송
                </Button>
              </>
            )}
          </div>
        )}

        {authStep === 'fallback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                학생 ID
              </label>
              <Input
                type="text"
                placeholder="학생 ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                fullWidth
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                생년월일 (YYYY-MM-DD)
              </label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                fullWidth
              />
            </div>
            <Button
              variant="solid"
              color="primary"
              fullWidth
              onClick={handleFallbackAuth}
            >
              인증하기
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setAuthStep('sms')}
            >
              SMS 인증으로 돌아가기
            </Button>
          </div>
        )}
      </Card>
    </Container>
  );
}

