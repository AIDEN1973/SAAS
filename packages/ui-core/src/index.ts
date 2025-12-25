/**
 * UI Core
 *
 * 공통 UI 컴포넌트 라이브러리
 *
 * [불변 규칙] 테마 토큰은 design-system 패키지에서 중앙 관리
 * [불변 규칙] 모든 스타일은 design-system 토큰을 import하여 사용
 *
 * 사용법:
 * - 컴포넌트: import { Button, Card } from '@ui-core/react'
 * - 테마 토큰: import '@ui-core/react/styles'
 */

export * from './components';
export * from './hooks';
export * from './ssot';
