/**
 * Header Component
 *
 * 상단 헤더 메뉴 (Phase 2: 글로벌 검색 통합)
 * [불변 규칙] 반응형: Mobile에서는 햄버거 메뉴, Desktop에서는 전체 메뉴 표시
 * [불변 규칙] 검색: Ctrl+K / Cmd+K 단축키 지원
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { Button } from './Button';
import { useIconStrokeWidth } from '../hooks/useIconSize';
import { User, Gear, Power, X, MagnifyingGlass } from 'phosphor-react';
import { GlobalSearchDropdown } from './GlobalSearchDropdown';
import type { SearchResult, SearchEntityType } from './GlobalSearchResults';

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface HeaderSearchProps {
  /** 검색어 */
  query: string;
  /** 검색어 변경 핸들러 */
  onQueryChange: (query: string) => void;
  /** 검색 결과 */
  results: SearchResult[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 결과 클릭 핸들러 */
  onResultClick?: (result: SearchResult) => void;
  /** 검색 버튼 placeholder */
  placeholder?: string;
  /** 엔티티 타입별 라벨 (업종별 커스터마이징) */
  entityTypeLabels?: Partial<Record<SearchEntityType, string>>;
  /** 검색 입력창 placeholder */
  inputPlaceholder?: string;
  /** 빈 상태 안내 메시지 */
  emptyStateMessage?: string;
}

export interface HeaderProps {
  title?: string;
  logo?: React.ReactNode;
  onMenuClick?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
  userProfile?: UserProfile;
  onLogout?: () => void;
  onSettings?: () => void;
  /** 제목 클릭 핸들러 (예: 홈으로 이동) */
  onTitleClick?: () => void;
  /** 글로벌 검색 props (전달 시 검색창 활성화) */
  search?: HeaderSearchProps;
}

export const Header: React.FC<HeaderProps> = ({
  title = '디어쌤',
  logo,
  onMenuClick,
  rightContent,
  className,
  userProfile,
  onLogout,
  onSettings,
  onTitleClick,
  search,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 요구사항: 기본 1px (CSS 변수 기반, 하드코딩 금지)
  const strokeWidthBase = useIconStrokeWidth('--stroke-width-icon-thin', 1);

  return (
    <header
      className={clsx(className)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backgroundColor: 'var(--color-white)',
        borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
        // 모바일(xs, sm): 바디 영역과 동일한 좌우 여백 (lg = 24px), 태블릿 이상(md+): 넓은 여백 (xl = 32px)
        padding: isMobile
          ? 'var(--padding-header-vertical) var(--spacing-lg)' // 모바일: 상하 패딩 CSS 변수 사용, 좌우 24px (Container와 동일)
          : 'var(--padding-header-vertical) var(--spacing-xl)', // 태블릿 이상: 상하 패딩 CSS 변수 사용, 좌우 32px
        minHeight: 'var(--height-header)', // styles.css 준수: 헤더 최소 높이 고정 (태블릿/데스크탑 일관성 유지)
        transition: 'var(--transition-all)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              minWidth: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
              minHeight: 'var(--touch-target-min)', // styles.css 준수: 터치 타깃 최소 크기 (접근성)
            }}
          >
            <svg
              style={{
                width: 'var(--size-checkbox)', // styles.css 준수: 체크박스 크기 토큰 사용 (20px)
                height: 'var(--size-checkbox)', // styles.css 준수: 체크박스 크기 토큰 사용 (20px)
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={strokeWidthBase * 1.67} // SVG는 약간 더 두껍게 (시각적 강조)
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        )}
        {logo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            {logo}
          </div>
        )}
        <h1
          onClick={onTitleClick}
          style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-xl)',
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: 'var(--letter-spacing-title)', // styles.css 준수: 타이틀 글자 간격 토큰 사용
            cursor: onTitleClick ? 'pointer' : 'default',
            transition: 'var(--transition-all)',
          }}
          onMouseEnter={(e) => {
            if (onTitleClick) {
              e.currentTarget.style.color = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (onTitleClick) {
              e.currentTarget.style.color = 'var(--color-text)';
            }
          }}
        >
          {title}
        </h1>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* 글로벌 검색 */}
        {search && !isMobile && (
          <GlobalSearchDropdown
            query={search.query}
            onQueryChange={search.onQueryChange}
            results={search.results}
            loading={search.loading}
            error={search.error}
            isOpen={searchOpen}
            onOpen={() => setSearchOpen(true)}
            onClose={() => setSearchOpen(false)}
            onResultClick={search.onResultClick}
            placeholder={search.placeholder}
            entityTypeLabels={search.entityTypeLabels}
            inputPlaceholder={search.inputPlaceholder}
            emptyStateMessage={search.emptyStateMessage}
          />
        )}
        {/* 모바일 검색 버튼 */}
        {search && isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(true)}
            style={{
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              minWidth: 'var(--touch-target-min)',
              minHeight: 'var(--touch-target-min)',
            }}
          >
            <MagnifyingGlass
              weight="regular"
              style={{
                width: 'var(--size-icon-base)',
                height: 'var(--size-icon-base)',
                color: 'var(--color-text-secondary)',
              }}
            />
          </Button>
        )}
        {rightContent}
        {/* 사용자 프로필 아이콘 */}
        {userProfile && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                width: 'var(--size-avatar-md)',
                height: 'var(--size-avatar-md)',
                borderRadius: 'var(--border-radius-full)',
                border: 'var(--border-width-thin) solid var(--color-gray-200)',
                backgroundColor: 'var(--color-gray-100)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                overflow: 'hidden',
                transition: 'var(--transition-all)',
              }}
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  style={{
                    width: 'var(--width-full)',
                    height: 'var(--height-full)',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <User
                  weight="regular"
                  style={{
                    width: 'var(--size-spinner-md)',
                    height: 'var(--size-spinner-md)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
              )}
            </button>

            {/* 사용자 메뉴 레이어 */}
            {userMenuOpen && (
              <>
                {/* 오버레이 */}
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 'var(--z-max)',
                  }}
                  onClick={() => setUserMenuOpen(false)}
                />
                {/* 메뉴 */}
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + var(--spacing-sm))',
                    right: 0,
                    zIndex: 'calc(var(--z-max) + 1)',
                    backgroundColor: 'var(--color-white)',
                    borderRadius: 'var(--border-radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    padding: 'var(--spacing-md)',
                    minWidth: 'var(--width-card-min)',
                  }}
                >
                  {/* 닫기 버튼 */}
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      position: 'absolute',
                      top: 'var(--spacing-sm)',
                      right: 'var(--spacing-sm)',
                      padding: 'var(--spacing-xs)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'var(--transition-all)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X
                      weight="bold"
                      style={{
                        width: 'var(--size-icon-base)',
                        height: 'var(--size-icon-base)',
                        color: 'var(--color-text-secondary)',
                      }}
                    />
                  </button>

                  {/* 사용자 정보 */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingBottom: 'var(--spacing-md)',
                      borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                      marginBottom: 'var(--spacing-sm)',
                    }}
                  >
                    {/* 아바타 */}
                    <div
                      style={{
                        width: 'var(--size-avatar-xl)',
                        height: 'var(--size-avatar-xl)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: 'var(--color-gray-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 'var(--spacing-sm)',
                        overflow: 'hidden',
                      }}
                    >
                      {userProfile.avatarUrl ? (
                        <img
                          src={userProfile.avatarUrl}
                          alt={userProfile.name}
                          style={{
                            width: 'var(--width-full)',
                            height: 'var(--height-full)',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <User
                          weight="regular"
                          style={{
                            width: 'var(--size-avatar-md)',
                            height: 'var(--size-avatar-md)',
                            color: 'var(--color-text-secondary)',
                          }}
                        />
                      )}
                    </div>
                    {/* 이름 */}
                    <div
                      style={{
                        fontWeight: 'var(--font-weight-bold)',
                        fontSize: 'var(--font-size-lg)',
                        color: 'var(--color-text)',
                        marginBottom: 'var(--spacing-xs)',
                      }}
                    >
                      {userProfile.name}
                    </div>
                    {/* 이메일 */}
                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {userProfile.email}
                    </div>
                  </div>

                  {/* 메뉴 버튼들 */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--spacing-sm)',
                      justifyContent: 'center',
                    }}
                  >
                    {/* 설정 버튼 */}
                    {onSettings && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSettings();
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                          padding: 'var(--spacing-md)',
                          borderRadius: 'var(--border-radius-md)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                          minWidth: 'var(--size-avatar-xl)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Gear
                          weight="regular"
                          style={{
                            width: 'var(--size-spinner-md)',
                            height: 'var(--size-spinner-md)',
                            color: 'var(--color-text)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text)',
                          }}
                        >
                          설정
                        </span>
                      </button>
                    )}
                    {/* 로그아웃 버튼 */}
                    {onLogout && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                          padding: 'var(--spacing-md)',
                          borderRadius: 'var(--border-radius-md)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                          minWidth: 'var(--size-avatar-xl)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Power
                          weight="regular"
                          style={{
                            width: 'var(--size-spinner-md)',
                            height: 'var(--size-spinner-md)',
                            color: 'var(--color-text)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text)',
                          }}
                        >
                          로그아웃
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
