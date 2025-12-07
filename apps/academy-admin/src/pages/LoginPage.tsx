/**
 * ë¡œê·¸???˜ì´ì§€
 * 
 * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - ?¸ì¦ ë¡œì§?€ core-auth ëª¨ë“ˆ?ì„œ ê³µí†µ ê´€ë¦?
 * - ì§€???¸ì¦ ë°©ì‹: ?´ë©”??ë¹„ë?ë²ˆí˜¸, ?Œì…œ ë¡œê·¸??Google, Kakao), ?„í™”ë²ˆí˜¸Â·OTP
 * - ë¡œê·¸???Œë¡œ?? ?¬ìš©???¸ì¦ ???Œë„Œ??ëª©ë¡ ì¡°íšŒ ???Œë„Œ??? íƒ ??JWT claim??tenant_id ?¬í•¨
 * 
 * [UI ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - Zero-Trust ?ì¹™ ì¤€??
 * - ë°˜ì‘??ì§€??(xs, sm, md, lg, xl)
 * - Design System ? í° ?¬ìš©
 * - ?‘ê·¼??WCAG 2.1 AAA ëª©í‘œ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Input, useModal, useResponsiveMode } from '@ui-core/react';
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
        // ê°œë°œ ?˜ê²½?ì„œ ?ì„¸ ?•ë³´ ?œì‹œ
        if (import.meta.env?.DEV) {
          console.warn('? ï¸ ?Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤:', {
            userId: result.user.id,
            email: result.user.email,
          });
          console.log('?’¡ ê°€?¥í•œ ?ì¸:');
          console.log('   1. ?Œì›ê°€?????Œë„Œ?¸ê? ?ì„±?˜ì? ?Šì•˜?????ˆìŒ');
          console.log('   2. user_tenant_roles???ˆì½”?œê? ?†ì„ ???ˆìŒ');
          console.log('   3. RLS ?•ì±… ?Œë¬¸??ì¡°íšŒê°€ ???????ˆìŒ');
          console.log('   ??Supabase Dashboard?ì„œ ?•ì¸:');
          console.log('      - Authentication > Users: ?¬ìš©???•ì¸');
          console.log('      - Table Editor > user_tenant_roles: ?Œë„Œ??ê´€ê³??•ì¸');
          console.log('      - Table Editor > tenants: ?Œë„Œ???•ì¸');
        }
        
        showAlert(
          '?Œë¦¼',
          '?Œì†???Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤.\n\n' +
          '?Œì›ê°€?…ì„ ì§„í–‰?˜ì‹œê±°ë‚˜, ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.\n\n' +
          (import.meta.env?.DEV
            ? '? ï¸ ê°œë°œ ?˜ê²½: ë¸Œë¼?°ì? ì½˜ì†”?ì„œ ?ì„¸ ?•ë³´ë¥??•ì¸?˜ì„¸??'
            : '')
        );
        navigate('/auth/signup');
        return;
      }

      if (result.tenants.length === 1) {
        // ?Œë„Œ?¸ê? ?˜ë‚˜ë©??ë™ ? íƒ
        await selectTenant.mutateAsync(result.tenants[0].id);
        navigate('/');
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
      const { url } = await loginWithOAuth.mutateAsync({ provider });
      window.location.href = url;
    } catch (error) {
      const message = error instanceof Error ? error.message : '?Œì…œ ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const handleSendOTP = async () => {
    try {
      await sendOTP.mutateAsync(phone);
      setOtpSent(true);
      showAlert('?Œë¦¼', 'OTPê°€ ?„ì†¡?˜ì—ˆ?µë‹ˆ??');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP ?„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const handleOTPLogin = async (data: { phone: string; otp: string }) => {
    try {
      const result = await loginWithOTP.mutateAsync({ phone: data.phone, otp: data.otp });
      
      if (result.tenants.length === 0) {
        // ê°œë°œ ?˜ê²½?ì„œ ?ì„¸ ?•ë³´ ?œì‹œ
        if (import.meta.env?.DEV) {
          console.warn('? ï¸ ?Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤:', {
            userId: result.user.id,
            phone: result.user.phone,
          });
          console.log('?’¡ ê°€?¥í•œ ?ì¸:');
          console.log('   1. ?Œì›ê°€?????Œë„Œ?¸ê? ?ì„±?˜ì? ?Šì•˜?????ˆìŒ');
          console.log('   2. user_tenant_roles???ˆì½”?œê? ?†ì„ ???ˆìŒ');
          console.log('   3. RLS ?•ì±… ?Œë¬¸??ì¡°íšŒê°€ ???????ˆìŒ');
          console.log('   ??Supabase Dashboard?ì„œ ?•ì¸:');
          console.log('      - Authentication > Users: ?¬ìš©???•ì¸');
          console.log('      - Table Editor > user_tenant_roles: ?Œë„Œ??ê´€ê³??•ì¸');
          console.log('      - Table Editor > tenants: ?Œë„Œ???•ì¸');
        }
        
        showAlert(
          '?Œë¦¼',
          '?Œì†???Œë„Œ?¸ê? ?†ìŠµ?ˆë‹¤.\n\n' +
          '?Œì›ê°€?…ì„ ì§„í–‰?˜ì‹œê±°ë‚˜, ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?´ì£¼?¸ìš”.\n\n' +
          (import.meta.env?.DEV
            ? '? ï¸ ê°œë°œ ?˜ê²½: ë¸Œë¼?°ì? ì½˜ì†”?ì„œ ?ì„¸ ?•ë³´ë¥??•ì¸?˜ì„¸??'
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
      const message = error instanceof Error ? error.message : 'OTP ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      showAlert('?¤ë¥˜', message);
    }
  };

  const loading = loginWithEmail.isPending || loginWithOAuth.isPending || loginWithOTP.isPending || sendOTP.isPending;

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">ë¡œê·¸??/h1>

        {/* ë¡œê·¸??ë°©ë²• ? íƒ */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={loginMethod === 'email' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('email')}
            className="flex-1"
          >
            ?´ë©”??
          </Button>
          <Button
            variant={loginMethod === 'otp' ? 'solid' : 'outline'}
            onClick={() => setLoginMethod('otp')}
            className="flex-1"
          >
            ?„í™”ë²ˆí˜¸
          </Button>
        </div>

        {/* ?´ë©”??ë¹„ë?ë²ˆí˜¸ ë¡œê·¸??*/}
        {loginMethod === 'email' && (
          <SchemaForm
            schema={loginFormSchema}
            onSubmit={handleEmailLogin}
          />
        )}

        {/* OTP ë¡œê·¸??*/}
        {loginMethod === 'otp' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="tel"
                label="?„í™”ë²ˆí˜¸"
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
                {otpSent ? '?„ì†¡?? : '?„ì†¡'}
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

        {/* ?Œì…œ ë¡œê·¸??*/}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">?ëŠ”</span>
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

        {/* ?Œì›ê°€??ë§í¬ */}
        <div className="mt-6 text-center">
          <span className="text-gray-600">ê³„ì •???†ìœ¼? ê??? </span>
          <button
            onClick={() => navigate('/auth/signup')}
            className="text-primary hover:underline"
          >
            ?Œì›ê°€??
          </button>
        </div>
      </Card>
    </Container>
  );
}
