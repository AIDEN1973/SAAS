/**
 * Notification Card Layout Component
 *
 * [불변 규칙] UI Core Component: 시각/레이아웃/인터랙션 프리미티브
 * [불변 규칙] 비즈니스 규칙 없음, API 호출 없음
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 알림 카드 및 통계 카드의 공통 레이아웃 구조를 제공하는 순수 UI 컴포넌트입니다.
 * StudentTaskCard, EmergencyCard, AIBriefingCard, StatsCard 등 모든 카드가 동일한 레이아웃을 사용합니다.
 */

import React, { useState, useRef, useMemo } from 'react';
import { Triangle, MoreVertical, TrendingUp } from 'lucide-react';
import { Card } from './Card';
import { Popover } from './Popover';
import { Button } from './Button';
import { useIconSize, useIconStrokeWidth } from '../hooks/useIconSize';

export interface NotificationCardLayoutProps {
  /** 카드 배경색 (CSS 변수 사용) */
  backgroundColor?: string;
  /** 빈 카드 여부 (스타일 조정용) */
  isEmpty?: boolean;
  /** 카드 클릭 핸들러 */
  onClick?: () => void;
  /** 헤더 영역: 아이콘 등 */
  header?: React.ReactNode;
  /** 제목 (최대 줄 수, 기본값: 2) */
  title: React.ReactNode;
  /** 설명/메시지 (최대 줄 수, 기본값: 3) */
  description?: React.ReactNode;
  /** 메타 정보 (하단, 예: 학생 이름, 생성 시간) */
  meta?: React.ReactNode;
  /** 액션 버튼 영역 (하단 고정) */
  actions?: React.ReactNode;
  /** 추가 컨텐츠 (인사이트 리스트 등) */
  children?: React.ReactNode;
  /** 카드 variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** 왼쪽 테두리 강조 (Emergency 카드용) */
  borderLeftColor?: string;
  /** 제목 최대 줄 수 (기본값: 2) */
  maxTitleLines?: number;
  /** 설명 최대 줄 수 (기본값: 3) */
  maxDescriptionLines?: number;
  /** 우측 상단에 표시할 아이콘 (루시드 아이콘) */
  icon?: React.ReactNode;
  /** 통계형: 메인 값 (큰 숫자) */
  value?: React.ReactNode;
  /** 통계형: 값 옆에 표시할 단위/추가 정보 */
  unit?: React.ReactNode;
  /** 통계형: 트렌드 표시 (예: "+10%", "-5%") */
  trend?: React.ReactNode;
  /** 레이아웃 모드: 'notification' (알림형), 'stats' (통계형), 'auto' (자동 판단) */
  layoutMode?: 'notification' | 'stats' | 'auto';
  /** 우측 상단 메뉴 아이템 (점 3개 버튼으로 표시) */
  menuItems?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger';
  }>;
  /** 그래프 아이콘 클릭 핸들러 (우측 상단에 그래프 아이콘 표시) */
  onChartClick?: () => void;
  /** 아이콘 배지 배경색 (CSS 변수 사용, 기본값: --color-primary-50) */
  iconBackgroundColor?: string;
  /** 타이틀 폰트 굵기 (CSS 변수 사용, 기본값: --font-weight-normal) */
  titleFontWeight?: string;
  /** 선택 상태 여부 (true일 때 시각적 강조) */
  isSelected?: boolean;
}

export function NotificationCardLayout({
  backgroundColor,
  isEmpty = false,
  onClick,
  header,
  title,
  description,
  meta,
  actions,
  children,
  variant = 'default',
  borderLeftColor,
  maxTitleLines = 2,
  maxDescriptionLines = 3,
  icon,
  value,
  unit,
  trend,
  layoutMode = 'auto',
  menuItems,
  onChartClick,
  iconBackgroundColor,
  titleFontWeight = 'var(--font-weight-normal)',
  isSelected = false,
}: NotificationCardLayoutProps) {
  // 레이아웃 모드 자동 판단
  const actualLayoutMode = layoutMode === 'auto'
    ? (value !== undefined ? 'stats' : 'notification')
    : layoutMode;

  // 클릭 핸들러 (통계형일 때도 지원)
  const handleClick = isEmpty ? undefined : onClick;
  const cursorStyle = onClick && !isEmpty ? 'pointer' : 'default';

  // 아이콘 크기 및 strokeWidth 훅 사용 (하드코딩 금지 규칙 준수)
  const menuIconSize = useIconSize('--size-icon-base');
  const menuIconStrokeWidth = useIconStrokeWidth('--stroke-width-icon');
  const cardIconSize = useIconSize('--size-icon-base'); // 기본 아이콘 크기
  const cardIconSizeReduced = useIconSize('--size-icon-md'); // padding 증가에 따라 아이콘 크기 감소
  const cardIconStrokeWidth = useIconStrokeWidth('--stroke-width-icon');
  const trendIconStrokeWidth = useIconStrokeWidth('--stroke-width-icon');

  // Popover offset을 위한 spacing-xs 값 (px 단위)
  const spacingXsPx = useIconSize('--spacing-xs');

  // Popover offset을 CSS 변수에서 읽어오기 (하드코딩 금지 규칙 준수)
  const popoverOffset = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--spacing-xs')
        .trim();
      if (value) {
        // rem 단위를 px로 변환 (root font size 사용, 하드코딩 금지 규칙 준수)
        if (value.endsWith('rem')) {
          const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
          if (rootFontSize) {
            return parseFloat(value) * rootFontSize;
          }
        }
        // px 단위인 경우
        if (value.endsWith('px')) {
          return parseFloat(value);
        }
      }
    }
    // fallback: --spacing-xs 기본값
    return spacingXsPx;
  }, [spacingXsPx]);

  // 메뉴 상태 관리
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  const handleMenuItemClick = (onClick: () => void) => {
    onClick();
    setIsMenuOpen(false);
  };

  return (
    <Card
      padding="md"
      style={{
        backgroundColor: backgroundColor || 'var(--color-white)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: isEmpty ? 'var(--opacity-inactive)' : 'var(--opacity-full)',
        position: 'relative',
        cursor: cursorStyle,
      }}
      onClick={handleClick}
      disableHoverEffect={true}
    >
      {/* 우측 상단 그래프 아이콘 버튼 */}
      {!isEmpty && onChartClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChartClick();
          }}
          style={{
            position: 'absolute',
            top: 'var(--spacing-sm)',
            right: menuItems && menuItems.length > 0 ? 'calc(var(--spacing-sm) + var(--spacing-3xl))' : 'var(--spacing-sm)',
            padding: 'var(--spacing-xs)',
            minWidth: 'auto',
            minHeight: 'auto',
            width: 'auto',
            height: 'auto',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--border-radius-sm)',
            transition: 'background-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="그래프 보기"
        >
          <TrendingUp size={menuIconSize} strokeWidth={menuIconStrokeWidth} />
        </button>
      )}

      {/* 우측 상단 메뉴 버튼 */}
      {!isEmpty && menuItems && menuItems.length > 0 && (
        <>
          <button
            ref={menuButtonRef}
            onClick={handleMenuToggle}
            style={{
              position: 'absolute',
              top: 'var(--spacing-sm)',
              right: 'var(--spacing-sm)',
              padding: 'var(--spacing-xs)',
              minWidth: 'auto',
              minHeight: 'auto',
              width: 'auto',
              height: 'auto',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--border-radius-sm)',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="메뉴"
          >
            <MoreVertical size={menuIconSize} strokeWidth={menuIconStrokeWidth} />
          </button>
          <Popover
            isOpen={isMenuOpen}
            onClose={handleMenuClose}
            anchorEl={menuButtonRef.current}
            placement="bottom-end"
            offset={popoverOffset}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 'calc(var(--spacing-xl) * 4)', // 최소 너비 (하드코딩 금지 규칙 준수)
            }}>
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => !item.disabled && handleMenuItemClick(item.onClick)}
                  disabled={item.disabled}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    fontSize: 'var(--font-size-base)',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    color: item.disabled
                      ? 'var(--color-text-disabled)'
                      : item.variant === 'danger'
                        ? 'var(--color-error)'
                        : 'var(--color-text)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Popover>
        </>
      )}

      {/* 통합 레이아웃: 좌측 아이콘 + 우측 컨텐츠 영역 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-md)',
      }}>
        {/* 좌측: 원형 배경이 있는 아이콘 (header가 있으면 header 사용, 없으면 icon 사용) */}
        {(header || icon) && (
          <div
            style={{
              width: 'calc(var(--spacing-3xl) - var(--spacing-xxs))',
              height: 'calc(var(--spacing-3xl) - var(--spacing-xxs))',
              borderRadius: '50%',
              backgroundColor: isSelected
                ? (iconBackgroundColor || 'var(--color-primary)') // 선택된 카드: 인더스트리 타입 색상
                : 'var(--color-primary-50)', // 비선택 카드: 기본값 (투명도 10%)
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 'calc(var(--spacing-md) + var(--spacing-xxs) + var(--spacing-xxs))', // 원형 배지 내부 여백 (기본 + 3포인트)
            }}
          >
            {header ? (
              <div style={{
                width: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))', // padding 증가에 따라 아이콘 크기 감소
                height: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))', // padding 증가에 따라 아이콘 크기 감소
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSelected ? 'var(--color-white)' : (isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)'), // 선택된 카드만 화이트, 비선택 카드는 기본값
              }}>
                {React.isValidElement(header) && header.type
                  ? (() => {
                      // SVG인 경우 (type이 'svg' 문자열)
                      const isSVG = typeof header.type === 'string' && header.type.toLowerCase() === 'svg';

                      if (isSVG) {
                        // SVG의 경우 자식 요소(path 등)의 strokeWidth도 오버라이드
                        return React.cloneElement(header as React.ReactElement<any>, {
                          style: {
                            ...((header as React.ReactElement<any>).props?.style || {}),
                            width: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))',
                            height: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))',
                          },
                          children: React.Children.map((header as React.ReactElement<any>).props?.children || [], (child) => {
                            if (!React.isValidElement(child)) {
                              return child;
                            }

                            // SVG 자식 요소 타입 확인 (path, circle 등)
                            const childType = typeof child.type === 'string' ? child.type.toLowerCase() : null;

                            // path, circle 등 SVG 자식 요소에 strokeWidth 적용
                            if (childType && ['path', 'circle', 'line', 'rect', 'polygon', 'polyline', 'ellipse'].includes(childType)) {
                              return React.cloneElement(child as React.ReactElement<any>, {
                                ...(child.props || {}),
                                strokeWidth: cardIconStrokeWidth, // 일관된 strokeWidth 적용
                              });
                            }

                            return child;
                          }),
                        });
                      }

                      // Lucide 아이콘 등 일반 React 컴포넌트
                      return React.cloneElement(header as React.ReactElement<any>, {
                        style: {
                          ...((header as React.ReactElement<any>).props?.style || {}),
                          width: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))',
                          height: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))',
                        },
                        strokeWidth: cardIconStrokeWidth,
                        size: cardIconSizeReduced, // padding 증가에 따라 아이콘 크기 감소 (--size-icon-md 사용)
                      });
                    })()
                  : header}
              </div>
            ) : icon ? (
              <div style={{
                width: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))', // padding 증가에 따라 아이콘 크기 감소
                height: 'calc(var(--spacing-xl) - var(--spacing-xs) - var(--spacing-xxs))', // padding 증가에 따라 아이콘 크기 감소
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSelected ? 'var(--color-white)' : (isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)'), // 선택된 카드만 화이트, 비선택 카드는 기본값
              }}>
                {React.isValidElement(icon)
                  ? (() => {
                      // SVG인 경우 (type이 'svg' 문자열)
                      const isSVG = typeof icon.type === 'string' && icon.type.toLowerCase() === 'svg';

                      if (isSVG) {
                        // SVG의 경우 자식 요소(path 등)의 strokeWidth도 오버라이드
                        return React.cloneElement(icon as React.ReactElement<any>, {
                          style: {
                            ...((icon as React.ReactElement<any>).props?.style || {}),
                            width: '100%',
                            height: '100%',
                          },
                          children: React.Children.map((icon as React.ReactElement<any>).props?.children || [], (child) => {
                            if (!React.isValidElement(child)) {
                              return child;
                            }

                            // SVG 자식 요소 타입 확인 (path, circle 등)
                            const childType = typeof child.type === 'string' ? child.type.toLowerCase() : null;

                            // path, circle 등 SVG 자식 요소에 strokeWidth 적용
                            if (childType && ['path', 'circle', 'line', 'rect', 'polygon', 'polyline', 'ellipse'].includes(childType)) {
                              return React.cloneElement(child as React.ReactElement<any>, {
                                ...(child.props || {}),
                                strokeWidth: cardIconStrokeWidth, // 일관된 strokeWidth 적용
                              });
                            }

                            return child;
                          }),
                        });
                      }

                      // Lucide 아이콘 등 일반 React 컴포넌트
                      return React.cloneElement(icon as React.ReactElement<any>, {
                        style: {
                          ...((icon as React.ReactElement<any>).props?.style || {}),
                          width: '100%',
                          height: '100%',
                        },
                        strokeWidth: cardIconStrokeWidth, // 항상 일관된 strokeWidth 적용
                        size: typeof icon.type === 'function' ? cardIconSizeReduced : undefined, // lucide 아이콘만 size prop 사용
                      });
                    })()
                  : icon}
              </div>
            ) : null}
          </div>
        )}
        {/* 우측: 타이틀, 컨텐츠 영역 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: 'var(--spacing-xs)',
        }}>
          {/* 타이틀 */}
          <h3 style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: titleFontWeight,
            color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)',
            display: '-webkit-box',
            WebkitLineClamp: maxTitleLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 'var(--line-height)',
            margin: 0,
          }}>
            {title}
          </h3>

          {/* 메인값과 단위, 필요한 경우 트렌드 (value가 있을 때만) */}
          {value !== undefined && (
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--spacing-xs)',
            }}>
              <div style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)',
                lineHeight: 'var(--line-height-tight)',
              }}>
                {value}
              </div>
              {unit && (
                <div style={{
                  color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: 'var(--line-height)',
                }}>
                  {unit}
                </div>
              )}
              {/* 트렌드 정보 (같은 줄) */}
              {trend && (
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--spacing-xxs)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: typeof trend === 'string' && trend.startsWith('+')
                    ? 'var(--color-success)'
                    : 'var(--color-error)',
                  marginLeft: 'var(--spacing-xs)',
                  lineHeight: 'var(--line-height)',
                }}>
                  {typeof trend === 'string' && trend.startsWith('+') ? (
                    <Triangle style={{
                      width: 'var(--font-size-xs)',
                      height: 'var(--font-size-xs)',
                      strokeWidth: trendIconStrokeWidth,
                      fill: 'currentColor',
                      transform: 'rotate(0deg)',
                      flexShrink: 0,
                      alignSelf: 'baseline',
                    }} />
                  ) : typeof trend === 'string' && trend.startsWith('-') ? (
                    <Triangle style={{
                      width: 'var(--font-size-xs)',
                      height: 'var(--font-size-xs)',
                      strokeWidth: trendIconStrokeWidth,
                      fill: 'currentColor',
                      transform: 'rotate(180deg)',
                      flexShrink: 0,
                      alignSelf: 'baseline',
                    }} />
                  ) : null}
                  <span>{trend}</span>
                </div>
              )}
            </div>
          )}

          {/* 설명 */}
          {description && (
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: maxDescriptionLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 'var(--line-height)',
              margin: 0,
            }}>
              {description}
            </p>
          )}

          {/* 추가 컨텐츠 (인사이트 리스트 등) */}
          {children}

          {/* 메타 정보: 학생 이름, 생성 시간 등 */}
          {meta && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              gap: 'var(--spacing-sm)',
            }}>
              {meta}
            </div>
          )}

          {/* 액션 버튼 영역 - 하단 고정 */}
          {!isEmpty && actions && (
            <div style={{ marginTop: 'auto', paddingTop: 'var(--spacing-sm)' }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
