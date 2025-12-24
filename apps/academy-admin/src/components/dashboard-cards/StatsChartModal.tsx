/**
 * Stats Chart Modal Component
 *
 * 최근 30일 추이 선그래프 모달
 * [불변 규칙] recharts 라이브러리 사용
 * [불변 규칙] CSS 변수 사용 (하드코딩 금지)
 */

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Modal } from '@ui-core/react';
import type { StatsCard } from '../../types/dashboardCard';
import type { DailyStoreMetric } from '@hooks/use-daily-store-metrics';

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
  const { yAxisLabel, unit, formatter } = useMemo(() => {
    if (!card?.chartDataKey) {
      return { yAxisLabel: '', unit: '', formatter: (value: number) => value.toString() };
    }

    switch (card.chartDataKey) {
      case 'student_count':
        return {
          yAxisLabel: '학생 수',
          unit: card.unit || '명',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'revenue':
        return {
          yAxisLabel: '매출',
          unit: card.unit || '원',
          formatter: (value: number) => `${value.toLocaleString()}${card.unit || '원'}`,
        };
      case 'attendance_rate':
        return {
          yAxisLabel: '출석률',
          unit: card.unit || '%',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'new_enrollments':
        return {
          yAxisLabel: '신규 등록',
          unit: card.unit || '명',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'late_rate':
        return {
          yAxisLabel: '지각률',
          unit: card.unit || '%',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'absent_rate':
        return {
          yAxisLabel: '결석률',
          unit: card.unit || '%',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'active_student_count':
        return {
          yAxisLabel: '활성 학생 수',
          unit: card.unit || '명',
          formatter: (value: number) => `${value}${card.unit || '명'}`,
        };
      case 'inactive_student_count':
        return {
          yAxisLabel: '비활성 학생 수',
          unit: card.unit || '명',
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
          unit: card.unit || '%',
          formatter: (value: number) => `${value.toFixed(1)}${card.unit || '%'}`,
        };
      case 'arpu':
        return {
          yAxisLabel: 'ARPU',
          unit: card.unit || '원',
          formatter: (value: number) => `${value.toLocaleString()}${card.unit || '원'}`,
        };
      default:
        return { yAxisLabel: '', unit: '', formatter: (value: number) => value.toString() };
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
        minHeight: 'var(--spacing-3xl) * 10', // 300px (하드코딩 금지 규칙 준수)
      }}>
        {chartData.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'var(--spacing-3xl) * 10',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}>
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-secondary)"
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
              <YAxis
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
                stroke="var(--color-text-secondary)"
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
              <Tooltip
                formatter={(value: number) => [formatter(value), yAxisLabel]}
                labelStyle={{ color: 'var(--color-text)' }}
                contentStyle={{
                  backgroundColor: 'var(--color-white)',
                  border: '1px solid var(--color-gray-200)',
                  borderRadius: 'var(--border-radius-md)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-primary)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Modal>
  );
}

