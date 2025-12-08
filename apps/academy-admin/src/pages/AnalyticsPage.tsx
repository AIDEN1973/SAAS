/**
 * 지역 기반 통계 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 지역순위, 지역 평균 대비 비교, 히트맵, AI 인사이트, 월간 리포트
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary, useModal } from '@ui-core/react';
import { Container, Card, Button, Badge } from '@ui-core/react';
import { apiClient, getApiContext } from '@api-sdk/core';

export function AnalyticsPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const [selectedMetric, setSelectedMetric] = useState<'students' | 'revenue' | 'attendance' | 'growth'>('students');

  // 지역 통계 조회 (플레이스홀더)
  const { data: regionalStats, isLoading } = useQuery({
    queryKey: ['regional-analytics', tenantId, selectedMetric],
    queryFn: async () => {
      // TODO: 실제 지역 통계 API 엔드포인트 구현 필요
      // 현재는 플레이스홀더 데이터 반환
      return {
        region: '강남구',
        rank: 12,
        percentile: 88,
        value: 150,
        average: 120,
        trend: '+4%',
        insights: [
          '학생 수는 지역 평균보다 상위 12%입니다.',
          '신규 등록률은 하위 30%로 홍보 강화가 필요합니다.',
        ],
      };
    },
    enabled: !!tenantId,
  });

  const metricLabels = {
    students: '학생 수',
    revenue: '매출',
    attendance: '출석률',
    growth: '성장률',
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            지역 기반 통계
          </h1>

          {/* 지표 선택 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              {(Object.keys(metricLabels) as Array<keyof typeof metricLabels>).map((metric) => (
                <Button
                  key={metric}
                  variant={selectedMetric === metric ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric(metric)}
                >
                  {metricLabels[metric]}
                </Button>
              ))}
            </div>
          </Card>

          {/* 지역 순위 카드 */}
          {isLoading ? (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                로딩 중...
              </div>
            </Card>
          ) : regionalStats ? (
            <>
              <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 순위</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
                      {regionalStats.rank}위
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {regionalStats.region}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        상위 {regionalStats.percentile}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        우리 학원
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {regionalStats.value}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        지역 평균
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {regionalStats.average}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        변화율
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                        {regionalStats.trend}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 히트맵 - [요구사항 3.6.3] 히트맵 기능 */}
              <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 히트맵</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {/* 히트맵 타입 선택 */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                    <Button variant="outline" size="sm">지역 성장률</Button>
                    <Button variant="outline" size="sm">지역 출석률</Button>
                    <Button variant="outline" size="sm">학생 분포</Button>
                  </div>

                  {/* 히트맵 시각화 영역 */}
                  <div style={{
                    padding: 'var(--spacing-xl)',
                    backgroundColor: 'var(--color-background-secondary)',
                    borderRadius: 'var(--radius-md)',
                    minHeight: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                      지역별 데이터 히트맵
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                      {/* TODO: 실제 히트맵 차트 라이브러리 연동 필요 (예: react-heatmap-grid, recharts 등) */}
                      <p>히트맵 시각화는 차트 라이브러리 연동 후 구현됩니다.</p>
                    </div>
                    {/* 임시 히트맵 그리드 (시각적 표현) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 'var(--spacing-xs)',
                      width: '100%',
                      maxWidth: '600px',
                    }}>
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            aspectRatio: '1',
                            backgroundColor: `rgba(59, 130, 246, ${0.2 + (i % 5) * 0.15})`,
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* AI 인사이트 */}
              <Card padding="lg" variant="default">
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>AI 인사이트</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {regionalStats.insights.map((insight, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 'var(--spacing-md)',
                        backgroundColor: 'var(--color-background-secondary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      {insight}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                데이터를 불러올 수 없습니다.
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

