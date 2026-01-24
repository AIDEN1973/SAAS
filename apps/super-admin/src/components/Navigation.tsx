/**
 * Navigation Component
 *
 * [불변 규칙] Super Admin 네비게이션 바
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@ui-core/react';

interface NavItem {
  path: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/schemas', label: '스키마 에디터' },
  { path: '/performance', label: '성능 모니터링' },
  { path: '/tenants', label: '테넌트 관리' },
  { path: '/business-metrics', label: '비즈니스 메트릭' },
  { path: '/revenue', label: '매출 분석' },
  { path: '/regional', label: '지역별 분석' },
  { path: '/alimtalk', label: '알림톡 설정' },
];

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        backgroundColor: 'var(--color-white)',
        borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
        position: 'sticky',
        top: 'var(--spacing-none)',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* 로고 */}
      <div
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-primary)',
          marginRight: 'var(--spacing-lg)',
        }}
      >
        Super Admin
      </div>

      {/* 네비게이션 링크 */}
      {navItems.map((item) => {
        const isActive = location.pathname === item.path ||
          (item.path === '/schemas' && location.pathname === '/');

        return (
          <Button
            key={item.path}
            variant={isActive ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
