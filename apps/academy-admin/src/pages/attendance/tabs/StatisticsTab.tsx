/**
 * 출결 통계 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { Card, NotificationCardLayout, EmptyState } from '@ui-core/react';
import { Users, UserCheck, Clock, UserX, TrendingUp, Smartphone, BarChart3 } from 'lucide-react';
import { CardGridLayout } from '../../../components/CardGridLayout';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { AttendanceLog } from '@services/attendance-service';

interface StatisticsTabProps {
  attendanceLogs: AttendanceLog[];
}

export function StatisticsTab({ attendanceLogs }: StatisticsTabProps) {
  const terms = useIndustryTerms();

  const stats = useMemo(() => {
    const present = attendanceLogs.filter(log => log.status === 'present').length;
    const late = attendanceLogs.filter(log => log.status === 'late').length;
    const absent = attendanceLogs.filter(log => log.status === 'absent').length;
    const manual = attendanceLogs.filter(log => log.check_in_method === 'manual' || !log.check_in_method).length;
    const kiosk = attendanceLogs.filter(log => log.check_in_method === 'kiosk_phone').length;
    const qr = attendanceLogs.filter(log => log.check_in_method === 'qr_scan').length;
    const total = attendanceLogs.length;
    return { present, late, absent, manual, kiosk, qr, total };
  }, [attendanceLogs]);

  const pct = (count: number) => stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* 요약 통계 */}
      <CardGridLayout
        cards={[
          <NotificationCardLayout
            key="total"
            icon={<Users />}
            title="총 출결 기록"
            value={stats.total}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor="var(--color-primary-50)"
          />,
          <NotificationCardLayout
            key="present"
            icon={<UserCheck />}
            title={terms.PRESENT_LABEL}
            value={stats.present}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor="var(--color-success-50)"
          />,
          <NotificationCardLayout
            key="late"
            icon={<Clock />}
            title={terms.LATE_LABEL}
            value={stats.late}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor="var(--color-warning-50)"
          />,
          <NotificationCardLayout
            key="absent"
            icon={<UserX />}
            title={terms.ABSENCE_LABEL}
            value={stats.absent}
            unit="건"
            layoutMode="stats"
            iconBackgroundColor="var(--color-error-50)"
          />,
        ]}
        desktopColumns={4}
        tabletColumns={2}
        mobileColumns={2}
      />

      {/* 출석률 카드 */}
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <TrendingUp size={20} />
          출석률 현황
        </h3>
        {stats.total > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {/* 출석률 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                <span>{terms.PRESENT_LABEL}</span>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{pct(stats.present)}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${pct(stats.present)}%`, height: '100%', backgroundColor: 'var(--color-success)', borderRadius: 'var(--border-radius-full)' }} />
              </div>
            </div>
            {/* 지각률 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                <span>{terms.LATE_LABEL}</span>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{pct(stats.late)}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${pct(stats.late)}%`, height: '100%', backgroundColor: 'var(--color-warning)', borderRadius: 'var(--border-radius-full)' }} />
              </div>
            </div>
            {/* 결석률 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                <span>{terms.ABSENCE_LABEL}</span>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{pct(stats.absent)}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${pct(stats.absent)}%`, height: '100%', backgroundColor: 'var(--color-error)', borderRadius: 'var(--border-radius-full)' }} />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={BarChart3} message="통계 데이터가 없습니다." />
        )}
      </Card>

      {/* 키오스크 사용 통계 */}
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <Smartphone size={20} />
          체크인 방법별 통계
        </h3>
        {stats.total > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-md)' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                {stats.manual}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>수동 입력</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                {stats.kiosk}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success-700)' }}>키오스크</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-info-50)', borderRadius: 'var(--border-radius-md)' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-info)' }}>
                {stats.qr}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-info-700)' }}>QR 스캔</div>
            </div>
          </div>
        ) : (
          <EmptyState icon={Smartphone} message="체크인 데이터가 없습니다." />
        )}
      </Card>
    </div>
  );
}
