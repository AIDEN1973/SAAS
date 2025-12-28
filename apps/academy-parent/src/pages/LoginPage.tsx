/**
 * 학부모 앱 로그인 페이지
 *
 * Public Gateway를 통한 인증 사용
 * 아키텍처 문서 10.6 섹션 참조
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, useModal, useResponsiveMode } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithOTP,
  useSendOTP,
  useSelectTenant,
} from '@hooks/use-auth';
// TODO: 공통 스키마로 이동 필요
// 임시로 academy-admin의 스키마 사용
import { loginFormSchema, otpLoginFormSchema } from '../../../academy-admin/src/schemas/login.schema';

type LoginMethod = 'email' | 'oauth' | 'otp';

export function LoginPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const loginWithEmail = useLoginWithEmail();
  const loginWithOAuth = useLoginWithOAuth();
  const sendOTP = useSendOTP();
  const loginWithOTP = useLoginWithOTP();
  const selectTenantMutation = useSelectTenant();
  const selectTenant = selectTenantMutation.mutateAsync;

  const handleEmailLogin = async (data: Record<string, unknown>) => {
    const email = String(data.email ?? '');
    const password = String(data.password ?? '');
    try {
      const result = await loginWithEmail.mutateAsync({ email, password });

      if (result.tenants.length === 0) {
        showAlert('알림', '소속된 테넌트가 없습니다.\n\n회원가입을 진행하시거나, 관리자에게 문의해주세요.');
        return;
      }

      if (result.tenants.length === 1) {
        // 테넌트가 하나면 자동 선택
        await selectTenant(result.tenants[0].id);
        navigate('/home');
      } else {
        // 여러 테넌트면 선택 페이지로 이동
        navigate('/auth/tenant-selection');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    try {
      const { url } = await loginWithOAuth.mutateAsync({ provider });
      // [P0 예외] OAuth 리다이렉트는 외부 URL(Google, Kakao)이므로 window.location.href 사용
      // 서버에서 반환된 OAuth URL은 신뢰할 수 있는 소스이므로 검증 불필요
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : '소셜 로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      showAlert('알림', '전화번호를 입력해주세요.');
      return;
    }

    try {
      await sendOTP.mutateAsync(phone);
      setOtpSent(true);
      showAlert('성공', '인증번호가 발송되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleOTPLogin = async (data: Record<string, unknown>) => {
    const phone = String(data.phone ?? '');
    const otp = String(data.otp ?? '');
    try {
      const result = await loginWithOTP.mutateAsync({ phone, otp });

      if (result.tenants.length === 0) {
        showAlert('알림', '소속된 테넌트가 없습니다.');
        return;
      }

      if (result.tenants.length === 1) {
        await selectTenant(result.tenants[0].id);
        navigate('/home');
      } else {
        navigate('/auth/tenant-selection');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  return (
    <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Card padding="lg" variant="elevated" style={{ width: '100%' }}>
        <h1 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-md)',
          textAlign: 'center',
          color: 'var(--color-text)'
        }}>
          디어쌤 학부모 로그인
        </h1>

        {/* 로그인 방법 선택 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
          <Button
            variant={loginMethod === 'email' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setLoginMethod('email')}
            fullWidth={isMobile}
          >
            이메일
          </Button>
          <Button
            variant={loginMethod === 'oauth' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setLoginMethod('oauth')}
            fullWidth={isMobile}
          >
            소셜 로그인
          </Button>
          <Button
            variant={loginMethod === 'otp' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setLoginMethod('otp')}
            fullWidth={isMobile}
          >
            전화번호
          </Button>
        </div>

        {/* 이메일 로그인 */}
        {loginMethod === 'email' && (
          <SchemaForm
            schema={loginFormSchema}
            onSubmit={handleEmailLogin}
            actionContext={{
              apiCall: () => Promise.resolve({}),
              showToast: () => {},
            }}
          />
        )}

        {/* 소셜 로그인 */}
        {loginMethod === 'oauth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <Button
              variant="outline"
              fullWidth
              onClick={() => handleOAuthLogin('google')}
              disabled={loginWithOAuth.isPending}
            >
              Google로 로그인
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => handleOAuthLogin('kakao')}
              disabled={loginWithOAuth.isPending}
            >
              Kakao로 로그인
            </Button>
          </div>
        )}

        {/* OTP 로그인 */}
        {loginMethod === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {!otpSent ? (
              <>
                <SchemaForm
                  schema={{
                    version: '1.0.0',
                    minSupportedClient: '1.0.0',
                    entity: 'otp-phone',
                    type: 'form',
                    form: {
                      fields: [
                        {
                          name: 'phone',
                          kind: 'phone',
                          ui: {
                            label: '전화번호',
                          },
                          validation: {
                            required: '전화번호를 입력해주세요.',
                          },
                          defaultValue: '',
                        },
                      ],
                    },
                  }}
                  onSubmit={(data: Record<string, unknown>) => {
                    setPhone(String(data.phone ?? ''));
                    void handleSendOTP();
                  }}
                  actionContext={{
                    apiCall: () => Promise.resolve({}),
                    showToast: () => {},
                  }}
                />
              </>
            ) : (
              <SchemaForm
                schema={otpLoginFormSchema}
                onSubmit={handleOTPLogin}
                defaultValues={{ phone }}
                actionContext={{
                  apiCall: () => Promise.resolve({}),
                  showToast: () => {},
                }}
              />
            )}
          </div>
        )}
      </Card>
    </Container>
  );
}

