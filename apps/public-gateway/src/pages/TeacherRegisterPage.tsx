/**
 * Teacher Self Register Page
 *
 * [불변 규칙] 초대 링크 기반 강사 자체 등록 페이지
 * [업종중립] 강사/트레이너 등록
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 */

import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, useToast } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import {
  useValidateTeacherInvitation,
  useSelfRegisterTeacher,
  POSITION_LABELS,
} from '@hooks/use-class';
import type { TeacherPosition } from '@services/class-service';
import { teacherSelfRegisterSchema } from '../schemas/teacherSelfRegister.schema';

export function TeacherRegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const { data: invitation, isLoading, error } = useValidateTeacherInvitation(token);
  const registerTeacher = useSelfRegisterTeacher();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    if (!token) return;

    // 비밀번호 확인
    if (data.password !== data.password_confirm) {
      toast('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // login_id가 이메일 역할도 함
      const loginEmail = String(data.login_id);
      await registerTeacher.mutateAsync({
        name: String(data.name),
        phone: String(data.phone),
        email: loginEmail,
        login_id: loginEmail,
        password: String(data.password),
        token,
      });

      setIsRegistered(true);
      toast('등록이 완료되었습니다. 관리자에게 문의하여 계정 활성화를 요청하세요.', 'success');
    } catch (error) {
      toast(
        error instanceof Error ? error.message : '등록에 실패했습니다.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [token, registerTeacher, toast]);

  // 로딩 중
  if (isLoading) {
    return (
      <Container maxWidth="sm" padding="lg">
        <Card padding="lg" variant="default">
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
              color: 'var(--color-text-secondary)',
            }}
          >
            초대 링크 확인 중...
          </div>
        </Card>
      </Container>
    );
  }

  // 에러 또는 유효하지 않은 초대
  if (error || !invitation?.is_valid) {
    return (
      <Container maxWidth="sm" padding="lg">
        <Card padding="lg" variant="default">
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-xl)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-4xl)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-error)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              유효하지 않은 초대 링크
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              {invitation?.error || '이 초대 링크는 만료되었거나 이미 사용되었습니다.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  // 등록 완료
  if (isRegistered) {
    return (
      <Container maxWidth="sm" padding="lg">
        <Card padding="lg" variant="default">
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-xl)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-4xl)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              ✅
            </div>
            <h2
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-success)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              등록이 완료되었습니다
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              관리자가 계정을 활성화하면 로그인하실 수 있습니다.
              <br />
              문의사항은 학원 관리자에게 연락해주세요.
            </p>
            <Button variant="solid" color="primary" onClick={() => navigate('/')}>
              확인
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  // 등록 폼
  return (
    <Container maxWidth="sm" padding="lg">
      <Card padding="lg" variant="default">
        {/* 헤더 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 'var(--spacing-lg)',
            paddingBottom: 'var(--spacing-lg)',
            borderBottom: 'var(--border-width-thin) solid var(--color-border)',
          }}
        >
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            {invitation.tenant_name}
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            강사 등록
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary)',
              borderRadius: 'var(--border-radius-full)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            직급: {POSITION_LABELS[invitation.position as TeacherPosition]}
          </div>
        </div>

        {/* 안내 메시지 */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-info-50)',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 'var(--spacing-lg)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-info)',
          }}
        >
          아래 정보를 입력하여 등록을 완료해주세요.
          <br />
          등록 후 관리자 승인이 필요합니다.
        </div>

        {/* 등록 폼 */}
        <SchemaForm
          schema={teacherSelfRegisterSchema}
          onSubmit={handleSubmit}
          defaultValues={{}}
          actionContext={{
            apiCall: () => {
              throw new Error('API call not allowed in self-register form');
            },
            showToast: (message: string, variant?: string) => {
              const toastVariant = variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'info';
              toast(message, toastVariant);
            },
          }}
        />

        {/* 로딩 오버레이 */}
        {isSubmitting && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <div style={{ color: 'var(--color-text-secondary)' }}>
              등록 중...
            </div>
          </div>
        )}
      </Card>

      {/* 푸터 */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-lg)',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        문제가 있으신가요? 학원 관리자에게 문의해주세요.
      </div>
    </Container>
  );
}
