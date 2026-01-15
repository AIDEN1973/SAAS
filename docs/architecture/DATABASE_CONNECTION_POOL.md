# Database Connection Pool 설정 가이드

## 개요

SAMDLE 프로젝트는 Supabase를 사용하며, Connection Pool 관리는 Supabase 플랫폼에서 자동으로 처리됩니다.
이 문서는 현재 설정과 스케일링 시 고려사항을 설명합니다.

## 현재 아키텍처

### Supabase Connection 방식

```
[Client App] -> [Supabase Client SDK] -> [Supabase Edge] -> [PgBouncer] -> [PostgreSQL]
```

- **Supabase Client SDK**: 싱글톤 패턴으로 관리 (`packages/lib/supabase-client/src/client.ts`)
- **PgBouncer**: Supabase에서 자동 제공하는 Connection Pooler
- **PostgreSQL**: Supabase 관리형 데이터베이스

### 싱글톤 클라이언트 패턴

```typescript
// packages/lib/supabase-client/src/client.ts
let clientInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;  // 기존 인스턴스 재사용
  }
  // ... 새 인스턴스 생성
  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {...});
  return clientInstance;
}
```

## Connection Pool 설정

### Supabase 기본 제공 Pool 설정

Supabase는 PgBouncer를 통해 자동으로 Connection Pool을 관리합니다:

| 플랜 | Direct Connection | Pooled Connection |
|------|-------------------|-------------------|
| Free | 10 | 50 |
| Pro | 60 | 200 |
| Team | 120 | 400 |
| Enterprise | Custom | Custom |

### 연결 방식 선택

1. **Direct Connection** (Port 5432)
   - 용도: 마이그레이션, 스키마 변경
   - 특징: 트랜잭션/세션 기능 완전 지원

2. **Pooled Connection** (Port 6543)
   - 용도: 애플리케이션 쿼리
   - 특징: Transaction Mode로 효율적인 커넥션 공유

### 환경변수 설정

```env
# 클라이언트 앱용 (Pooled Connection 권장)
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

# 마이그레이션/백엔드용 (Direct Connection)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres

# Pooled Connection (Transaction Mode)
DATABASE_URL_POOLED=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Rate Limiting과 Connection Pool 연동

### 현재 구현된 Rate Limiter

```typescript
// packages/api-sdk/src/rate-limiter.ts
const DEFAULT_CONFIG: RateLimiterConfig = {
  requestsPerSecond: 100,      // 테넌트당 100 req/s
  burstLimit: 150,             // 순간 버스트 허용
  maxRetries: 3,               // 최대 재시도 횟수
  retryBackoffMultiplier: 1.5, // 지수 백오프
  baseDelayMs: 100,
  maxDelayMs: 5000,
};
```

### Connection 사용 최적화

Rate Limiter가 요청을 제어하므로 Connection Pool 고갈을 방지합니다:

```
테넌트 A: 100 req/s → Rate Limiter → Pooled Connection
테넌트 B: 100 req/s → Rate Limiter → Pooled Connection
...
총합: N개 테넌트 × 100 req/s ≤ Pool Size
```

## 스케일링 시 고려사항

### 10,000 테넌트 규모 예상

| 지표 | 추정값 | 권장 설정 |
|------|--------|-----------|
| 동시 활성 테넌트 | ~500 | - |
| 피크 요청 | 50,000 req/s | Enterprise Pool |
| 필요 Connection | ~500 | Supabase Enterprise |

### 스케일링 체크리스트

1. **Connection Pool 모니터링**
   - Supabase Dashboard에서 `Active Connections` 확인
   - `pg_stat_activity` 쿼리로 상세 분석

2. **Pool Exhaustion 방지**
   ```sql
   -- 현재 연결 상태 확인
   SELECT state, count(*)
   FROM pg_stat_activity
   WHERE datname = 'postgres'
   GROUP BY state;
   ```

3. **Connection Timeout 설정**
   - Statement timeout: 30s (복잡한 쿼리 방지)
   - Idle timeout: 5m (유휴 연결 정리)

### Enterprise 전환 시점

- 동시 연결 > 200 (Pro 한계)
- 월 요청 > 100M
- 99.9% SLA 필요

## 모니터링 쿼리

### 연결 상태 확인

```sql
-- 활성 연결 수
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- 테넌트별 연결 분포 (RLS 컨텍스트 기반)
SELECT
  current_setting('app.tenant_id', true) as tenant_id,
  count(*) as connections
FROM pg_stat_activity
GROUP BY 1;
```

### Connection Pool 효율성

```sql
-- 쿼리 대기 시간
SELECT
  calls,
  total_time / calls as avg_time_ms,
  query
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## 관련 파일

- `packages/lib/supabase-client/src/client.ts` - Supabase 클라이언트 싱글톤
- `packages/api-sdk/src/rate-limiter.ts` - 테넌트별 Rate Limiting
- `packages/api-sdk/src/client.ts` - API 클라이언트 (Rate Limiter 통합)

## 참고 자료

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PgBouncer Transaction Mode](https://www.pgbouncer.org/features.html)
- [Supabase Pricing - Connection Limits](https://supabase.com/pricing)
