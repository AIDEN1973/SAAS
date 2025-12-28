/**
 * 학생 상세 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * 현재 구현은 `StudentsPage`의 레이어 메뉴(`/students/list?student=...`)로 통합되었습니다.
 * 기존 상세 라우트는 정합성을 위해 리다이렉트만 수행합니다.
 */

import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary, Container, Card, PageHeader } from '@ui-core/react';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES } from '../constants';
import { createSafeNavigate } from '../utils';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  useEffect(() => {
    if (!id) return;

    const path = location.pathname;
    const tab =
      path.includes('/attendance') ? 'attendance'
      : path.includes('/risk') ? 'risk'
      : path.includes('/welcome') ? 'welcome'
      : path.includes('/guardians') ? 'guardians'
      : path.includes('/consultations') ? 'consultations'
      : path.includes('/tags') ? 'tags'
      : path.includes('/classes') ? 'classes'
      : 'info';

    // [SSOT] ROUTES 상수 사용 (legacy student 파라미터는 studentId로 변환)
    safeNavigate(ROUTES.STUDENT_DETAIL(id, tab), { replace: true });
  }, [id, location.pathname, navigate, safeNavigate]);

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader title="학생 상세" />
        <Card padding="lg" variant="default">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
            학생 상세 화면으로 이동 중...
          </div>
        </Card>
      </Container>
    </ErrorBoundary>
  );
}


