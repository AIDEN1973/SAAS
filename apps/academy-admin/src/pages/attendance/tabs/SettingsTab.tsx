/**
 * 출결 설정 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { Card, Badge } from '@ui-core/react';
import { Clock, Bell, CheckCircle } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';

interface SettingsTabProps {
  config: {
    attendance?: {
      late_after?: number;
      absent_after?: number;
    };
    notification?: {
      auto_notification?: {
        check_in?: boolean;
        check_out?: boolean;
        absent?: boolean;
      };
      default_channel?: string;
    };
  } | undefined;
}

export function SettingsTab({ config }: SettingsTabProps) {
  const terms = useIndustryTerms();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* 지각/결석 기준 설정 */}
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <Clock size={20} />
          지각/결석 기준 설정
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)' }}>지각 기준</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                수업 시작 후 해당 시간이 지나면 지각으로 처리됩니다.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                {config?.attendance?.late_after || 10}분
              </span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)' }}>결석 기준</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                수업 시작 후 해당 시간이 지나면 결석으로 처리됩니다.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                {config?.attendance?.absent_after || 30}분
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 자동 알림 설정 */}
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <Bell size={20} />
          자동 알림 설정
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)' }}>등원 알림</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {terms.PERSON_LABEL_PRIMARY} 등원 시 보호자에게 자동으로 알림을 발송합니다.
              </div>
            </div>
            <Badge variant="soft" color={(config?.notification?.auto_notification?.check_in) ? 'success' : 'gray'}>
              {(config?.notification?.auto_notification?.check_in) ? '활성' : '비활성'}
            </Badge>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)' }}>하원 알림</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {terms.PERSON_LABEL_PRIMARY} 하원 시 보호자에게 자동으로 알림을 발송합니다.
              </div>
            </div>
            <Badge variant="soft" color={(config?.notification?.auto_notification?.check_out) ? 'success' : 'gray'}>
              {(config?.notification?.auto_notification?.check_out) ? '활성' : '비활성'}
            </Badge>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-medium)' }}>결석 알림</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                결석 처리 시 보호자에게 자동으로 알림을 발송합니다.
              </div>
            </div>
            <Badge variant="soft" color={(config?.notification?.auto_notification?.absent) ? 'success' : 'gray'}>
              {(config?.notification?.auto_notification?.absent) ? '활성' : '비활성'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* 알림 채널 설정 */}
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <CheckCircle size={20} />
          알림 채널 설정
        </h3>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
        }}>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-medium)' }}>기본 알림 채널</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              출결 알림을 발송할 기본 채널을 설정합니다.
            </div>
          </div>
          <Badge variant="solid" color="primary">
            {config?.notification?.default_channel === 'kakao_at' ? '카카오 알림톡' :
             config?.notification?.default_channel === 'sms' ? 'SMS' : 'SMS'}
          </Badge>
        </div>
      </Card>
    </div>
  );
}
