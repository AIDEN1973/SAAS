/**
 * UI Core
 * 
 * 공통 UI 컴포넌트 및 훅
 * 
 * [불변 규칙] 전역 스타일은 이 패키지에서 중앙 관리
 * [불변 규칙] 모든 앱은 이 패키지의 스타일을 import하여 사용
 * 
 * 사용법:
 * - 컴포넌트: import { Button, Card } from '@ui-core/react'
 * - 전역 스타일: import '@ui-core/react/styles'
 */

export * from './components';
export * from './hooks';

