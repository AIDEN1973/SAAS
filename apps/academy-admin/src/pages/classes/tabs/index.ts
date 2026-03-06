/**
 * Class Tabs - Lazy Loading Exports
 *
 * 코드 스플리팅을 통한 초기 로딩 성능 최적화
 * [성능] 각 탭은 실제 사용될 때만 로드됨
 */

import { lazy } from 'react';

export const ClassInfoTab = lazy(() =>
  import('./ClassInfoTab').then(module => ({ default: module.ClassInfoTab }))
);

export const ClassStudentsTab = lazy(() =>
  import('./ClassStudentsTab').then(module => ({ default: module.ClassStudentsTab }))
);

export const ClassTeachersTab = lazy(() =>
  import('./ClassTeachersTab').then(module => ({ default: module.ClassTeachersTab }))
);
