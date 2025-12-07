/**
 * Super Admin 로그인 페이지
 * 
 * [불변 규칙] 스키마 엔진 기반 로그인 폼
 * [불변 규칙] Zero-Trust: 인증 로직은 core-auth 모듈에서 공통 관리
 * [불변 규칙] academy-admin 앱과 동일한 인증 로직 사용
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode } from '@ui-core/react';
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
  const [searchParams] = useSearchParams();
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
          window.location.href = decodeURIComponent(returnTo);
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

  const handleOTPLogin = async (data: { otp: string }) => {
    try {
      const result = await loginWithOTP.mutateAsync({ phone, otp: data.otp });
      
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
          window.location.href = decodeURIComponent(returnTo);
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
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">Super Admin 로그인</h1>

        {/* 로그인 방법 선택 */}
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => {
              setLoginMethod('email');
              setOtpSent(false);
            }}
            className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
              loginMethod === 'email'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            이메일
          </button>
          <button
            onClick={() => {
              setLoginMethod('oauth');
              setOtpSent(false);
            }}
            className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
              loginMethod === 'oauth'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            소셜 로그인
          </button>
          <button
            onClick={() => {
              setLoginMethod('otp');
              setOtpSent(false);
            }}
            className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
              loginMethod === 'otp'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
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
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
              disabled={loginWithOAuth.isPending}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              className="w-full py-3 px-4 border border-yellow-300 bg-yellow-400 rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-3"
              disabled={loginWithOAuth.isPending}
            >
              <span className="text-gray-900 font-medium">카카오로 로그인</span>
            </button>
          </div>
        )}

        {/* 전화번호/OTP 로그인 */}
        {loginMethod === 'otp' && (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSendOTP}
                  disabled={!phone || sendOTP.isPending}
                  className="w-full py-3 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

