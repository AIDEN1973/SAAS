/**
 * 학생 관리 홈 페이지 - 오늘의 학생 업무 카드
 *
 * 아키텍처 문서 3.1.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, useModal, PageHeader } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { StudentTaskCard } from '../components/StudentTaskCard';
import { useStudentTaskCards, useCompleteStudentTaskCard } from '@hooks/use-student';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';

export function StudentsHomePage() {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { data: cardsData, isLoading, error } = useStudentTaskCards();
  const cards = cardsData || [];
  const completeCard = useCompleteStudentTaskCard();

  const handleCardAction = async (card: StudentTaskCardType) => {
    try {
      // 카드 처리 완료 처리 (아키텍처 문서 713줄: 각 카드를 누르면 필요한 화면으로 자동 이동)
      await completeCard.mutateAsync(card.id);
      // 액션 URL로 이동 (아키텍처 문서 751-760줄: task_type에 따른 action_url 자동 생성 규칙)
      navigate(card.action_url);
    } catch (error) {
      // 에러가 있어도 액션 URL로 이동 (사용자 경험 우선)
      // console.error는 개발 환경에서만 사용 (프로덕션에서는 제거)
      navigate(card.action_url);
    }
  };

  const handleViewAllStudents = () => {
    navigate('/students/list');
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="오늘의 학생 업무"
          actions={
            <Button
              variant="outline"
              onClick={handleViewAllStudents}
            >
              전체 학생 보기
            </Button>
          }
        />

        {/* 로딩 상태 */}
        {isLoading && (
          <Card padding="lg" variant="default">
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              padding: 'var(--spacing-xl)'
            }}>
              업무 카드를 불러오는 중...
            </div>
          </Card>
        )}

        {/* 에러 상태 (로딩이 완료된 후에만 표시) */}
        {!isLoading && error && (
          <Card padding="md" variant="outlined">
            <div style={{ color: 'var(--color-error)' }}>
              오류: {error instanceof Error ? error.message : '업무 카드를 불러오는데 실패했습니다.'}
            </div>
          </Card>
        )}

        {/* 업무 카드 목록 (로딩 완료 후, 에러 없을 때만 표시) */}
        {!isLoading && !error && cards && cards.length > 0 && (
          <>
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
              {/* 최대 3개만 표시 (아키텍처 문서 3.1.1 섹션, 4652줄 참조: student_task_card_display_rule.max_display: 3) */}
              {/* 카드는 이미 priority 기준 내림차순으로 정렬되어 있음 (useStudentTaskCards에서 orderBy 적용) */}
              {cards.slice(0, 3).map((card) => (
                <StudentTaskCard
                  key={card.id}
                  card={card}
                  onAction={handleCardAction}
                />
              ))}
            </Grid>
            {/* 3개 초과 시 "더 보기" 버튼 표시 (아키텍처 문서 4655줄 참조: overflow_url: '/students/tasks') */}
            {cards.length > 3 && (
              <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => navigate('/students/tasks')}
                >
                  더 {cards.length - 3}개 보기
                </Button>
              </div>
            )}
          </>
        )}

        {/* 업무 카드가 없는 경우 (로딩 완료 후, 에러 없을 때만 표시) */}
        {!isLoading && !error && cards && cards.length === 0 && (
          <Card padding="lg" variant="default">
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              padding: 'var(--spacing-xl)'
            }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                  오늘 처리할 학생 업무가 없습니다.
                </p>
                <Button
                  variant="outline"
                  onClick={handleViewAllStudents}
                >
                  전체 학생 목록 보기
                </Button>
              </div>
            </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}

