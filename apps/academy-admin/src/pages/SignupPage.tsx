/**
 * 회원가입 페이지 (B2B)
 * 
 * [기술문서 요구사항]
 * - 회원가입 플로우: 사용자 계정 생성 → 이메일 인증(선택) → 테넌트 생성 및 온보딩 → 업종별 초기 데이터 시드
 * - [불변 규칙] 사용자 계정만 생성하며, 테넌트 생성은 core-tenancy/onboarding에서 처리
 * 
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 * - 반응형 지원 (xs, sm, md, lg, xl)
 * - Design System 토큰 사용
 * - 접근성 WCAG 2.1 AAA 목표
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
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

      // 회원가입 성공
      showAlert('성공', '회원가입이 완료되었습니다.');
      
      // 테넌트 선택 (자동으로 하나의 테넌트가 생성됨)
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '회원가입에 실패했습니다.';
      
      // 개발 환경에서 상세 에러 로그
      if (import.meta.env?.DEV) {
        console.error('❌ 회원가입 실패 상세:', {
          error,
          message,
          email: data.email,
          tenantName: data.tenantName,
        });
      }

      // 이메일 인증 필요 오류 처리
      if (error instanceof Error && message.includes('이메일 인증')) {
        showAlert(
          '알림',
          '이메일 인증이 필요합니다. 이메일을 확인해주세요.\n\n' +
          '⚠️ 개발 환경에서는 Supabase Dashboard > Authentication > Settings > Email Auth에서\n' +
          '"Enable email confirmations"를 비활성화하거나 "Auto Confirm"을 활성화하세요.'
        );
        navigate('/auth/login');
      } else {
        showAlert('오류', message);
      }
    }
  };

  const loading = signup.isPending;

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
      <Card className="w-full p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">B2B 회원가입</h1>

        <SchemaForm
          schema={signupFormSchema}
          onSubmit={handleSignup}
          defaultValues={{
            industryType: 'academy',
          }}
        />

        {/* 로그인 링크 */}
        <div className="mt-6 text-center">
          <span className="text-gray-600">이미 계정이 있으신가요? </span>
          <button
            onClick={() => navigate('/auth/login')}
            className="text-primary hover:underline"
          >
            로그인
          </button>
        </div>
      </Card>
    </Container>
  );
}
