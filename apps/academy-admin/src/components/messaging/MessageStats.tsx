/**
 * MessageStats - 태그 필터 발송 통계 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 *
 * 핵심 기능:
 * - 총 발송 건수, 성공률, 태그별 발송 내역 표시
 * - Execution Audit 기반 통계 집계
 * - 최근 7일 발송 추이 차트
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Spinner, Badge } from '@ui-core/react';
import { apiClient, getApiContext } from '@api-sdk/core';
import { BarChart3, Send, CheckCircle, XCircle, Clock } from 'lucide-react';

interface MessageStatsData {
  total_sent: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  recent_by_tag: Array<{
    filter_tag_id: string;
    filter_tag_name: string;
    count: number;
  }>;
  daily_stats: Array<{
    date: string;
    count: number;
    success: number;
    failed: number;
  }>;
}

interface MessageStatsProps {
  className?: string;
}

/**
 * 발송 통계 데이터 조회 Hook
 */
function useMessageStats() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<MessageStatsData>({
    queryKey: ['message-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return {
          total_sent: 0,
          success_count: 0,
          failed_count: 0,
          pending_count: 0,
          recent_by_tag: [],
          daily_stats: [],
        };
      }

      try {
        // message_outbox에서 통계 집계
        const response = await apiClient.get<{
          status: string;
          metadata: { filter_tag_id?: string };
        }>('message_outbox', {
          filters: {},
          orderBy: { column: 'created_at', ascending: false },
          limit: 1000,
        });

        if (response.error) {
          console.warn('[MessageStats] Failed to fetch message_outbox:', response.error.message);
          return {
            total_sent: 0,
            success_count: 0,
            failed_count: 0,
            pending_count: 0,
            recent_by_tag: [],
            daily_stats: [],
          };
        }

        const messages = (response.data || []) as Array<{
          id: string;
          status: string;
          metadata: { filter_tag_id?: string; filter_tag_name?: string };
          created_at: string;
        }>;

        // 상태별 카운트
        const total_sent = messages.length;
        const success_count = messages.filter(m => m.status === 'sent' || m.status === 'delivered').length;
        const failed_count = messages.filter(m => m.status === 'failed').length;
        const pending_count = messages.filter(m => m.status === 'pending').length;

        // 태그별 발송 내역 집계
        const tagCounts = new Map<string, { id: string; name: string; count: number }>();
        messages.forEach(m => {
          const tagId = m.metadata?.filter_tag_id;
          if (tagId) {
            const existing = tagCounts.get(tagId);
            if (existing) {
              existing.count++;
            } else {
              tagCounts.set(tagId, {
                id: tagId,
                name: m.metadata?.filter_tag_name || tagId.slice(0, 8),
                count: 1,
              });
            }
          }
        });

        const recent_by_tag = Array.from(tagCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(t => ({
            filter_tag_id: t.id,
            filter_tag_name: t.name,
            count: t.count,
          }));

        // 일별 통계 (최근 7일)
        const dailyMap = new Map<string, { count: number; success: number; failed: number }>();
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, { count: 0, success: 0, failed: 0 });
        }

        messages.forEach(m => {
          const dateStr = m.created_at.split('T')[0];
          const stat = dailyMap.get(dateStr);
          if (stat) {
            stat.count++;
            if (m.status === 'sent' || m.status === 'delivered') {
              stat.success++;
            } else if (m.status === 'failed') {
              stat.failed++;
            }
          }
        });

        const daily_stats = Array.from(dailyMap.entries()).map(([date, stat]) => ({
          date,
          ...stat,
        }));

        return {
          total_sent,
          success_count,
          failed_count,
          pending_count,
          recent_by_tag,
          daily_stats,
        };
      } catch (error) {
        console.warn('[MessageStats] Error:', error);
        return {
          total_sent: 0,
          success_count: 0,
          failed_count: 0,
          pending_count: 0,
          recent_by_tag: [],
          daily_stats: [],
        };
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

export function MessageStats({ className }: MessageStatsProps) {
  const { data: stats, isLoading } = useMessageStats();

  const successRate = useMemo(() => {
    if (!stats || stats.total_sent === 0) return 0;
    return Math.round((stats.success_count / stats.total_sent) * 100);
  }, [stats]);

  // 일별 차트 최대값
  const maxDailyCount = useMemo(() => {
    if (!stats?.daily_stats) return 1;
    return Math.max(...stats.daily_stats.map(d => d.count), 1);
  }, [stats]);

  if (isLoading) {
    return (
      <Card padding="lg" className={className}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-lg)' }}>
          <Spinner size="md" />
        </div>
      </Card>
    );
  }

  if (!stats || stats.total_sent === 0) {
    return (
      <Card padding="lg" className={className}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
          <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
            발송 통계
          </h3>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          아직 발송 내역이 없습니다
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className={className}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
        <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
          발송 통계
        </h3>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        {/* 총 발송 */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
            textAlign: 'center',
          }}
        >
          <Send size={20} style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-xs)' }} />
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {stats.total_sent.toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>총 발송</div>
        </div>

        {/* 성공 */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-success-50)',
            borderRadius: 'var(--border-radius-md)',
            textAlign: 'center',
          }}
        >
          <CheckCircle size={20} style={{ color: 'var(--color-success)', marginBottom: 'var(--spacing-xs)' }} />
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
            {stats.success_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            성공 ({successRate}%)
          </div>
        </div>

        {/* 실패 */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: stats.failed_count > 0 ? 'var(--color-danger-50)' : 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
            textAlign: 'center',
          }}
        >
          <XCircle size={20} style={{ color: stats.failed_count > 0 ? 'var(--color-danger)' : 'var(--color-gray-400)', marginBottom: 'var(--spacing-xs)' }} />
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: stats.failed_count > 0 ? 'var(--color-danger)' : 'var(--color-gray-500)' }}>
            {stats.failed_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>실패</div>
        </div>

        {/* 대기 */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: stats.pending_count > 0 ? 'var(--color-warning-50)' : 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
            textAlign: 'center',
          }}
        >
          <Clock size={20} style={{ color: stats.pending_count > 0 ? 'var(--color-warning)' : 'var(--color-gray-400)', marginBottom: 'var(--spacing-xs)' }} />
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: stats.pending_count > 0 ? 'var(--color-warning)' : 'var(--color-gray-500)' }}>
            {stats.pending_count.toLocaleString()}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>대기 중</div>
        </div>
      </div>

      {/* 최근 7일 추이 */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
          최근 7일 발송 추이
        </h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-xs)', height: '80px' }}>
          {stats.daily_stats.map((day) => {
            const height = day.count > 0 ? Math.max((day.count / maxDailyCount) * 100, 10) : 5;
            return (
              <div
                key={day.date}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${height}%`,
                    backgroundColor: day.count === 0 ? 'var(--color-gray-200)' : 'var(--color-primary)',
                    borderRadius: 'var(--border-radius-sm) var(--border-radius-sm) 0 0',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  title={`${day.date}: ${day.count}건 (성공 ${day.success}, 실패 ${day.failed})`}
                >
                  {day.failed > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${((day.failed / day.count) * 100)}%`,
                        backgroundColor: 'var(--color-danger)',
                      }}
                    />
                  )}
                </div>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)' }}>
                  {new Date(day.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 태그별 발송 현황 */}
      {stats.recent_by_tag.length > 0 && (
        <div>
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            태그별 발송 현황 (상위 5개)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
            {stats.recent_by_tag.map((tag) => (
              <Badge
                key={tag.filter_tag_id}
                variant="outline"
                size="sm"
              >
                {tag.filter_tag_name}: {tag.count}건
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default MessageStats;
