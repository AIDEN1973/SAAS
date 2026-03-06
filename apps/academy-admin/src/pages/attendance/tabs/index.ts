/**
 * 출결 관리 탭 컴포넌트 - Lazy Loading Barrel Export
 *
 * [LAYER: UI_PAGE]
 */

import { lazy } from 'react';

export const TodayAttendanceTab = lazy(() =>
  import('./TodayAttendanceTab').then(m => ({ default: m.TodayAttendanceTab }))
);

export const HistoryTab = lazy(() =>
  import('./HistoryTab').then(m => ({ default: m.HistoryTab }))
);

export const StatisticsTab = lazy(() =>
  import('./StatisticsTab').then(m => ({ default: m.StatisticsTab }))
);

export const SettingsTab = lazy(() =>
  import('./SettingsTab').then(m => ({ default: m.SettingsTab }))
);
