/**
 * 회원가입 페이지 (B2B)
 *
 * [LAYER: UI_PAGE]
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

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, useModal, useResponsiveMode, isMobile, AddressSearchInput } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useSignupWithEmail } from '@hooks/use-auth';
import { signupFormSchema } from '../schemas/signup.schema';
import type { IndustryType } from '@core/tenancy';
import type { RegionInfo } from '@core/auth';
import type { ParsedRegionInfo } from '@lib/kakao-address';
import { logError, createSafeNavigate } from '../utils';
import { maskPII } from '@core/pii-utils';

export function SignupPage() {
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const { showAlert } = useModal();

  const signup = useSignupWithEmail();

  // 주소 검색 상태 (SchemaForm 외부에서 관리)
  const [address, setAddress] = useState('');
  const [regionInfo, setRegionInfo] = useState<RegionInfo | null>(null);

  // 주소 선택 핸들러
  const handleAddressChange = useCallback((newAddress: string, parsedInfo: ParsedRegionInfo | null) => {
    setAddress(newAddress);
    if (parsedInfo) {
      setRegionInfo({
        si: parsedInfo.si,
        gu: parsedInfo.gu,
        dong: parsedInfo.dong,
        sido_code: parsedInfo.sido_code,
        sigungu_code: parsedInfo.sigungu_code,
        dong_code: parsedInfo.h_code,
        latitude: parsedInfo.latitude,
        longitude: parsedInfo.longitude,
      });
    } else {
      setRegionInfo(null);
    }
  }, []);

  const handleSignup = async (data: Record<string, unknown>) => {
    try {
      // P0-1: 비밀번호 확인 검증
      if (data.password !== data.passwordConfirm) {
        showAlert('비밀번호가 일치하지 않습니다.', '오류');
        return;
      }

      // P1-1: 이메일 중복 체크는 Supabase Auth에서 자동 처리
      // auth.users는 직접 쿼리할 수 없으므로 signUp 시 에러로 처리
      // 이메일 형식 검증만 수행
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(data.email ?? ''))) {
        showAlert('올바른 이메일 형식이 아닙니다.', '오류');
        return;
      }

      // P2-1: 주소 필수 입력 검증
      if (!address || !regionInfo) {
        showAlert('사업장 주소를 입력해주세요.', '오류');
        return;
      }

      await signup.mutateAsync({
        email: String(data.email ?? ''),
        password: String(data.password ?? ''),
        name: String(data.name ?? ''),
        phone: data.phone ? String(data.phone) : undefined,
        tenant_name: String(data.tenantName ?? ''),
        industry_type: data.industryType as IndustryType,
        address: address || undefined,
        region_info: regionInfo || undefined,
      });

      // 회원가입 성공
      showAlert('회원가입이 완료되었습니다.', '성공');

      // 테넌트 선택 (자동으로 하나의 테넌트가 생성됨)
      safeNavigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '회원가입에 실패했습니다.';

      // 개발 환경에서 상세 에러 로그
      if (import.meta.env?.DEV) {
        logError('SignupPage:SignupFailed', error);
        logError('SignupPage:SignupFailed:Details', maskPII({
          message,
          email: data.email,
          tenantName: data.tenantName,
        }));
      }

      // 이메일 인증 필요 오류 처리
      if (error instanceof Error && message.includes('이메일 인증')) {
        showAlert(
          '이메일 인증이 필요합니다. 이메일을 확인해주세요.\n\n' +
          '개발 환경에서는 Supabase Dashboard > Authentication > Settings > Email Auth에서\n' +
          '"Enable email confirmations"를 비활성화하거나 "Auto Confirm"을 활성화하세요.',
          '알림'
        );
        safeNavigate('/auth/login');
      } else if (error instanceof Error && (message.includes('already registered') || message.includes('User already registered'))) {
        // 이메일 중복 에러 처리
        showAlert('이미 사용 중인 이메일입니다.', '오류');
      } else {
        showAlert(message, '오류');
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
          회원가입
        </h1>

        <SchemaForm
          schema={signupFormSchema}
          onSubmit={handleSignup}
        />

        {/* 주소 검색 필드 (SchemaForm 외부) - P2-1: 필수 입력 */}
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <AddressSearchInput
            value={address}
            onChange={handleAddressChange}
            label="사업장 주소 *"
            placeholder="도로명 또는 지번 주소 검색"
            required
          />
          {regionInfo && (
            <div
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {regionInfo.si} {regionInfo.gu} {regionInfo.dong}
            </div>
          )}
        </div>

        {/* 로그인 링크 */}
        <div style={{
          marginTop: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            이미 계정이 있으신가요?{' '}
          </span>
          <button
            onClick={() => safeNavigate('/auth/login')}
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              // HARD-CODE-EXCEPTION: padding 0은 레이아웃용 특수 값
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
