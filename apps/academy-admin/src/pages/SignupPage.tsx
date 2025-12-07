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
import { Container, Card, Button, Input, Select, useModal, useResponsiveMode } from '@ui-core/react';
import { useSignupWithEmail } from '@hooks/use-auth';
import type { IndustryType } from '@core/tenancy';

export function SignupPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  // 사용자 정보
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // 테넌트 정보
  const [tenantName, setTenantName] = useState('');
  const [industryType, setIndustryType] = useState<IndustryType>('academy');

  const signup = useSignupWithEmail();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (password !== passwordConfirm) {
      showAlert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      showAlert('오류', '비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (!tenantName.trim()) {
      showAlert('오류', '테넌트 이름을 입력해주세요.');
      return;
    }

    try {
      const result = await signup.mutateAsync({
        email,
        password,
        name,
        phone: phone || undefined,
        tenant_name: tenantName,
        industry_type: industryType,
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
          email,
          tenantName,
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

        <form onSubmit={handleSignup} className="space-y-4">
          {/* 사용자 정보 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">사용자 정보</h2>
            
            <Input
              type="text"
              label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
            />

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
              type="tel"
              label="전화번호 (선택)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="010-1234-5678"
              autoComplete="tel"
            />

            <Input
              type="password"
              label="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              minLength={8}
            />

            <Input
              type="password"
              label="비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {/* 테넌트 정보 */}
          <div className="space-y-4 mt-6">
            <h2 className="text-lg font-semibold">테넌트 정보</h2>

            <Input
              type="text"
              label="테넌트 이름"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              disabled={loading}
              placeholder="예: 서울 학원"
            />

            <Select
              label="업종"
              value={industryType}
              onChange={(e) => setIndustryType(e.target.value as IndustryType)}
              required
              disabled={loading}
            >
              <option value="academy">학원</option>
              <option value="salon">미용실</option>
              <option value="realestate">부동산</option>
              <option value="gym">헬스장</option>
              <option value="ngo">비영리단체</option>
            </Select>
          </div>

          <Button
            type="submit"
            variant="solid"
            className="w-full mt-6"
            disabled={loading}
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </Button>
        </form>

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
