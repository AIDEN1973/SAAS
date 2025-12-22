/**
 * 전체 StudentTaskCard 목록 페이지
 *
 * 아키텍처 문서 3.7.1 섹션 참조: student_task_card_display_rule
 * 홈 화면에서 3개를 초과하는 StudentTaskCard들을 모두 표시하는 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, useModal, PageHeader } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { StudentTaskCard } from '../components/StudentTaskCard';
import { useStudentTaskCards, useStudentTaskCardAction } from '@hooks/use-student';

export function StudentTasksPage() {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { data: cardsData, isLoading, error } = useStudentTaskCards();
  const cards = cardsData || [];
  const getCardActionUrl = useStudentTaskCardAction();

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="전체 학생 업무"
          actions={
            <Button variant="outline" onClick={() => navigate('/students/home')}>
              학생 관리 홈으로
            </Button>
          }
        />

        {isLoading && (
          <Card padding="lg" variant="default">
            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
              업무 카드를 불러오는 중...
            </div>
          </Card>
        )}

        {error && (
          <Card padding="md" variant="outlined">
            <div style={{ color: 'var(--color-error)' }}>
              오류: {error instanceof Error ? error.message : '업무 카드를 불러오는데 실패했습니다.'}
            </div>
          </Card>
        )}

        {cards && cards.length > 0 && (
          <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
            {cards.map((card) => (
              <StudentTaskCard
                key={card.id}
                card={card}
                onAction={(card) => {
                  // 정본 규칙: 컴포넌트 레벨에서 navigate 호출 (Hook 내부 호출 금지)
                  const actionUrl = getCardActionUrl(card);
                  if (actionUrl) {
                    navigate(actionUrl);
                  }
                }}
              />
            ))}
          </Grid>
        )}

        {cards && cards.length === 0 && !isLoading && (
          <Card padding="lg" variant="default">
            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
              <p style={{ marginBottom: 'var(--spacing-md)' }}>
                현재 발생한 학생 업무가 없습니다.
              </p>
            </div>
          </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}

