/**
 * 권한 관리 설정 섹션
 *
 * [LAYER: UI_SECTION]
 *
 * 기존 SettingsPermissionsPage의 콘텐츠를 섹션 컴포넌트로 래핑
 * 통합 설정 페이지(SettingsPage)에서 사용
 *
 * 직급별 페이지 접근 권한 매트릭스 UI
 */

import React, { useMemo, useState } from 'react';
import { Card, Checkbox, useResponsiveMode } from '@ui-core/react';
import { HelpCircle } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import {
  useRolePermissions,
  useUpdateRolePermission,
  PAGE_PATHS,
  DEFAULT_PERMISSIONS,
  POSITION_LABELS,
  getPageLabel,
} from '@hooks/use-class';
import type { PagePathKey } from '@hooks/use-class';
import type { TeacherPosition } from '@services/class-service';

export function PermissionsSettingsSection() {
  const terms = useIndustryTerms();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  const { data: permissions, isLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();

  // 툴팁 표시 상태 (클릭으로 관리)
  const [tooltipPageKey, setTooltipPageKey] = useState<PagePathKey | null>(null);

  const handleTooltipToggle = (key: PagePathKey) => {
    setTooltipPageKey((prev) => (prev === key ? null : key));
  };

  // 직급 목록 (상수이므로 useMemo 외부에 정의)
  const positions: TeacherPosition[] = useMemo(
    () => ['vice_principal', 'manager', 'teacher', 'assistant', 'other'],
    []
  );

  // 전체 접근 권한이 있는 직급 라벨 (동적 생성)
  const fullAccessPositionLabels = useMemo(() => {
    return positions
      .filter((pos) => DEFAULT_PERMISSIONS[pos].includes('*'))
      .map((pos) => POSITION_LABELS[pos])
      .join(', ');
  }, [positions]);

  // 페이지별 설명
  const PAGE_DESCRIPTIONS: Record<PagePathKey, string> = {
    home: '전체 현황과 주요 지표를 한눈에 확인할 수 있는 대시보드입니다',
    students: `${terms.PERSON_LABEL_PRIMARY || '학생'} 정보 조회, 등록, 수정 등을 관리합니다`,
    attendance: '출결 현황 조회 및 출석 체크 기능을 제공합니다',
    appointments: '예약 일정 관리 및 예약 현황을 확인할 수 있습니다',
    notifications: '문자 메시지 발송 및 발송 내역을 관리합니다',
    analytics: '통계 데이터와 분석 리포트를 확인할 수 있습니다',
    ai: 'AI 기반 인사이트와 추천 기능을 제공합니다',
    classes: `${terms.GROUP_LABEL || '수업'} 일정, 배정, 관리 기능을 제공합니다`,
    teachers: `${terms.PERSON_LABEL_SECONDARY || '강사'} 정보 조회 및 관리 기능을 제공합니다`,
    billing: '수강료 청구, 수납 내역, 미납 관리를 제공합니다',
    automation: '자동화 규칙 설정 및 관리 기능입니다 (관리자 전용)',
    alimtalk: '알림톡 템플릿 관리 및 발송 설정입니다 (관리자 전용)',
    agent: 'AI 에이전트 모드로 업무를 수행할 수 있습니다',
    manual: '시스템 사용 매뉴얼 및 도움말을 제공합니다',
    settings: '권한 설정 및 시스템 설정을 관리합니다 (관리자 전용)',
  };

  // 페이지별 권한 상태 계산
  const getPermissionState = (position: TeacherPosition, pagePath: string): boolean => {
    if (permissions && permissions.length > 0) {
      const permission = permissions.find((p) => p.position === position && p.page_path === pagePath);
      if (permission) return permission.can_access;
    }

    const defaultPaths = DEFAULT_PERMISSIONS[position];
    if (defaultPaths.includes('*')) return true;
    return defaultPaths.some((dp) => pagePath.startsWith(dp));
  };

  // 권한 토글 핸들러
  const handleTogglePermission = (position: TeacherPosition, pagePath: string, currentState: boolean) => {
    updatePermission.mutate({
      position,
      pagePath,
      canAccess: !currentState,
    });
  };

  // 페이지 목록 (관리자 전용 페이지 제외)
  const pageEntries = useMemo(() => {
    const adminOnlyPages: PagePathKey[] = ['settings', 'automation', 'alimtalk'];
    return (Object.keys(PAGE_PATHS) as PagePathKey[])
      .filter((key) => !adminOnlyPages.includes(key))
      .map((key) => ({
        key,
        path: PAGE_PATHS[key].path,
        label: getPageLabel(key, terms),
      }));
  }, [terms]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-2xl)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-base)',
        }}
      >
        권한 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <p
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-lg)',
          lineHeight: 'var(--line-height)',
        }}
      >
        각 직급별로 접근할 수 있는 페이지를 설정합니다. 변경 사항은 즉시 반영됩니다.
      </p>

      {/* 모바일에서는 카드 형태로 표시 */}
      {isMobile ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          {positions.map((position) => {
            const isFullAccess = DEFAULT_PERMISSIONS[position].includes('*');
            return (
              <Card key={position} padding="md">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {POSITION_LABELS[position]}
                  </span>
                  {isFullAccess && (
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-primary)',
                        backgroundColor: 'var(--color-primary-50)',
                        padding: 'var(--spacing-2xs) var(--spacing-xs)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}
                    >
                      전체 접근
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'var(--spacing-xs)',
                  }}
                >
                  {pageEntries.map(({ key, path, label }) => {
                    const canAccess = getPermissionState(position, path);

                    return (
                      <label
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                          cursor: 'pointer',
                          padding: 'var(--spacing-xs)',
                          borderRadius: 'var(--border-radius-sm)',
                        }}
                      >
                        <Checkbox
                          checked={canAccess}
                          onChange={() => handleTogglePermission(position, path, canAccess)}
                          disabled={updatePermission.isPending}
                        />
                        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* 데스크톱에서는 테이블로 표시 */
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            border: 'var(--border-width-thin) solid var(--color-gray-200)',
            borderRadius: 'var(--border-radius-xs)',
            backgroundColor: 'var(--color-white)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              borderSpacing: 0,
              minWidth: '100%',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-gray-50)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text)',
                    borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                  }}
                >
                  페이지
                </th>
                {positions.map((position) => (
                  <th
                    key={position}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-gray-50)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text)',
                      borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                      minWidth: '100px',
                    }}
                  >
                    {POSITION_LABELS[position]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageEntries.map(({ key, path, label }, index) => {
                const isLastRow = index === pageEntries.length - 1;
                return (
                  <tr
                    key={key}
                    style={{
                      backgroundColor: 'var(--color-white)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-white)';
                    }}
                  >
                    <td
                      style={{
                        textAlign: 'center',
                        padding: 'var(--spacing-md)',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--color-text)',
                        fontWeight: 'var(--font-weight-medium)',
                        borderBottom: isLastRow ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        <span>{label}</span>
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTooltipToggle(key);
                          }}
                        >
                          <HelpCircle
                            size={14}
                            style={{
                              color: 'var(--color-text-secondary)',
                              opacity: 0.6,
                            }}
                          />
                          {tooltipPageKey === key && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 'calc(100% + var(--spacing-sm))',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: 'var(--color-white)',
                                color: 'var(--color-text)',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 'var(--font-weight-normal)',
                                whiteSpace: 'nowrap',
                                zIndex: 1000,
                                boxShadow: 'var(--shadow-lg)',
                                border: 'var(--border-width-thin) solid var(--color-gray-300)',
                              }}
                            >
                              {/* 삼각형 테두리 (뒤쪽) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  right: '100%',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: 0,
                                  height: 0,
                                  borderTop: '6px solid transparent',
                                  borderBottom: '6px solid transparent',
                                  borderRight: '6px solid var(--color-gray-300)',
                                }}
                              />
                              {/* 삼각형 내부 (앞쪽) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  right: '100%',
                                  top: '50%',
                                  transform: 'translateY(-50%) translateX(1px)',
                                  width: 0,
                                  height: 0,
                                  borderTop: '6px solid transparent',
                                  borderBottom: '6px solid transparent',
                                  borderRight: '6px solid var(--color-white)',
                                }}
                              />
                              {PAGE_DESCRIPTIONS[key]}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {positions.map((position) => {
                      const canAccess = getPermissionState(position, path);
                      return (
                        <td
                          key={position}
                          style={{
                            textAlign: 'center',
                            padding: 'var(--spacing-md)',
                            borderBottom: isLastRow ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Checkbox
                              checked={canAccess}
                              onChange={() => handleTogglePermission(position, path, canAccess)}
                              disabled={updatePermission.isPending}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 안내 메시지 */}
      <div
        style={{
          marginTop: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-primary-50)',
          borderRadius: 'var(--border-radius-xs)',
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          lineHeight: 'var(--line-height)',
        }}
      >
        <strong>참고:</strong> {fullAccessPositionLabels}은(는) 기본적으로 모든 페이지에 접근할 수 있습니다. 권한 설정, 자동화 설정, 알림톡
        설정은 관리자 전용으로 목록에 표시되지 않습니다.
      </div>
    </div>
  );
}

export default PermissionsSettingsSection;
