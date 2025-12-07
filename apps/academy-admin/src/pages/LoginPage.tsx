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
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithOTP,
  useSendOTP,
  useUserTenants,
  useSelectTenant,
} from '@hooks/use-auth';

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

  const loginWithEmail = useLoginWithEmail();
  const loginWithOAuth = useLoginWithOAuth();
  const sendOTP = useSendOTP();
  const loginWithOTP = useLoginWithOTP();
  const { data: tenants } = useUserTenants();
  const selectTenant = useSelectTenant();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await loginWithEmail.mutateAsync({ email, password });
      
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

  const handleOTPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await loginWithOTP.mutateAsync({ phone, otp });
      
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
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">로그인</h1>

        {/* 로그인 방법 선택 */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={loginMethod === 'email' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('email')}
            className="flex-1"
          >
            이메일
          </Button>
          <Button
            variant={loginMethod === 'otp' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('otp')}
            className="flex-1"
          >
            전화번호
          </Button>
        </div>

        {/* 이메일/비밀번호 로그인 */}
        {loginMethod === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <Input
              type="email"
              label="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
            <Input
              type="password"
              label="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="solid"
              className="w-full"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        )}

        {/* OTP 로그인 */}
        {loginMethod === 'otp' && (
          <form onSubmit={handleOTPLogin} className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="tel"
                label="전화번호"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading || otpSent}
                placeholder="010-1234-5678"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendOTP}
                disabled={loading || !phone || otpSent}
                className="mt-6"
              >
                {otpSent ? '전송됨' : '전송'}
              </Button>
            </div>
            {otpSent && (
              <Input
                type="text"
                label="OTP 코드"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                disabled={loading}
                placeholder="6자리 코드"
                maxLength={6}
              />
            )}
            <Button
              type="submit"
              variant="solid"
              className="w-full"
              disabled={loading || !otpSent}
            >
              {loading ? '인증 중...' : '로그인'}
            </Button>
          </form>
        )}

        {/* 소셜 로그인 */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full"
            >
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('kakao')}
              disabled={loading}
              className="w-full"
            >
              Kakao
            </Button>
          </div>
        </div>

        {/* 회원가입 링크 */}
        <div className="mt-6 text-center">
          <span className="text-gray-600">계정이 없으신가요? </span>
          <button
            onClick={() => navigate('/auth/signup')}
            className="text-primary hover:underline"
          >
            회원가입
          </button>
        </div>
      </Card>
    </Container>
  );
}
