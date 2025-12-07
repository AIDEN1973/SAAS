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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Input, useModal, useResponsiveMode } from '@ui-core/react';
import { useLoginWithEmail, useLoginWithOAuth, useLoginWithOTP, useSelectTenant } from '@hooks/use-auth';
import { setApiContext } from '@api-sdk/core';

type LoginMethod = 'email' | 'oauth' | 'otp';

export function LoginPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginWithEmail = useLoginWithEmail();
  const loginWithOAuth = useLoginWithOAuth();
  const loginWithOTP = useLoginWithOTP();
  const selectTenant = useSelectTenant();

  // 이메일/비밀번호 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      showAlert('이메일과 비밀번호를 입력해주세요.', '입력 오류', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithEmail.mutateAsync({
        email,
        password,
      });

      // 테넌트가 1개인 경우 자동 선택
      if (result.tenants.length === 1) {
        // 테넌트 자동 선택
        const tenant = result.tenants[0];
        const selectResult = await selectTenant.mutateAsync(tenant.id);
        setApiContext({ 
          tenantId: tenant.id, 
          industryType: tenant.industry_type as any,
          authToken: selectResult.access_token,
        });
        navigate('/');
      } else if (result.tenants.length > 1) {
        // 여러 테넌트가 있는 경우 테넌트 선택 페이지로 이동
        navigate('/auth/select-tenant', { state: { tenants: result.tenants } });
      } else {
        // 테넌트가 없는 경우 (신규 사용자)
        navigate('/auth/signup');
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '로그인에 실패했습니다.',
        '로그인 실패',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // 소셜 로그인
  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setLoading(true);
    try {
      const result = await loginWithOAuth.mutateAsync({
        provider,
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      
      // OAuth 리다이렉트
      window.location.href = result.url;
    } catch (error) {
      setLoading(false);
      showAlert(
        error instanceof Error ? error.message : '소셜 로그인에 실패했습니다.',
        '로그인 실패',
        'error'
      );
    }
  };

  // OTP 전송 (TODO: 실제 OTP 전송 API 구현 필요)
  const handleSendOTP = async () => {
    if (!phone) {
      showAlert('전화번호를 입력해주세요.', '입력 오류', 'warning');
      return;
    }

    // TODO: OTP 전송 API 호출
    setOtpSent(true);
    showAlert('OTP가 전송되었습니다.', 'OTP 전송', 'success');
  };

  // OTP 로그인
  const handleOTPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !otp) {
      showAlert('전화번호와 OTP를 입력해주세요.', '입력 오류', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithOTP.mutateAsync({
        phone,
        otp,
      });

      // 테넌트가 1개인 경우 자동 선택
      if (result.tenants.length === 1) {
        const tenant = result.tenants[0];
        const selectResult = await selectTenant.mutateAsync(tenant.id);
        setApiContext({ 
          tenantId: tenant.id, 
          industryType: tenant.industry_type as any,
          authToken: selectResult.access_token,
        });
        navigate('/');
      } else if (result.tenants.length > 1) {
        navigate('/auth/select-tenant', { state: { tenants: result.tenants } });
      } else {
        navigate('/auth/signup');
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : 'OTP 인증에 실패했습니다.',
        '로그인 실패',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      padding="lg"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <Card
        padding="xl"
        variant="elevated"
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '400px',
        }}
      >
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--spacing-xs)',
              color: 'var(--color-text)',
              textAlign: 'center',
            }}
          >
            디어쌤 로그인
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            학원 관리 시스템에 로그인하세요
          </p>
        </div>

        {/* 로그인 방법 선택 */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-xs)',
            marginBottom: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setLoginMethod('email')}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderBottom: loginMethod === 'email' ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'transparent',
              color: loginMethod === 'email' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: loginMethod === 'email' ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              cursor: 'pointer',
            }}
          >
            이메일
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('oauth')}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderBottom: loginMethod === 'oauth' ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'transparent',
              color: loginMethod === 'oauth' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: loginMethod === 'oauth' ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              cursor: 'pointer',
            }}
          >
            소셜
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('otp')}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderBottom: loginMethod === 'otp' ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'transparent',
              color: loginMethod === 'otp' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: loginMethod === 'otp' ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              cursor: 'pointer',
            }}
          >
            OTP
          </button>
        </div>

        {/* 이메일/비밀번호 로그인 */}
        {loginMethod === 'email' && (
          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="email"
                label="이메일"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <Input
                type="password"
                label="비밀번호"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              variant="solid"
              color="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
            <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/auth/forgot-password')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </form>
        )}

        {/* 소셜 로그인 */}
        {loginMethod === 'oauth' && (
          <div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Button
                type="button"
                variant="outline"
                color="primary"
                size="lg"
                fullWidth
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                style={{
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Google로 로그인
              </Button>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                color="primary"
                size="lg"
                fullWidth
                onClick={() => handleOAuthLogin('kakao')}
                disabled={loading}
              >
                Kakao로 로그인
              </Button>
            </div>
          </div>
        )}

        {/* OTP 로그인 */}
        {loginMethod === 'otp' && (
          <form onSubmit={handleOTPLogin}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="tel"
                label="전화번호"
                placeholder="전화번호를 입력하세요"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                fullWidth
                autoComplete="tel"
                disabled={otpSent}
              />
            </div>
            {otpSent && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <Input
                  type="text"
                  label="OTP 코드"
                  placeholder="OTP 코드를 입력하세요"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  fullWidth
                  maxLength={6}
                />
              </div>
            )}
            {!otpSent ? (
              <Button
                type="button"
                variant="solid"
                color="primary"
                size="lg"
                fullWidth
                onClick={handleSendOTP}
                disabled={loading}
              >
                OTP 전송
              </Button>
            ) : (
              <Button
                type="submit"
                variant="solid"
                color="primary"
                size="lg"
                fullWidth
                disabled={loading}
              >
                {loading ? '인증 중...' : '로그인'}
              </Button>
            )}
          </form>
        )}

        {/* 회원가입 링크 */}
        <div
          style={{
            marginTop: 'var(--spacing-xl)',
            paddingTop: 'var(--spacing-lg)',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            계정이 없으신가요?
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth/signup')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            회원가입
          </button>
        </div>
      </Card>
    </Container>
  );
}

