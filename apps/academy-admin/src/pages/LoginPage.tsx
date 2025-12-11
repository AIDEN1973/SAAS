/**
 * 로그인 페이지
 *
 * [기술문서 요구사항]
 * - 인증 로직은 core-auth 모듈에서 공통 관리
 * - 지원 인증 방식: 이메일/비밀번호, 소셜 로그인(Google, Kakao), 전화번호·OTP
 * - 로그인 플로우: 사용자 인증 → 테넌트 목록 조회 → 테넌트 선택 → JWT claim에 tenant_id 포함
 *
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 * - 반응형 지원 (xs, sm, md, lg, xl)
 * - Design System 토큰 사용
 * - 접근성 WCAG 2.1 AAA 목표
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Input, useModal, useResponsiveMode } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithOTP,
  useSendOTP,
  useUserTenants,
  useSelectTenant,
} from '@hooks/use-auth';
import { loginFormSchema, otpLoginFormSchema } from '../schemas/login.schema';

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
  const { data: tenants } = useUserTenants();
  const selectTenant = useSelectTenant();

  const handleEmailLogin = async (data: { email: string; password: string }) => {
    try {
      const result = await loginWithEmail.mutateAsync({ email: data.email, password: data.password });

      if (result.tenants.length === 0) {
        // 개발 환경에서 상세 정보 표시
        if (import.meta.env?.DEV) {
          console.warn('⚠️ 테넌트가 없습니다:', {
            userId: result.user.id,
            email: result.user.email,
          });
          console.log('💡 가능한 원인:');
          console.log('   1. 회원가입 시 테넌트가 생성되지 않았을 수 있음');
          console.log('   2. user_tenant_roles에 레코드가 없을 수 있음');
          console.log('   3. RLS 정책 때문에 조회가 안 될 수 있음');
          console.log('   → Supabase Dashboard에서 확인:');
          console.log('      - Authentication > Users: 사용자 확인');
          console.log('      - Table Editor > user_tenant_roles: 테넌트 관계 확인');
          console.log('      - Table Editor > tenants: 테넌트 확인');
        }

        showAlert(
          '알림',
          '소속된 테넌트가 없습니다.\n\n' +
          '회원가입을 진행하시거나, 관리자에게 문의해주세요.\n\n' +
          (import.meta.env?.DEV
            ? '⚠️ 개발 환경: 브라우저 콘솔에서 상세 정보를 확인하세요.'
            : '')
        );
        navigate('/auth/signup');
        return;
      }

      if (result.tenants.length === 1) {
        // 테넌트가 하나면 자동 선택
        await selectTenant.mutateAsync(result.tenants[0].id);
        navigate('/');
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
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : '소셜 로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleSendOTP = async () => {
    try {
      await sendOTP.mutateAsync(phone);
      setOtpSent(true);
      showAlert('알림', 'OTP가 전송되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP 전송에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const handleOTPLogin = async (data: { phone: string; otp: string }) => {
    try {
      const result = await loginWithOTP.mutateAsync({ phone: data.phone, otp: data.otp });

      if (result.tenants.length === 0) {
        // 개발 환경에서 상세 정보 표시
        if (import.meta.env?.DEV) {
          console.warn('⚠️ 테넌트가 없습니다:', {
            userId: result.user.id,
            phone: result.user.phone,
          });
          console.log('💡 가능한 원인:');
          console.log('   1. 회원가입 시 테넌트가 생성되지 않았을 수 있음');
          console.log('   2. user_tenant_roles에 레코드가 없을 수 있음');
          console.log('   3. RLS 정책 때문에 조회가 안 될 수 있음');
          console.log('   → Supabase Dashboard에서 확인:');
          console.log('      - Authentication > Users: 사용자 확인');
          console.log('      - Table Editor > user_tenant_roles: 테넌트 관계 확인');
          console.log('      - Table Editor > tenants: 테넌트 확인');
        }

        showAlert(
          '알림',
          '소속된 테넌트가 없습니다.\n\n' +
          '회원가입을 진행하시거나, 관리자에게 문의해주세요.\n\n' +
          (import.meta.env?.DEV
            ? '⚠️ 개발 환경: 브라우저 콘솔에서 상세 정보를 확인하세요.'
            : '')
        );
        navigate('/auth/signup');
        return;
      }

      if (result.tenants.length === 1) {
        await selectTenant.mutateAsync(result.tenants[0].id);
        navigate('/');
      } else {
        navigate('/auth/tenant-selection');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP 로그인에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  const loading = loginWithEmail.isPending || loginWithOAuth.isPending || loginWithOTP.isPending || sendOTP.isPending;

  return (
    <Container
      maxWidth="sm"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        paddingTop: 'var(--spacing-xl)',
        paddingBottom: 'var(--spacing-xl)'
      }}
    >
      <Card
        padding={isMobile ? 'lg' : 'xl'}
        style={{ width: '100%' }}
      >
        <h1 style={{
          fontSize: isMobile ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          로그인
        </h1>

        {/* 로그인 방법 선택 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
          <Button
            variant={loginMethod === 'email' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('email')}
            style={{ flex: 1 }}
          >
            이메일
          </Button>
          <Button
            variant={loginMethod === 'otp' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('otp')}
            style={{ flex: 1 }}
          >
            전화번호
          </Button>
        </div>

        {/* 이메일/비밀번호 로그인 */}
        {loginMethod === 'email' && (
          <SchemaForm
            schema={loginFormSchema}
            onSubmit={handleEmailLogin}
          />
        )}

        {/* OTP 로그인 */}
        {loginMethod === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <Input
                type="tel"
                label="전화번호"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading || otpSent}
                placeholder="010-1234-5678"
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendOTP}
                disabled={loading || !phone || otpSent}
                style={{ marginTop: 'var(--spacing-lg)', alignSelf: 'flex-start' }}
              >
                {otpSent ? '전송됨' : '전송'}
              </Button>
            </div>
            {otpSent && (
              <SchemaForm
                schema={{
                  ...otpLoginFormSchema,
                  form: {
                    ...otpLoginFormSchema.form,
                    fields: otpLoginFormSchema.form.fields.filter((f: { name: string }) => f.name === 'otp'),
                  },
                }}
                onSubmit={(data: { otp: string }) => handleOTPLogin({ phone, otp: data.otp })}
              />
            )}
          </div>
        )}

        {/* 소셜 로그인 */}
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                width: '100%',
                borderTop: `var(--border-width-thin) solid var(--color-gray-300)`
              }}></div>
            </div>
            <div style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              fontSize: 'var(--font-size-sm)'
            }}>
              <span style={{
                padding: '0 var(--spacing-xs)',
                backgroundColor: 'var(--color-white)',
                color: 'var(--color-text-secondary)'
              }}>
                또는
              </span>
            </div>
          </div>

          <div style={{
            marginTop: 'var(--spacing-lg)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-sm)'
          }}>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              style={{ width: '100%' }}
            >
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('kakao')}
              disabled={loading}
              style={{ width: '100%' }}
            >
              Kakao
            </Button>
          </div>
        </div>

        {/* 회원가입 링크 */}
        <div style={{
          marginTop: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            계정이 없으신가요?{' '}
          </span>
          <button
            onClick={() => navigate('/auth/signup')}
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            회원가입
          </button>
        </div>
      </Card>
    </Container>
  );
}
