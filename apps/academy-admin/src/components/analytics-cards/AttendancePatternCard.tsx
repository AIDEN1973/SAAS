/**
 * 출석 패턴 분석 카드 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] UI Core Component 사용, SSOT 원칙 준수
 * [요구사항] 통계문서 FR-07: 시간대·요일별 출석 패턴 분석
 *
 * Purpose: 출석 피크 시간대, 지각/결석 패턴, 요일별 출석률 시각화
 */

import React, { useState } from 'react';
import { Card, Button, EmptyState } from '@ui-core/react';
import { Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export interface HourlyAttendanceData {
  hour: number;
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
}

export interface DailyAttendanceData {
  day: string;
  dayLabel: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
}

export interface AttendancePatternCardProps {
  /** 시간대별 데이터 */
  hourlyData: HourlyAttendanceData[];
  /** 요일별 데이터 */
  dailyData: DailyAttendanceData[];
  /** 로딩 상태 */
  isLoading?: boolean;
}

type ViewMode = 'hourly' | 'daily';

export function AttendancePatternCard({ hourlyData, dailyData, isLoading }: AttendancePatternCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('hourly');

  if (isLoading) {
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>출석 패턴 분석</h2>
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  // 피크 시간대 계산
  const peakHour = hourlyData.length > 0
    ? hourlyData.reduce((prev, current) => (prev.total > current.total ? prev : current))
    : null;

  // 최고/최저 출석률 요일 계산
  const bestDay = dailyData.length > 0
    ? dailyData.reduce((prev, current) => (prev.rate > current.rate ? prev : current))
    : null;
  const worstDay = dailyData.length > 0
    ? dailyData.reduce((prev, current) => (prev.rate < current.rate ? prev : current))
    : null;

  return (
    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h2>출석 패턴 분석</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Button
            variant={viewMode === 'hourly' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setViewMode('hourly')}
          >
            시간대별
          </Button>
          <Button
            variant={viewMode === 'daily' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setViewMode('daily')}
          >
            요일별
          </Button>
        </div>
      </div>

      {/* 인사이트 요약 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-subtle)',
        borderRadius: 'var(--border-radius-base)',
      }}>
        {viewMode === 'hourly' && peakHour && (
          <>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                피크 시간대
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                {peakHour.hour}시 ({peakHour.total}명)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                평균 출석률
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                {hourlyData.length > 0
                  ? (hourlyData.reduce((sum, d) => sum + d.rate, 0) / hourlyData.length).toFixed(1)
                  : '0.0'
                }%
              </div>
            </div>
          </>
        )}
        {viewMode === 'daily' && bestDay && worstDay && (
          <>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                최고 출석률
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                {bestDay.dayLabel} ({bestDay.rate.toFixed(1)}%)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                최저 출석률
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                {worstDay.dayLabel} ({worstDay.rate.toFixed(1)}%)
              </div>
            </div>
          </>
        )}
      </div>

      {/* 차트 */}
      {viewMode === 'hourly' ? (
        <div>
          <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--spacing-md)' }}>
            시간대별 출석 현황
          </h3>
          {hourlyData.length === 0 ? (
            <EmptyState
              icon={Clock}
              message="데이터가 없습니다."
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" label={{ value: '시간', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: '인원', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" stackId="a" fill="#5cb85c" name="출석" />
                <Bar dataKey="late" stackId="a" fill="#f0ad4e" name="지각" />
                <Bar dataKey="absent" stackId="a" fill="#d9534f" name="결석" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <div>
          <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--spacing-md)' }}>
            요일별 출석률 추이
          </h3>
          {dailyData.length === 0 ? (
            <EmptyState
              icon={Clock}
              message="데이터가 없습니다."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayLabel" />
                  <YAxis domain={[0, 100]} label={{ value: '출석률 (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="rate" stroke="#428bca" strokeWidth={2} name="출석률" />
                </LineChart>
              </ResponsiveContainer>

              {/* 상세 테이블 */}
              <div style={{ marginTop: 'var(--spacing-lg)', overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border-base)' }}>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>요일</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>출석</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>지각</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>결석</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>출석률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day) => (
                      <tr key={day.day} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--spacing-sm)' }}>{day.dayLabel}</td>
                        <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', color: 'var(--color-success)' }}>
                          {day.present}
                        </td>
                        <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', color: 'var(--color-warning)' }}>
                          {day.late}
                        </td>
                        <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', color: 'var(--color-error)' }}>
                          {day.absent}
                        </td>
                        <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                          {day.rate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
