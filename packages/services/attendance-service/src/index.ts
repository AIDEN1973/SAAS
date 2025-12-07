/**
 * Attendance Service
 * 
 * 출결 관리 서비스 레이어
 * [불변 규칙] Service Layer는 Industry Layer를 래핑하여 제공합니다.
 * [불변 규칙] 클라이언트에서는 타입만 import: import type { ... } from '@services/attendance-service'
 * [불변 규칙] 서버 코드는 서버/Edge에서만 사용: import { attendanceService } from '@services/attendance-service/service'
 * 
 * ⚠️ 주의: 이 index.ts에서는 타입만 export합니다.
 * 서버 코드는 클라이언트 번들에 포함되지 않도록 './service'에서 직접 import하세요.
 * 
 * 실제 비즈니스 로직은 @industry/academy/service에 있습니다.
 */

// 타입만 export (클라이언트에서도 사용 가능, 서버 코드는 포함되지 않음)
export type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
  AttendanceType,
  AttendanceStatus,
} from '@industry/academy';

// 서버 전용 코드는 이 index.ts에서 export하지 않습니다.
// 서버에서는 직접 import: import { attendanceService } from '@services/attendance-service/service'
// 또는: import { attendanceService } from '@services/attendance-service/dist/service' (빌드 후)

