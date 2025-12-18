/**
 * 학생 상세 페이지
 *
 * 현재 구현은 `StudentsPage`의 레이어 메뉴(`/students/list?student=...`)로 통합되었습니다.
 * 기존 상세 라우트는 정합성을 위해 리다이렉트만 수행합니다.
 */

import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary, Container, Card, PageHeader } from '@ui-core/react';

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

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

    navigate(`/students/list?student=${id}&tab=${tab}`, { replace: true });
  }, [id, location.pathname, navigate]);

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


