/**
 * 회원가입 페이지 (B2B)
 *
 * [기술문서 요구사항]
 * - 회원가입 프로세스: 사용자 계정 생성 + 이메일 인증(선택) + 테넌트 생성 및 정보 및 업종 및 초기 화면 로드
 * - [불변 규칙] 사용자 계정은 생성하며, 테넌트 생성은 core-tenancy/onboarding에서 처리
 *
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 * - 반응형 지원 (xs, sm, md, lg, xl)
 * - Design System 토큰 사용
 * - 접근성 WCAG 2.1 AAA 목표
 */

import { useNavigate } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode, isMobile } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useSignupWithEmail } from '@hooks/use-auth';
import { signupFormSchema } from '../schemas/signup.schema';
import type { IndustryType } from '@core/tenancy';

export function SignupPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const { showAlert } = useModal();

  const signup = useSignupWithEmail();

  const handleSignup = async (data: Record<string, unknown>) => {
    try {
      await signup.mutateAsync({
        email: String(data.email ?? ''),
        password: String(data.password ?? ''),
        name: String(data.name ?? ''),
        phone: data.phone ? String(data.phone) : undefined,
        tenant_name: String(data.tenantName ?? ''),
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
        console.error('회원가입 실패 상세:', {
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
          '개발 환경에서는 Supabase Dashboard > Authentication > Settings > Email Auth에서\n' +
          '"Enable email confirmations"를 비활성화하거나 "Auto Confirm"을 활성화하세요.'
        );
        navigate('/auth/login');
      } else {
        showAlert('오류', message);
      }
    }
  };

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
        padding={isMobileMode ? 'lg' : 'xl'}
        style={{ width: '100%' }}
      >
        <h1 style={{
          fontSize: isMobileMode ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          B2B 학원가입
        </h1>

        <SchemaForm
          schema={signupFormSchema}
          onSubmit={handleSignup}
        />

        {/* 로그인 링크 */}
        <div style={{
          marginTop: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            이미 계정이 있으신가요?{' '}
          </span>
          <button
            onClick={() => navigate('/auth/login')}
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
            로그인
          </button>
        </div>
      </Card>
    </Container>
  );
}
