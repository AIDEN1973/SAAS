/**
 * 회원가입 페이지
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
import { useSignupWithEmail, useCreateTenant } from '@hooks/use-auth';

export function SignupPage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const { showAlert } = useModal();

  const [step, setStep] = useState<'user' | 'tenant'>('user');
  const [loading, setLoading] = useState(false);

  // 사용자 정보
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // 테넌트 정보
  const [tenantName, setTenantName] = useState('');
  const [industryType, setIndustryType] = useState<'academy' | 'salon' | 'realestate' | 'gym' | 'ngo'>('academy');
  const [userId, setUserId] = useState<string | null>(null);

  const signupWithEmail = useSignupWithEmail();
  const createTenant = useCreateTenant();

  // 비밀번호 유효성 검사
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다.';
    }
    if (!/[A-Za-z]/.test(pwd)) {
      return '비밀번호는 영문자를 포함해야 합니다.';
    }
    if (!/[0-9]/.test(pwd)) {
      return '비밀번호는 숫자를 포함해야 합니다.';
    }
    return null;
  };

  // 사용자 계정 생성
  const handleUserSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !passwordConfirm || !name) {
      showAlert('모든 필수 항목을 입력해주세요.', '입력 오류', 'warning');
      return;
    }

    if (password !== passwordConfirm) {
      showAlert('비밀번호가 일치하지 않습니다.', '입력 오류', 'warning');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      showAlert(passwordError, '비밀번호 오류', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await signupWithEmail.mutateAsync({
        email,
        password,
        name,
        phone: phone || undefined,
      });

      if (result.needsEmailVerification) {
        showAlert(
          '이메일 인증 링크를 발송했습니다. 이메일을 확인해주세요.',
          '이메일 인증',
          'info'
        );
        navigate('/auth/verify-email');
      } else {
        // 이메일 인증이 필요 없는 경우 사용자 ID 저장 후 테넌트 생성 단계로 이동
        if (result.user?.id) {
          setUserId(result.user.id);
        }
        setStep('tenant');
      }
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '회원가입에 실패했습니다.',
        '회원가입 실패',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // 테넌트 생성 및 온보딩
  const handleTenantCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantName) {
      showAlert('학원명을 입력해주세요.', '입력 오류', 'warning');
      return;
    }

    if (!userId) {
      showAlert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.', '오류', 'error');
      navigate('/auth/login');
      return;
    }

    setLoading(true);
    try {
      const result = await createTenant.mutateAsync({
        name: tenantName,
        industry_type: industryType,
        owner_user_id: userId,
        plan: 'basic', // 기본 플랜
      });

      showAlert('회원가입이 완료되었습니다.', '회원가입 완료', 'success');
      
      // 로그인 페이지로 이동
      navigate('/auth/login', { state: { message: '회원가입이 완료되었습니다. 로그인해주세요.' } });
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '테넌트 생성에 실패했습니다.',
        '테넌트 생성 실패',
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
          maxWidth: isMobile ? '100%' : '500px',
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
            회원가입
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            {step === 'user' ? '1단계: 사용자 계정 생성' : '2단계: 학원 정보 입력'}
          </p>
        </div>

        {/* 사용자 계정 생성 */}
        {step === 'user' && (
          <form onSubmit={handleUserSignup}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="text"
                label="이름"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                autoComplete="name"
              />
            </div>
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
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="tel"
                label="전화번호 (선택)"
                placeholder="전화번호를 입력하세요"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                autoComplete="tel"
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="password"
                label="비밀번호"
                placeholder="비밀번호를 입력하세요 (8자 이상, 영문+숫자)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
              />
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: 'var(--spacing-xs)',
                }}
              >
                8자 이상, 영문자와 숫자를 포함해야 합니다.
              </p>
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <Input
                type="password"
                label="비밀번호 확인"
                placeholder="비밀번호를 다시 입력하세요"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
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
              {loading ? '처리 중...' : '다음'}
            </Button>
          </form>
        )}

        {/* 테넌트 생성 */}
        {step === 'tenant' && (
          <form onSubmit={handleTenantCreate}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Input
                type="text"
                label="학원명"
                placeholder="학원명을 입력하세요"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                fullWidth
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <Select
                label="업종"
                value={industryType}
                onChange={(e) => setIndustryType(e.target.value as any)}
                fullWidth
                required
              >
                <option value="academy">학원</option>
                <option value="salon">미용실/네일샵</option>
                <option value="realestate">부동산</option>
                <option value="gym">체육관</option>
                <option value="ngo">비영리 기관</option>
              </Select>
            </div>
            <Button
              type="submit"
              variant="solid"
              color="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? '처리 중...' : '회원가입 완료'}
            </Button>
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Button
                type="button"
                variant="outline"
                color="secondary"
                size="md"
                fullWidth
                onClick={() => setStep('user')}
                disabled={loading}
              >
                이전
              </Button>
            </div>
          </form>
        )}

        {/* 로그인 링크 */}
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
            이미 계정이 있으신가요?
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
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
            로그인
          </button>
        </div>
      </Card>
    </Container>
  );
}

