/**
 * Stats Chart Modal Component
 *
 * 최근 30일 추이 선그래프 모달
 * [불변 규칙] recharts 라이브러리 사용
 * [불변 규칙] CSS 변수 사용 (하드코딩 금지)
 */

import React, { useMemo } from 'react';
import { Modal } from '@ui-core/react';
import type { StatsCard } from '../../types/dashboardCard';
import type { DailyStoreMetric } from '@hooks/use-daily-store-metrics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface StatsChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: StatsCard | null;
  data: DailyStoreMetric[];
}

export function StatsChartModal({ isOpen, onClose, card, data }: StatsChartModalProps) {

  // 카드 ID에 따라 그래프 데이터 변환
  const chartData = useMemo(() => {
    if (!card?.chartDataKey || !data || data.length === 0) return [];

    return data.map((item) => {
      const date = new Date(item.date_kst);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dateLabel = `${month}/${day}`;

      let value: number;
      switch (card.chartDataKey) {
        case 'student_count':
          value = item.student_count;
          break;
        case 'revenue':
          value = Number(item.revenue);
          break;
        case 'attendance_rate':
          value = Number(item.attendance_rate);
          break;
        case 'new_enrollments':
          value = item.new_enrollments;
          break;
        case 'late_rate':
          value = Number(item.late_rate);
          break;
        case 'absent_rate':
          value = Number(item.absent_rate);
          break;
        case 'active_student_count':
          value = item.active_student_count;
          break;
        case 'inactive_student_count':
          value = item.inactive_student_count;
          break;
        case 'avg_students_per_class':
          value = Number(item.avg_students_per_class);
          break;
        case 'avg_capacity_rate':
          value = Number(item.avg_capacity_rate);
          break;
        case 'arpu':
          value = Number(item.arpu);
          break;
        default:
          value = 0;
      }

      return {
        date: dateLabel,
        value,
      };
    });
  }, [card, data]);

  // Y축 레이블 및 단위 설정
  const { yAxisLabel, formatter } = useMemo(() => {
    if (!card?.chartDataKey) {
      return { yAxisLabel: '', formatter: (value: number) => value.toString() };
    }

    switch (card.chartDataKey) {
      case 'student_count':
        return {
          yAxisLabel: '학생 수',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'revenue':
        return {
          yAxisLabel: '매출',
          formatter: (value: number) => {
            // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
            const formatter = new Intl.NumberFormat('ko-KR');
            return `${formatter.format(value)}${card.unit || '원'}`;
          },
        };
      case 'attendance_rate': {
        // [P1-2 수정] 출석률 차트 라벨 강화: 로그 기반 지표임을 명시
        // 주간/월간 출석률 카드의 경우 card.title에 "(등원 로그 기반 지표)"가 포함되어 있음
        const isLogBased = card.title?.includes('로그 기반') || card.title?.includes('등원 로그');
        return {
          yAxisLabel: isLogBased ? '출석률 (등원 로그 기반 지표)' : '출석률',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      }
      case 'new_enrollments':
        return {
          yAxisLabel: '신규 등록',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'late_rate':
        return {
          yAxisLabel: '지각률',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'absent_rate':
        return {
          yAxisLabel: '결석률',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'active_student_count':
        return {
          yAxisLabel: '활성 학생 수',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'inactive_student_count':
        return {
          yAxisLabel: '비활성 학생 수',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'avg_students_per_class':
        return {
          yAxisLabel: '반당 평균 인원',
          unit: card.unit || '명',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '명'}`,
        };
      case 'avg_capacity_rate':
        return {
          yAxisLabel: '평균 정원률',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'arpu':
        return {
          yAxisLabel: 'ARPU',
          formatter: (value: number) => {
            // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
            const formatter = new Intl.NumberFormat('ko-KR');
            return `${formatter.format(value)}${card.unit || '원'}`;
          },
        };
      default:
        return { yAxisLabel: '', formatter: (value: number) => value.toString() };
    }
  }, [card]);

  if (!card) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${card.title} - 최근 30일 추이`}
      size="lg"
    >
      <div style={{
        padding: 'var(--spacing-md)',
        // HARD-CODE-EXCEPTION: minHeight는 calc()로 계산된 값 (레이아웃용 특수 값)
        minHeight: 'calc(var(--spacing-3xl) * 10)',
      }}>
        {chartData.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // HARD-CODE-EXCEPTION: height는 calc()로 계산된 값 (레이아웃용 특수 값)
            height: 'calc(var(--spacing-3xl) * 10)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}>
            데이터가 없습니다.
          </div>
        ) : (
          <>
            {/* HARD-CODE-EXCEPTION: recharts 라이브러리 요구값 (3rd-party 라이브러리 요구값) */}
            {/* height={400}, margin, strokeDasharray 등은 recharts API 요구사항 */}
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                {/* HARD-CODE-EXCEPTION: recharts CartesianGrid strokeDasharray는 숫자만 허용 (3rd-party 라이브러리 요구값) */}
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-secondary)"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                />
                {/* HARD-CODE-EXCEPTION: recharts YAxis label angle은 숫자만 허용 (3rd-party 라이브러리 요구값) */}
                <YAxis
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
                  stroke="var(--color-text-secondary)"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                />
                <Tooltip
                  formatter={(value: string | number) => {
                    const numValue = typeof value === 'string' ? parseFloat(value) : value;
                    return [formatter(numValue), yAxisLabel];
                  }}
                  labelStyle={{ color: 'var(--color-text)' }}
                  contentStyle={{
                    backgroundColor: 'var(--color-white)',
                    // HARD-CODE-EXCEPTION: recharts Tooltip contentStyle은 CSS 변수를 직접 사용할 수 없음 (3rd-party 라이브러리 요구값)
                    // border-width-thin은 1px이지만 recharts는 CSS 변수를 직접 사용할 수 없으므로 하드코딩
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  // HARD-CODE-EXCEPTION: recharts Line strokeWidth는 숫자만 허용 (3rd-party 라이브러리 요구값)
                  strokeWidth={2}
                  // HARD-CODE-EXCEPTION: recharts dot/activeDot r은 숫자만 허용 (3rd-party 라이브러리 요구값)
                  dot={{ fill: 'var(--color-primary)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </Modal>
  );
}

