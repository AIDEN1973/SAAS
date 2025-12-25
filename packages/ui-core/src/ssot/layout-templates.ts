/**
 * SSOT: Layout Templates
 *
 * 레이아웃 템플릿의 단일 정본(SSOT)
 * [불변 규칙] 페이지는 표준 템플릿을 따름
 *
 * 참조 문서: docu/SSOT_UI_DESIGN.md F장
 */

import * as React from 'react';

/**
 * 반응형 브레이크포인트 (고정 값)
 * 참조: docu/디어쌤 아키텍처.md 6-0 섹션
 */
export const BREAKPOINTS = {
  XS: 0,      // 모바일 (기본)
  SM: 640,    // 큰 모바일 / 작은 태블릿
  MD: 768,    // 태블릿
  LG: 1024,   // 작은 데스크톱
  XL: 1280,   // 큰 데스크톱
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Container 최대 너비 옵션
 */
export const CONTAINER_MAX_WIDTH = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  '2XL': '2xl',
} as const;

export type ContainerMaxWidth = typeof CONTAINER_MAX_WIDTH[keyof typeof CONTAINER_MAX_WIDTH];

/**
 * Container 패딩 옵션
 */
export const CONTAINER_PADDING = {
  NONE: 'none',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

export type ContainerPadding = typeof CONTAINER_PADDING[keyof typeof CONTAINER_PADDING];

/**
 * Grid 컬럼 설정 타입
 */
export interface GridColumns {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

/**
 * Page Template 타입
 */
export const PAGE_TEMPLATE = {
  DASHBOARD: 'dashboard',
  LIST_DETAIL: 'list-detail',
  SETTINGS: 'settings',
  WIZARD: 'wizard',
} as const;

export type PageTemplate = typeof PAGE_TEMPLATE[keyof typeof PAGE_TEMPLATE];

/**
 * Dashboard Template 구조
 */
export interface DashboardTemplateConfig {
  title: string;
  actions?: React.ReactNode;
  cards: React.ReactNode[];
  desktopColumns?: number;
  tabletColumns?: number;
  mobileColumns?: number;
}

/**
 * List+Detail Template 구조
 */
export interface ListDetailTemplateConfig {
  title: string;
  actions?: React.ReactNode;
  data: unknown[];
  columns?: unknown[];
  pagination?: boolean;
}

/**
 * Settings Template 구조
 */
export interface SettingsTemplateConfig {
  title: string;
  sections: Array<{
    title: string;
    content: React.ReactNode;
  }>;
}

/**
 * 표준 페이지 구조 검증
 */
export function validatePageStructure(
  hasContainer: boolean,
  hasPageHeader: boolean
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!hasContainer) {
    warnings.push('페이지는 Container로 감싸져야 합니다.');
  }

  if (!hasPageHeader) {
    warnings.push('페이지는 PageHeader를 사용해야 합니다.');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * 반응형 모드 확인 헬퍼
 */
export function getResponsiveMode(width: number): Breakpoint {
  if (width >= BREAKPOINTS.XL) return 'XL';
  if (width >= BREAKPOINTS.LG) return 'LG';
  if (width >= BREAKPOINTS.MD) return 'MD';
  if (width >= BREAKPOINTS.SM) return 'SM';
  return 'XS';
}

/**
 * 데스크톱 모드 확인
 */
export function isDesktop(mode: Breakpoint): boolean {
  return mode === 'LG' || mode === 'XL';
}

/**
 * 태블릿 모드 확인
 */
export function isTablet(mode: Breakpoint): boolean {
  return mode === 'MD';
}

/**
 * 모바일 모드 확인
 */
export function isMobile(mode: Breakpoint): boolean {
  return mode === 'XS' || mode === 'SM';
}

