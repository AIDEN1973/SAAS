/**
 * Super Admin 로그인 페이지
 *
 * [불변 규칙] 스키마 엔진 기반 로그인 폼
 * [불변 규칙] Zero-Trust: 인증 로직은 core-auth 모듈에서 공통 관리
 * [불변 규칙] academy-admin 앱과 동일한 인증 로직 사용
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Card, useModal } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithOTP,
  useSendOTP,
  useSelectTenant,
} from '@hooks/use-auth';
import { loginFormSchema, otpLoginFormSchema } from '../schemas/login.schema';

type LoginMethod = 'email' | 'oauth' | 'otp';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showAlert } = useModal();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const loginWithEmail = useLoginWithEmail();
  const loginWithOAuth = useLoginWithOAuth();
  const sendOTP = useSendOTP();
  const loginWithOTP = useLoginWithOTP();
  const selectTenant = useSelectTenant();

  const handleEmailLogin = async (data: Record<string, unknown>) => {
    const email = typeof data.email === 'string' ? data.email : '';
    const password = typeof data.password === 'string' ? data.password : '';
    try {
      const result = await loginWithEmail.mutateAsync({ email, password });

      if (result.tenants.length === 0) {
        showAlert(
          '알림',
          '소속된 테넌트가 없습니다.\n\n' +
          '회원가입을 진행하시거나, 관리자에게 문의해주세요.'
        );
        return;
      }

      if (result.tenants.length === 1) {
        // 테넌트가 하나면 자동 선택
        await selectTenant.mutateAsync(result.tenants[0].id);

        // returnTo 파라미터 확인
        const returnTo = searchParams.get('returnTo');
        if (returnTo) {
          // [P0 수정] returnTo 파라미터 검증 (오픈 리다이렉트 방지)
          try {
            const decoded = decodeURIComponent(returnTo);
            // 제어 문자 제거 (보안상 필요하므로 ESLint 규칙 비활성화)
            // eslint-disable-next-line no-control-regex
            const normalized = decoded.trim().replace(/[\x00-\x1F\x7F]/g, '');
            const lowerNormalized = normalized.toLowerCase();
            const isSafe = normalized.startsWith('/') &&
              !normalized.startsWith('//') &&
              !normalized.includes('://') &&
              !lowerNormalized.includes('javascript:') &&
              !lowerNormalized.includes('data:') &&
              !lowerNormalized.includes('vbscript:') &&
              !lowerNormalized.includes('file:') &&
              !lowerNormalized.includes('about:') &&
              !normalized.includes('\\') &&
              !normalized.includes('..');
            if (isSafe) {
              window.location.href = decoded;
            } else {
              // 외부 URL 또는 잘못된 형식은 무시하고 홈으로 이동
              navigate('/');
            }
          } catch {
            // 디코딩 실패 시 홈으로 이동
            navigate('/');
          }
        } else {
          navigate('/');
        }
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
      await loginWithOAuth.mutateAsync({ provider });
    } catch (error) {
      const message = error instanceof Error ? error.message : '소셜 로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleSendOTP = async () => {
    try {
      await sendOTP.mutateAsync(phone);
      setOtpSent(true);
      showAlert('성공', '인증번호가 전송되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '인증번호 전송에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleOTPLogin = async (data: Record<string, unknown>) => {
    const otp = typeof data.otp === 'string' ? data.otp : '';
    try {
      const result = await loginWithOTP.mutateAsync({ phone, otp });

      if (result.tenants.length === 0) {
        showAlert(
          '알림',
          '소속된 테넌트가 없습니다.\n\n' +
          '회원가입을 진행하시거나, 관리자에게 문의해주세요.'
        );
        return;
      }

      if (result.tenants.length === 1) {
        await selectTenant.mutateAsync(result.tenants[0].id);

        const returnTo = searchParams.get('returnTo');
        if (returnTo) {
          // [P0 수정] returnTo 파라미터 검증 (오픈 리다이렉트 방지)
          try {
            const decoded = decodeURIComponent(returnTo);
            // 제어 문자 제거 (보안상 필요하므로 ESLint 규칙 비활성화)
            // eslint-disable-next-line no-control-regex
            const normalized = decoded.trim().replace(/[\x00-\x1F\x7F]/g, '');
            const lowerNormalized = normalized.toLowerCase();
            const isSafe = normalized.startsWith('/') &&
              !normalized.startsWith('//') &&
              !normalized.includes('://') &&
              !lowerNormalized.includes('javascript:') &&
              !lowerNormalized.includes('data:') &&
              !lowerNormalized.includes('vbscript:') &&
              !lowerNormalized.includes('file:') &&
              !lowerNormalized.includes('about:') &&
              !normalized.includes('\\') &&
              !normalized.includes('..');
            if (isSafe) {
              window.location.href = decoded;
            } else {
              // 외부 URL 또는 잘못된 형식은 무시하고 홈으로 이동
              navigate('/');
            }
          } catch {
            // 디코딩 실패 시 홈으로 이동
            navigate('/');
          }
        } else {
          navigate('/');
        }
      } else {
        navigate('/auth/tenant-selection');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  return (
    <Container maxWidth="sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xl)' }}>
      <Card style={{ width: '100%', padding: 'var(--spacing-lg)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>Super Admin 로그인</h1>

        {/* 로그인 방법 선택 */}
        <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-xs)', borderBottom: `var(--border-width-thin) solid var(--color-gray-200)` }}>
          <button
            onClick={() => {
              setLoginMethod('email');
              setOtpSent(false);
            }}
            style={{
              flex: 1,
              paddingTop: 'var(--spacing-xs)',
              paddingBottom: 'var(--spacing-xs)',
              paddingLeft: 'var(--spacing-md)',
              paddingRight: 'var(--spacing-md)',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)',
              transition: 'color var(--transition-base)',
              borderBottom: loginMethod === 'email' ? `var(--border-width-base) solid var(--color-primary)` : 'var(--border-width-base) solid transparent',
              color: loginMethod === 'email' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (loginMethod !== 'email') {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (loginMethod !== 'email') {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            이메일
          </button>
          <button
            onClick={() => {
              setLoginMethod('oauth');
              setOtpSent(false);
            }}
            style={{
              flex: 1,
              paddingTop: 'var(--spacing-xs)',
              paddingBottom: 'var(--spacing-xs)',
              paddingLeft: 'var(--spacing-md)',
              paddingRight: 'var(--spacing-md)',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)',
              transition: 'color var(--transition-base)',
              borderBottom: loginMethod === 'oauth' ? `var(--border-width-base) solid var(--color-primary)` : 'var(--border-width-base) solid transparent',
              color: loginMethod === 'oauth' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (loginMethod !== 'oauth') {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (loginMethod !== 'oauth') {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            소셜 로그인
          </button>
          <button
            onClick={() => {
              setLoginMethod('otp');
              setOtpSent(false);
            }}
            style={{
              flex: 1,
              paddingTop: 'var(--spacing-xs)',
              paddingBottom: 'var(--spacing-xs)',
              paddingLeft: 'var(--spacing-md)',
              paddingRight: 'var(--spacing-md)',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)',
              transition: 'color var(--transition-base)',
              borderBottom: loginMethod === 'otp' ? `var(--border-width-base) solid var(--color-primary)` : 'var(--border-width-base) solid transparent',
              color: loginMethod === 'otp' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (loginMethod !== 'otp') {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (loginMethod !== 'otp') {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            전화번호
          </button>
        </div>

        {/* 이메일 로그인 */}
        {loginMethod === 'email' && (
          <SchemaForm
            schema={loginFormSchema}
            onSubmit={handleEmailLogin}
            defaultValues={{
              email: '',
              password: '',
            }}
          />
        )}

        {/* 소셜 로그인 */}
        {loginMethod === 'oauth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={() => handleOAuthLogin('google')}
              style={{
                width: '100%',
                paddingTop: 'var(--spacing-sm)',
                paddingBottom: 'var(--spacing-sm)',
                paddingLeft: 'var(--spacing-md)',
                paddingRight: 'var(--spacing-md)',
                border: `var(--border-width-thin) solid var(--color-gray-300)`,
                borderRadius: 'var(--border-radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-sm)',
                background: 'var(--color-white)',
                cursor: loginWithOAuth.isPending ? 'not-allowed' : 'pointer',
                opacity: loginWithOAuth.isPending ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
                transition: 'background-color var(--transition-base)',
              }}
              disabled={loginWithOAuth.isPending}
              onMouseEnter={(e) => {
                if (!loginWithOAuth.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loginWithOAuth.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--color-white)';
                }
              }}
            >
              <svg style={{ width: 'var(--font-size-lg)', height: 'var(--font-size-lg)' }} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google로 로그인</span>
            </button>
            <button
              onClick={() => handleOAuthLogin('kakao')}
              style={{
                width: '100%',
                paddingTop: 'var(--spacing-sm)',
                paddingBottom: 'var(--spacing-sm)',
                paddingLeft: 'var(--spacing-md)',
                paddingRight: 'var(--spacing-md)',
                border: `var(--border-width-thin) solid var(--color-yellow-300)`,
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--color-yellow-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-sm)',
                cursor: loginWithOAuth.isPending ? 'not-allowed' : 'pointer',
                opacity: loginWithOAuth.isPending ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
                transition: 'background-color var(--transition-base)',
              }}
              disabled={loginWithOAuth.isPending}
              onMouseEnter={(e) => {
                if (!loginWithOAuth.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--color-yellow-500)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loginWithOAuth.isPending) {
                  e.currentTarget.style.backgroundColor = 'var(--color-yellow-400)';
                }
              }}
            >
              <span style={{ color: 'var(--color-gray-900)', fontWeight: 'var(--font-weight-medium)' }}>카카오로 로그인</span>
            </button>
          </div>
        )}

        {/* 전화번호/OTP 로그인 */}
        {loginMethod === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {!otpSent ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    style={{
                      width: '100%',
                      paddingLeft: 'var(--spacing-md)',
                      paddingRight: 'var(--spacing-md)',
                      paddingTop: 'var(--spacing-xs)',
                      paddingBottom: 'var(--spacing-xs)',
                      border: `var(--border-width-thin) solid var(--color-gray-300)`,
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = `var(--border-width-base) solid var(--color-primary)`;
                      e.currentTarget.style.outlineOffset = 'var(--spacing-xxs)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.borderColor = 'var(--color-gray-300)';
                    }}
                  />
                </div>
                <button
                  onClick={handleSendOTP}
                  disabled={!phone || sendOTP.isPending}
                  style={{
                    width: '100%',
                    paddingTop: 'var(--spacing-sm)',
                    paddingBottom: 'var(--spacing-sm)',
                    paddingLeft: 'var(--spacing-md)',
                    paddingRight: 'var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-white)',
                    borderRadius: 'var(--border-radius-md)',
                    border: 'none',
                    cursor: (!phone || sendOTP.isPending) ? 'not-allowed' : 'pointer',
                    opacity: (!phone || sendOTP.isPending) ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
                    transition: 'background-color var(--transition-base)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                  onMouseEnter={(e) => {
                    if (phone && !sendOTP.isPending) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (phone && !sendOTP.isPending) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                    }
                  }}
                >
                  {sendOTP.isPending ? '전송 중...' : '인증번호 전송'}
                </button>
              </>
            ) : (
              <SchemaForm
                schema={otpLoginFormSchema}
                onSubmit={handleOTPLogin}
                defaultValues={{
                  otp: '',
                }}
              />
            )}
          </div>
        )}
      </Card>
    </Container>
  );
}

