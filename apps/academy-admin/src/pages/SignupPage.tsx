/**
 * ?Œì›ê°€???˜ì´ì§€ (B2B)
 * 
 * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - ?Œì›ê°€???Œë¡œ?? ?¬ìš©??ê³„ì • ?ì„± ???´ë©”???¸ì¦(? íƒ) ???Œë„Œ???ì„± ë°??¨ë³´?????…ì¢…ë³?ì´ˆê¸° ?°ì´???œë“œ
 * - [ë¶ˆë? ê·œì¹™] ?¬ìš©??ê³„ì •ë§??ì„±?˜ë©°, ?Œë„Œ???ì„±?€ core-tenancy/onboarding?ì„œ ì²˜ë¦¬
 * 
 * [UI ë¬¸ì„œ ?”êµ¬?¬í•­]
 * - Zero-Trust ?ì¹™ ì¤€??
 * - ë°˜ì‘??ì§€??(xs, sm, md, lg, xl)
 * - Design System ? í° ?¬ìš©
 * - ?‘ê·¼??WCAG 2.1 AAA ëª©í‘œ
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
import { useSignupWithEmail } from '@hooks/use-auth';
import { signupFormSchema } from '../schemas/signup.schema';
import type { IndustryType } from '@core/tenancy';

export function SignupPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const signup = useSignupWithEmail();

  const handleSignup = async (data: any) => {
    try {
      const result = await signup.mutateAsync({
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone || undefined,
        tenant_name: data.tenantName,
        industry_type: data.industryType as IndustryType,
      });

      // ?Œì›ê°€???±ê³µ
      showAlert('?±ê³µ', '?Œì›ê°€?…ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??');
      
      // ?Œë„Œ??? íƒ (?ë™?¼ë¡œ ?˜ë‚˜???Œë„Œ?¸ê? ?ì„±??
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '?Œì›ê°€?…ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      
      // ê°œë°œ ?˜ê²½?ì„œ ?ì„¸ ?ëŸ¬ ë¡œê·¸
      if (import.meta.env?.DEV) {
        console.error('???Œì›ê°€???¤íŒ¨ ?ì„¸:', {
          error,
          message,
          email: data.email,
          tenantName: data.tenantName,
        });
      }

      // ?´ë©”???¸ì¦ ?„ìš” ?¤ë¥˜ ì²˜ë¦¬
      if (error instanceof Error && message.includes('?´ë©”???¸ì¦')) {
        showAlert(
          '?Œë¦¼',
          '?´ë©”???¸ì¦???„ìš”?©ë‹ˆ?? ?´ë©”?¼ì„ ?•ì¸?´ì£¼?¸ìš”.\n\n' +
          '? ï¸ ê°œë°œ ?˜ê²½?ì„œ??Supabase Dashboard > Authentication > Settings > Email Auth?ì„œ\n' +
          '"Enable email confirmations"ë¥?ë¹„í™œ?±í™”?˜ê±°??"Auto Confirm"???œì„±?”í•˜?¸ìš”.'
        );
        navigate('/auth/login');
      } else {
        showAlert('?¤ë¥˜', message);
      }
    }
  };

  const loading = signup.isPending;

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">B2B ?Œì›ê°€??/h1>

        <SchemaForm
          schema={signupFormSchema}
          onSubmit={handleSignup}
          defaultValues={{
            industryType: 'academy',
          }}
        />

        {/* ë¡œê·¸??ë§í¬ */}
        <div className="mt-6 text-center">
          <span className="text-gray-600">?´ë? ê³„ì •???ˆìœ¼? ê??? </span>
          <button
            onClick={() => navigate('/auth/login')}
            className="text-primary hover:underline"
          >
            ë¡œê·¸??
          </button>
        </div>
      </Card>
    </Container>
  );
}
