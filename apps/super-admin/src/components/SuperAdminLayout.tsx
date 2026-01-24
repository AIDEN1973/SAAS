/**
 * SuperAdminLayout Component
 *
 * Super Admin 앱의 공통 레이아웃 래퍼
 * academy-admin의 3-part 레이아웃 패턴 적용:
 * - SubSidebar (좌측 서브 네비게이션)
 * - RightLayerMenuLayout (우측 레이어 메뉴 지원)
 * - Container (메인 콘텐츠)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용 (CSS 변수)
 * [불변 규칙] Tailwind CSS 사용 금지 - SSOT 준수
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SubSidebar,
  RightLayerMenuLayout,
  Container,
  useResponsiveMode,
  type SubSidebarMenuItem,
  type RelatedMenuSection,
} from '@ui-core/react';
import { SUB_MENU_QUERY_PARAM } from '../constants/sub-sidebar-menus';

// ============================================================================
// Types
// ============================================================================

export interface SuperAdminLayoutProps<T extends string = string> {
  /** 페이지 타이틀 (SubSidebar 제목) */
  title: string;
  /** 서브 메뉴 아이템 목록 */
  subMenuItems: SubSidebarMenuItem<T>[];
  /** 기본 서브 메뉴 ID */
  defaultSubMenuId: T;
  /** 관련 메뉴 섹션 (optional) */
  relatedMenus?: RelatedMenuSection;
  /** 서브 메뉴 변경 핸들러 */
  onSubMenuChange?: (id: T) => void;
  /** 현재 선택된 서브 메뉴 ID (controlled mode) */
  selectedSubMenuId?: T;
  /** 우측 레이어 메뉴 설정 (optional) */
  layerMenu?: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    contentKey?: string | number;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
  };
  /** 메인 콘텐츠 */
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function SuperAdminLayout<T extends string = string>({
  title,
  subMenuItems,
  defaultSubMenuId,
  relatedMenus,
  onSubMenuChange,
  selectedSubMenuId: controlledSelectedId,
  layerMenu,
  children,
}: SuperAdminLayoutProps<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  // SubSidebar 축소 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile || isTablet);

  // 서브 메뉴 상태 (uncontrolled mode)
  const [internalSelectedId, setInternalSelectedId] = useState<T>(() => {
    const tabParam = searchParams.get(SUB_MENU_QUERY_PARAM);
    const validIds = subMenuItems.map((item) => item.id);
    if (tabParam && validIds.includes(tabParam as T)) {
      return tabParam as T;
    }
    return defaultSubMenuId;
  });

  // controlled vs uncontrolled
  const selectedSubMenuId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  // 반응형: 모바일/태블릿에서 사이드바 자동 축소
  useEffect(() => {
    setSidebarCollapsed(isMobile || isTablet);
  }, [isMobile, isTablet]);

  // URL 파라미터 동기화
  useEffect(() => {
    const tabParam = searchParams.get(SUB_MENU_QUERY_PARAM);
    const validIds = subMenuItems.map((item) => item.id);
    if (tabParam && validIds.includes(tabParam as T)) {
      if (controlledSelectedId === undefined) {
        setInternalSelectedId(tabParam as T);
      }
    }
  }, [searchParams, subMenuItems, controlledSelectedId]);

  // 서브 메뉴 선택 핸들러
  const handleSubMenuSelect = useCallback(
    (id: T) => {
      // URL 업데이트
      const newSearchParams = new URLSearchParams(searchParams);
      if (id === defaultSubMenuId) {
        newSearchParams.delete(SUB_MENU_QUERY_PARAM);
      } else {
        newSearchParams.set(SUB_MENU_QUERY_PARAM, id);
      }
      const queryString = newSearchParams.toString();
      navigate(queryString ? `${location.pathname}?${queryString}` : location.pathname, {
        replace: true,
      });

      // 상태 업데이트
      if (controlledSelectedId === undefined) {
        setInternalSelectedId(id);
      }
      onSubMenuChange?.(id);
    },
    [searchParams, defaultSubMenuId, navigate, location.pathname, controlledSelectedId, onSubMenuChange]
  );

  // 레이어 메뉴 래퍼 또는 일반 컨테이너
  const renderContent = () => {
    const mainContent = (
      <Container maxWidth="xl" padding="lg">
        {children}
      </Container>
    );

    if (layerMenu) {
      return (
        <RightLayerMenuLayout
          layerMenu={{
            isOpen: layerMenu.isOpen,
            onClose: layerMenu.onClose,
            title: layerMenu.title,
            contentKey: layerMenu.contentKey,
            headerActions: layerMenu.headerActions,
            children: layerMenu.children,
          }}
        >
          {mainContent}
        </RightLayerMenuLayout>
      );
    }

    return mainContent;
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'var(--height-full)',
        minHeight: 'calc(100vh - 60px)', // Navigation 높이 제외
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* SubSidebar */}
      <SubSidebar
        title={title}
        items={subMenuItems}
        selectedId={selectedSubMenuId}
        onSelect={handleSubMenuSelect}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        relatedMenus={relatedMenus}
        style={{
          backgroundColor: 'var(--color-white)',
        }}
      />

      {/* 메인 콘텐츠 영역 */}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {renderContent()}
      </main>
    </div>
  );
}

// ============================================================================
// PageHeader Component (공통 페이지 헤더)
// ============================================================================

export interface PageHeaderProps {
  /** 페이지 제목 */
  title: string;
  /** 부제목 (optional) */
  subtitle?: string;
  /** 우측 액션 버튼들 (optional) */
  actions?: React.ReactNode;
  /** 날짜 범위 표시 (optional) */
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export function PageHeader({ title, subtitle, actions, dateRange }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-xl)',
        flexWrap: 'wrap',
        gap: 'var(--spacing-md)',
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            marginBottom: subtitle || dateRange ? 'var(--spacing-xs)' : 0,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
        {dateRange && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            {dateRange.start.toLocaleDateString('ko-KR')} ~ {dateRange.end.toLocaleDateString('ko-KR')}
          </p>
        )}
      </div>
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// StatCard Component (통계 카드)
// ============================================================================

export interface StatCardProps {
  /** 제목 */
  title: string;
  /** 값 */
  value: string | number;
  /** 값 접미사 (예: 개, 명, %) */
  suffix?: string;
  /** 값 접두사 (예: ₩) */
  prefix?: string;
  /** 변화율 (양수: 증가, 음수: 감소) */
  change?: number;
  /** 변화 설명 (예: "전월 대비") */
  changeLabel?: string;
  /** 상태 색상 */
  color?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary';
  /** 아이콘 (optional) */
  icon?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  suffix,
  prefix,
  change,
  changeLabel,
  color = 'default',
  icon,
}: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    default: {
      bg: 'var(--color-surface)',
      text: 'var(--color-text)',
      border: 'var(--color-gray-200)',
    },
    success: {
      bg: 'var(--color-success-50)',
      text: 'var(--color-success)',
      border: 'var(--color-success-200)',
    },
    warning: {
      bg: 'var(--color-warning-50)',
      text: 'var(--color-warning)',
      border: 'var(--color-warning-200)',
    },
    error: {
      bg: 'var(--color-error-50)',
      text: 'var(--color-error)',
      border: 'var(--color-error-200)',
    },
    info: {
      bg: 'var(--color-info-50)',
      text: 'var(--color-info)',
      border: 'var(--color-info-200)',
    },
    primary: {
      bg: 'var(--color-primary-50)',
      text: 'var(--color-primary)',
      border: 'var(--color-primary-200)',
    },
    secondary: {
      bg: 'var(--color-secondary-50)',
      text: 'var(--color-secondary)',
      border: 'var(--color-secondary-200)',
    },
  };

  const colorStyle = colorMap[color] || colorMap.default;

  return (
    <div
      style={{
        borderRadius: 'var(--border-radius-md)',
        border: `var(--border-width-thin) solid ${colorStyle.border}`,
        padding: 'var(--spacing-lg)',
        backgroundColor: colorStyle.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          {title}
        </p>
        {icon && (
          <span
            style={{
              color: colorStyle.text,
              opacity: 0.7,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--spacing-xs)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: color === 'default' ? 'var(--color-text)' : colorStyle.text,
            margin: 0,
          }}
        >
          {prefix}
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && (
            <span
              style={{
                fontSize: 'var(--font-size-xl)',
                marginLeft: 'var(--spacing-xxs)',
              }}
            >
              {suffix}
            </span>
          )}
        </p>
      </div>
      {change !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color:
                change > 0
                  ? 'var(--color-success)'
                  : change < 0
                  ? 'var(--color-error)'
                  : 'var(--color-text-secondary)',
            }}
          >
            {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
          </span>
          {changeLabel && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CardGrid Component (카드 그리드 레이아웃)
// ============================================================================

export interface CardGridProps {
  /** 카드들 */
  children: React.ReactNode;
  /** 최소 카드 너비 */
  minCardWidth?: string;
  /** 간격 */
  gap?: string;
}

export function CardGrid({
  children,
  minCardWidth = 'var(--width-metric-card-min)',
  gap = 'var(--spacing-md)',
}: CardGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Section Component (섹션 래퍼)
// ============================================================================

export interface SectionProps {
  /** 섹션 제목 */
  title: string;
  /** 섹션 부제목 (optional) */
  subtitle?: string;
  /** 우측 액션 (optional) */
  actions?: React.ReactNode;
  /** 자식 컴포넌트 */
  children: React.ReactNode;
  /** 마진 바텀 */
  marginBottom?: string;
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  marginBottom = 'var(--spacing-xl)',
}: SectionProps) {
  return (
    <section style={{ marginBottom }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: 0,
                marginTop: 'var(--spacing-xxs)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// EmptyState Component (데이터 없음 상태)
// ============================================================================

export interface EmptyStateProps {
  /** 제목 */
  title: string;
  /** 설명 */
  description?: string;
  /** 아이콘 (optional) */
  icon?: React.ReactNode;
  /** 액션 버튼 (optional) */
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        backgroundColor: 'var(--color-warning-50)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      {icon && (
        <div
          style={{
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-warning)',
          }}
        >
          {icon}
        </div>
      )}
      <p
        style={{
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-warning)',
          marginBottom: description ? 'var(--spacing-sm)' : 0,
          margin: 0,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            marginTop: 'var(--spacing-sm)',
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {action}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LoadingSkeleton Component (로딩 스켈레톤)
// ============================================================================

export interface LoadingSkeletonProps {
  /** 카드 개수 */
  cardCount?: number;
  /** 테이블 포함 여부 */
  showTable?: boolean;
}

export function LoadingSkeleton({ cardCount = 4, showTable = false }: LoadingSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 헤더 스켈레톤 */}
      <div
        style={{
          height: '2rem',
          backgroundColor: 'var(--color-gray-200)',
          borderRadius: 'var(--border-radius-sm)',
          width: '25%',
        }}
      />

      {/* 카드 스켈레톤 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-metric-card-min), 1fr))',
          gap: 'var(--spacing-md)',
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '8rem',
              backgroundColor: 'var(--color-gray-200)',
              borderRadius: 'var(--border-radius-md)',
            }}
          />
        ))}
      </div>

      {/* 테이블 스켈레톤 */}
      {showTable && (
        <div
          style={{
            height: '16rem',
            backgroundColor: 'var(--color-gray-200)',
            borderRadius: 'var(--border-radius-md)',
          }}
        />
      )}
    </div>
  );
}
