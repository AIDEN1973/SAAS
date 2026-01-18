/**
 * Student Tabs - Lazy Loading Exports
 *
 * 코드 스플리팅을 통한 초기 로딩 성능 최적화
 * [성능] 각 탭은 실제 사용될 때만 로드됨
 */

import { lazy } from 'react';

// Lazy load로 코드 스플리팅
export const StudentInfoTab = lazy(() =>
  import('./StudentInfoTab').then(module => ({ default: module.StudentInfoTab }))
);

export const ConsultationsTab = lazy(() =>
  import('./ConsultationsTab').then(module => ({ default: module.ConsultationsTab }))
);

export const TagsTab = lazy(() =>
  import('./TagsTab').then(module => ({ default: module.TagsTab }))
);

export const ClassesTab = lazy(() =>
  import('./ClassesTab').then(module => ({ default: module.ClassesTab }))
);

export const AttendanceTab = lazy(() =>
  import('./AttendanceTab').then(module => ({ default: module.AttendanceTab }))
);

export const RiskAnalysisTab = lazy(() =>
  import('./RiskAnalysisTab').then(module => ({ default: module.RiskAnalysisTab }))
);

export const MessageSendTab = lazy(() =>
  import('./MessageSendTab').then(module => ({ default: module.MessageSendTab }))
);
