/**
 * Core Tenancy
 * 
 * 테넌시 (user_tenant_roles 기반)
 * [불변 규칙] 클라이언트에서는 타입만 import: import type { ... } from '@core/tenancy'
 * [불변 규칙] 서버 코드는 서버/Edge에서만 사용: import { tenancyService } from '@core/tenancy/service'
 * 
 * ⚠️ 주의: 이 index.ts에서는 타입만 export합니다.
 * 서버 코드는 클라이언트 번들에 포함되지 않도록 './service'에서 직접 import하세요.
 */

// 타입만 export (클라이언트에서도 사용 가능, 서버 코드는 포함되지 않음)
export * from './types';

// 서버 전용 코드는 이 index.ts에서 export하지 않습니다.
// 서버에서는 직접 import: import { tenancyService } from '@core/tenancy/service'

