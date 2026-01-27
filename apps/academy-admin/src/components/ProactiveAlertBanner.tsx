import React from 'react';
import { Card, Button, Badge } from '@ui-core/react';
import {
  useProactiveAlerts,
  useMarkAlertAsRead,
  useDismissAlert,
  type ProactiveAlert,
} from '@hooks/use-proactive-alerts';
import { AlertCircle, CheckCircle, XCircle, X } from 'lucide-react';

/**
 * 선제적 알림 배너 컴포넌트
 *
 * - AI가 생성한 선제적 알림을 상단에 표시
 * - 심각도별 색상 구분 (info, warning, critical)
 * - 권고 조치 버튼 제공
 * - 읽음/무시 처리 가능
 */
export function ProactiveAlertBanner() {
  const { data: alerts, isLoading } = useProactiveAlerts({ onlyUnread: true });
  const { mutate: markAsRead } = useMarkAlertAsRead();
  const { mutate: dismissAlert } = useDismissAlert();

  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'var(--color-red-50)',
          border: 'var(--color-red-300)',
          icon: 'var(--color-red-600)',
          badgeColor: 'gray' as const, // Badge only supports: 'blue' | 'gray' | 'green' | 'yellow'
        };
      case 'warning':
        return {
          bg: 'var(--color-orange-50)',
          border: 'var(--color-orange-300)',
          icon: 'var(--color-orange-600)',
          badgeColor: 'yellow' as const,
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-blue-50)',
          border: 'var(--color-blue-300)',
          icon: 'var(--color-blue-600)',
          badgeColor: 'blue' as const,
        };
    }
  };

  const getSeverityIcon = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return XCircle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return CheckCircle;
    }
  };

  const getSeverityLabel = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical':
        return '긴급';
      case 'warning':
        return '경고';
      case 'info':
      default:
        return '정보';
    }
  };

  const handleDismiss = (alertId: string) => {
    dismissAlert(alertId);
  };

  const handleMarkAsRead = (alertId: string) => {
    markAsRead(alertId);
  };

  const handleActionClick = (alert: ProactiveAlert, action: ProactiveAlert['recommended_actions'][0]) => {
    // TODO: 권고 조치 실행 로직 구현
    console.log('Action clicked:', action);
    markAsRead(alert.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--spacing-md)',
        right: 'var(--spacing-md)',
        width: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      {alerts.map((alert) => {
        const colors = getSeverityColor(alert.severity);
        const Icon = getSeverityIcon(alert.severity);

        return (
          <Card
            key={alert.id}
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
              borderWidth: 'var(--border-width-thin)',
              borderStyle: 'solid',
              padding: 'var(--spacing-md)',
              position: 'relative',
            }}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => handleDismiss(alert.id)}
              style={{
                position: 'absolute',
                top: 'var(--spacing-xs)',
                right: 'var(--spacing-xs)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                color: 'var(--color-text-secondary)',
              }}
              aria-label="알림 닫기"
            >
              <X size={16} />
            </button>

            {/* 헤더 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              <Icon size={20} style={{ color: colors.icon, flexShrink: 0 }} />
              <h4
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  margin: 0,
                  flex: 1,
                }}
              >
                {alert.title}
              </h4>
              <Badge variant="soft" color={colors.badgeColor}>{getSeverityLabel(alert.severity)}</Badge>
            </div>

            {/* 메시지 */}
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-md)',
                lineHeight: 1.5,
              }}
            >
              {alert.message}
            </p>

            {/* 권고 조치 */}
            {alert.recommended_actions && alert.recommended_actions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  권장 조치:
                </span>
                {alert.recommended_actions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleActionClick(alert, action)}
                    fullWidth
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* 읽음 처리 버튼 */}
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkAsRead(alert.id)}
                fullWidth
              >
                확인했습니다
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
