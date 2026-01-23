/**
 * Utils Barrel Export (SSOT)
 *
 * [불변 규칙] 모든 유틸리티는 이 파일을 통해 export
 * [불변 규칙] 페이지에서는 이 파일 하나만 import하면 됨
 * [불변 규칙] Tree-shaking을 위해 명시적 export 사용
 */

// 카드 관련 유틸리티
export {
  normalizeDashboardCard,
  normalizeDashboardCards,
  normalizeEmergencyCard,
  normalizeAIBriefingCard,
  normalizeClassCard,
  normalizeStatsCard,
  normalizeBillingSummaryCard,
  normalizeStudentTaskCard,
  isPlaceholderCard,
  isValidPlaceholderCard,
  createEmptyTaskCard,
} from './dashboardCardUtils';

// Policy 관련 유틸리티
export {
  getPolicyValueFromConfig,
  getPolicyNumber,
  getPolicyBoolean,
  getPolicyString,
  getPolicyValueWithDefault,
  setPolicyValueByPath,
  setPolicyValuesByPaths,
} from './policy-utils';

export {
  getPolicyValue,
  getPolicyValueWithPath,
  POLICY_REGISTRY,
  getAutomationEventPolicyPath,
  extractFieldPathFromPolicyPath,
} from './policy-registry';
export type { PolicyKey, PolicyDefinition, PolicySource } from './policy-registry';

// 청구 관련 유틸리티
export {
  isInvoicePaid,
  INVOICE_PAID_STATUSES,
} from './billingUtils';

// 에러 처리 유틸리티
export {
  safe,
  safeAll,
  ensureArray,
  ensureNumber,
  ensureString,
} from './error-handling-utils';

// 타입 가드 유틸리티
export {
  isString,
  isArray,
  isNumber,
  isObject,
  hasOwnProperty,
} from './type-guards-utils';

// 데이터 정규화 유틸리티
export {
  toNullable,
  normalizeNullableFields,
  normalizeNumber,
  normalizeDateString,
  normalizeBoolean,
  processTagInput,
} from './data-normalization-utils';

// 날짜 범위 계산 유틸리티
export {
  getBaseKST,
  calculateMonthlyRange,
  calculateWeeklyRange,
  calculateDailyRange,
  calculateDaysAgoRange,
  parseKSTDate,
} from './date-range-utils';
export type {
  DateRange,
  WeeklyRange,
  MonthlyRange,
  DailyRange,
} from './date-range-utils';

// 네비게이션 보안 유틸리티 (SSOT)
export {
  isSafeInternalPath,
  createSafeNavigate,
} from './navigation-utils';

// 트렌드 계산 유틸리티 (SSOT)
export {
  calculateTrend,
  calculateTrendPercentPoint,
} from './trend-calculation-utils';

// 로깅 유틸리티 (SSOT)
export {
  logError,
  logWarn,
  logInfo,
} from './logger-utils';

// 지역 통계 분석 유틸리티 (QUALITY-1)
export {
  findBestComparisonGroup,
  getComparisonGroupLabel,
  calculatePercentileRank,
  calculateRank,
} from './analytics/regional-comparison-utils';
export type {
  LocationInfo,
  DailyRegionMetrics,
  ComparisonGroup,
} from './analytics/regional-comparison-utils';

// 한국어 조사 처리 유틸리티 (SSOT)
export {
  getParticle,
  withParticle,
  p,
  templates,
  menuLabels,
} from './korean-particle-utils';

// 기타 유틸리티 (필요시 추가)
export { renderCard } from './dashboardCardRenderer';
export { handleCardClick } from './handleCardClick';

// 사이드바 유틸리티
export {
  getSidebarItemsForRole,
  createHasPagePermission,
} from './sidebar-utils.tsx';
export type { SidebarUtilsOptions } from './sidebar-utils.tsx';

