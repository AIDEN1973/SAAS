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
import { ErrorBoundary, Container, Card, Button, useModal } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { StudentTaskCard } from '../components/StudentTaskCard';
import { useStudentTaskCards, useCompleteStudentTaskCard } from '@hooks/use-student';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';

export function StudentTasksPage() {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { data: cardsData, isLoading, error } = useStudentTaskCards();
  const cards = cardsData || [];
  const completeTaskCard = useCompleteStudentTaskCard();

  const handleCardAction = async (card: StudentTaskCardType) => {
    try {
      await completeTaskCard.mutateAsync(card.id);
      if (card.action_url) {
        navigate(card.action_url);
      }
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : '업무 카드 처리에 실패했습니다.');
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
              전체 학생 업무
            </h1>
            <Button variant="outline" onClick={() => navigate('/students/home')}>
              학생 관리 홈으로
            </Button>
          </div>

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
                  onAction={handleCardAction}
                />
              ))}
            </Grid>
          )}

          {cards && cards.length === 0 && !isLoading && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
                <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                  현재 처리할 학생 업무가 없습니다.
                </p>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

