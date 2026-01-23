/**
 * Auth Failures Card
 *
 * [불변 규칙] 인증 실패 모니터링 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { AuthFailure } from '../../hooks/usePerformanceMetrics';

interface AuthFailuresCardProps {
  failures: AuthFailure[] | undefined;
  isLoading: boolean;
}

type SeverityLevel = 'normal' | 'warning' | 'critical';

interface IpStats {
  ip: string;
  count: number;
  lastAttempt: string;
  emails: string[];
}

function getSeverity(failureCount: number, suspiciousIpCount: number): SeverityLevel {
  if (suspiciousIpCount > 0) return 'critical';
  if (failureCount > 10) return 'warning';
  return 'normal';
}

function getSeverityStyle(level: SeverityLevel) {
  const styles: Record<SeverityLevel, { color: string; bgColor: string; label: string; icon: string }> = {
    normal: {
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      label: '정상',
      icon: '●',
    },
    warning: {
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      label: '주의',
      icon: '▲',
    },
    critical: {
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      label: '경고',
      icon: '■',
    },
  };
  return styles[level];
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return date.toLocaleDateString('ko-KR');
}

function analyzeFailures(failures: AuthFailure[]): {
  byIp: IpStats[];
  recentCount: number;
  suspiciousIps: string[];
} {
  const ipMap = new Map<string, IpStats>();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let recentCount = 0;

  failures.forEach(f => {
    const failureTime = new Date(f.created_at);
    if (failureTime > oneHourAgo) {
      recentCount++;
    }

    const existing = ipMap.get(f.ip_address);
    if (existing) {
      existing.count++;
      if (new Date(f.created_at) > new Date(existing.lastAttempt)) {
        existing.lastAttempt = f.created_at;
      }
      if (f.email && !existing.emails.includes(f.email)) {
        existing.emails.push(f.email);
      }
    } else {
      ipMap.set(f.ip_address, {
        ip: f.ip_address,
        count: 1,
        lastAttempt: f.created_at,
        emails: f.email ? [f.email] : [],
      });
    }
  });

  const byIp = Array.from(ipMap.values()).sort((a, b) => b.count - a.count);

  // 최근 1시간 내 5회 이상 실패한 IP를 의심스러운 IP로 간주
  const suspiciousIps = byIp
    .filter(ip => {
      const recentFailuresFromIp = failures.filter(
        f => f.ip_address === ip.ip && new Date(f.created_at) > oneHourAgo
      ).length;
      return recentFailuresFromIp >= 5;
    })
    .map(ip => ip.ip);

  return { byIp, recentCount, suspiciousIps };
}

export function AuthFailuresCard({ failures, isLoading }: AuthFailuresCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasFailures = failures && failures.length > 0;
  const analysis = hasFailures ? analyzeFailures(failures) : { byIp: [], recentCount: 0, suspiciousIps: [] };
  const severity = getSeverity(analysis.recentCount, analysis.suspiciousIps.length);
  const style = getSeverityStyle(severity);

  return (
    <Card padding="md" variant="default">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--spacing-xs)',
              color: 'var(--color-text)',
            }}
          >
            인증 실패 로그
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            최근 24시간 ({hasFailures ? failures.length : 0}건)
          </p>
        </div>
        {/* 상태 배지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: style.bgColor,
            border: `var(--border-width-thin) solid ${style.color}`,
          }}
        >
          <span style={{ color: style.color, fontSize: 'var(--font-size-xs)' }}>{style.icon}</span>
          <span
            style={{
              color: style.color,
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {style.label}
          </span>
        </div>
      </div>

      {!hasFailures ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-success-bg-subtle)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            인증 실패 없음
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            최근 24시간 동안 인증 실패가 없습니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* 의심스러운 IP 경고 */}
          {analysis.suspiciousIps.length > 0 && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-error-bg)',
                borderRadius: 'var(--border-radius-md)',
                border: 'var(--border-width-thin) solid var(--color-error)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-error)' }}>■</span>
                <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                  의심스러운 활동 감지
                </span>
              </div>
              <p
                style={{
                  marginTop: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text)',
                }}
              >
                {analysis.suspiciousIps.length}개 IP에서 반복적인 인증 실패가 감지되었습니다:
              </p>
              <ul
                style={{
                  marginTop: 'var(--spacing-xs)',
                  paddingLeft: 'var(--spacing-lg)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {analysis.suspiciousIps.slice(0, 5).map(ip => (
                  <li key={ip} style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-xs)' }}>
                    {ip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* IP별 통계 */}
          <div>
            <h4
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-sm)',
                color: 'var(--color-text)',
              }}
            >
              IP별 실패 횟수 (상위 10개)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {analysis.byIp.slice(0, 10).map(ipStat => (
                <div
                  key={ipStat.ip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--spacing-sm)',
                    backgroundColor:
                      analysis.suspiciousIps.includes(ipStat.ip)
                        ? 'var(--color-error-bg)'
                        : 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: analysis.suspiciousIps.includes(ipStat.ip)
                      ? 'var(--border-width-thin) solid var(--color-error)'
                      : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-family-mono)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {ipStat.ip}
                    </span>
                    {ipStat.emails.length > 0 && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        ({ipStat.emails.slice(0, 2).join(', ')}
                        {ipStat.emails.length > 2 && ` 외 ${ipStat.emails.length - 2}개`})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {formatTimeAgo(ipStat.lastAttempt)}
                    </span>
                    <span
                      style={{
                        fontWeight: 'var(--font-weight-bold)',
                        color: ipStat.count >= 5 ? 'var(--color-error)' : 'var(--color-text)',
                      }}
                    >
                      {ipStat.count}회
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 최근 실패 내역 */}
          <div>
            <h4
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-sm)',
                color: 'var(--color-text)',
              }}
            >
              최근 실패 내역
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {failures.slice(0, 10).map(failure => (
                <div
                  key={failure.id}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {formatTimeAgo(failure.created_at)}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: 'var(--spacing-xxs) var(--spacing-xs)',
                        backgroundColor: 'var(--color-warning-bg)',
                        color: 'var(--color-warning)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}
                    >
                      {failure.error_code}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
                    {failure.email || '(이메일 없음)'} - {failure.error_message}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-family-mono)',
                    }}
                  >
                    {failure.ip_address}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
