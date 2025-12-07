/**
 * Super Admin ë¡œê·¸???˜ì´ì§€
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§??”ì§„ ê¸°ë°˜ ë¡œê·¸????
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: ?¸ì¦ ë¡œì§?€ core-auth ëª¨ë“ˆ?ì„œ ê³µí†µ ê´€ë¦?
 * [ë¶ˆë? ê·œì¹™] academy-admin ?±ê³¼ ?™ì¼???¸ì¦ ë¡œì§ ?¬ìš©
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
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
          '?Œë¦¼',
          '?Œì†???Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤.\n\n' +
          '?Œì›ê°€?…ì„ ì§„í–‰?˜ì‹œê±°ë‚˜, ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.'
        );
        return;
      }

      if (result.tenants.length === 1) {
        // ?Œë„Œ?¸ê? ?˜ë‚˜ë©??ë™ ? íƒ
        await selectTenant.mutateAsync(result.tenants[0].id);
        
        // returnTo ?Œë¼ë¯¸í„° ?•ì¸
        const returnTo = searchParams.get('returnTo');
        if (returnTo) {
          window.location.href = decodeURIComponent(returnTo);
        } else {
          navigate('/');
        }
      } else {
        // ?¬ëŸ¬ ?Œë„Œ?¸ë©´ ? íƒ ?˜ì´ì§€ë¡??´ë™
        navigate('/auth/tenant-selection');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    try {
      await loginWithOAuth.mutateAsync({ provider });
    } catch (error) {
      const message = error instanceof Error ? error.message : '?Œì…œ ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const handleSendOTP = async () => {
    try {
      await sendOTP.mutateAsync(phone);
      setOtpSent(true);
      showAlert('?±ê³µ', '?¸ì¦ë²ˆí˜¸ê°€ ?„ì†¡?˜ì—ˆ?µë‹ˆ??');
    } catch (error) {
      const message = error instanceof Error ? error.message : '?¸ì¦ë²ˆí˜¸ ?„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const handleOTPLogin = async (data: { otp: string }) => {
    try {
      const result = await loginWithOTP.mutateAsync({ phone, otp: data.otp });
      
      if (result.tenants.length === 0) {
        showAlert(
          '?Œë¦¼',
          '?Œì†???Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤.\n\n' +
          '?Œì›ê°€?…ì„ ì§„í–‰?˜ì‹œê±°ë‚˜, ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.'
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
      const message = error instanceof Error ? error.message : 'ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">Super Admin ë¡œê·¸??/h1>

        {/* ë¡œê·¸??ë°©ë²• ? íƒ */}
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
            ?´ë©”??
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
            ?Œì…œ ë¡œê·¸??
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
            ?„í™”ë²ˆí˜¸
          </button>
        </div>

        {/* ?´ë©”??ë¡œê·¸??*/}
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

        {/* ?Œì…œ ë¡œê·¸??*/}
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
              <span>Googleë¡?ë¡œê·¸??/span>
            </button>
            <button
              onClick={() => handleOAuthLogin('kakao')}
              className="w-full py-3 px-4 border border-yellow-300 bg-yellow-400 rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-3"
              disabled={loginWithOAuth.isPending}
            >
              <span className="text-gray-900 font-medium">ì¹´ì¹´?¤ë¡œ ë¡œê·¸??/span>
            </button>
          </div>
        )}

        {/* ?„í™”ë²ˆí˜¸/OTP ë¡œê·¸??*/}
        {loginMethod === 'otp' && (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ?„í™”ë²ˆí˜¸
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
                  {sendOTP.isPending ? '?„ì†¡ ì¤?..' : '?¸ì¦ë²ˆí˜¸ ?„ì†¡'}
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

