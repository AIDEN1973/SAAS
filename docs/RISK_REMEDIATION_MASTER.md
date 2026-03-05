# 구조적 리스크 개선 마스터 플랜

> **프로젝트**: SAMDLE (디어쌤)
> **기준 문서**: [감사 보고서 v2](./AUDIT_REPORT_v2.md)
> **총 기간**: 6~8주
> **목표**: 감사 종합 점수 67점 → 85점+

---

## 전체 로드맵

```
Week 1          Week 2          Week 3          Week 4          Week 5-6
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Phase 0  │   │ Phase 1  │   │ Phase 1  │   │ Phase 3  │   │ Phase 4  │
│ 긴급보안  │──▶│ 테스트   │──▶│ 테스트   │──▶│ Edge Fn  │──▶│ 성능/TODO│
│ 3~5일    │   │ (전반)   │   │ (후반)   │   │ 안정성   │   │ 1~2주   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                    ┌──────────────────────┐
                    │      Phase 2         │
                    │  타입 안전성 (병렬)   │
                    │      1~2주           │
                    └──────────────────────┘
```

---

## 페이즈 목록

| Phase | 문서 | 기간 | 우선순위 | 핵심 지표 |
|-------|------|------|----------|-----------|
| **[Phase 0](./RISK_REMEDIATION_PHASE_0.md)** | 긴급 보안/데이터 무결성 | 3~5일 | P0 (즉시) | 웹훅 서명, billing amount, class_name, auth 타입 |
| **[Phase 1](./RISK_REMEDIATION_PHASE_1.md)** | 테스트 커버리지 복구 | 2주 | P0 | 테스트 파일 17→30+, 케이스 201→370+, E2E skip 16→0 |
| **[Phase 2](./RISK_REMEDIATION_PHASE_2.md)** | 타입 안전성 복원 | 1~2주 | P1 | `as any` 81→20, `eslint-disable` 101→40 |
| **[Phase 3](./RISK_REMEDIATION_PHASE_3.md)** | Edge Function 안정성 | 2주 | P1 | 에러 복구 점수 27%→88% |
| **[Phase 4](./RISK_REMEDIATION_PHASE_4.md)** | 성능 최적화 / TODO 정리 | 1~2주 | P2 | limit:5000 5→0건, TODO 122→50건 |

---

## 병렬 실행 가이드

```
Phase 0  ──────▶  Phase 1  ──────▶  Phase 3  ──────▶  Phase 4
  (필수 선행)       (순차)             (순차)            (순차)

                 Phase 2 (Phase 0 완료 후 Phase 1과 병렬 가능)
```

- **Phase 0**: 모든 Phase의 선행 조건. 반드시 먼저 완료
- **Phase 1 + Phase 2**: 담당자가 다르면 병렬 실행 가능
- **Phase 3**: Phase 0 완료 후 시작 가능 (Phase 1과도 병렬 가능하나 권장하지 않음)
- **Phase 4**: Phase 0, 1 완료 후 시작 (서버 페이지네이션은 테스트가 선행되어야 안전)

---

## LLM 컨텍스트 관리 가이드

각 Phase 문서는 **LLM의 컨텍스트 윈도우를 고려**하여 설계되었습니다:

### 파일별 사용법

| 상황 | 읽을 문서 | 이유 |
|------|-----------|------|
| 이번 주 뭘 해야 하나? | 이 문서 (MASTER) | 전체 로드맵과 현재 Phase 확인 |
| Phase N 작업 시작 | 해당 Phase 문서 1개만 | 각 문서에 대상 파일, 라인, 구현 사항 완비 |
| 작업 완료 검증 | 해당 Phase 문서의 "완료 기준" 섹션 | 정량 목표 + 검증 명령어 포함 |
| 전체 상태 확인 | 이 문서의 KPI 대시보드 | 진행률 한눈에 확인 |

### 프롬프트 예시

```
Phase 0을 시작해야 해.
docs/RISK_REMEDIATION_PHASE_0.md를 읽고 0-1부터 순서대로 작업해줘.
```

```
Phase 2-1 SchemaField 타입 복원 작업을 해야 해.
docs/RISK_REMEDIATION_PHASE_2.md를 읽고 2-1 섹션의 지시에 따라 작업해줘.
packages/schema-engine/src/react/SchemaField.tsx 파일을 수정해야 해.
```

---

## KPI 대시보드

### 리스크별 현재 → 목표

| 리스크 | 현재 | Phase 0 후 | Phase 1 후 | Phase 2 후 | Phase 3 후 | Phase 4 후 |
|--------|------|-----------|-----------|-----------|-----------|-----------|
| **보안 취약점** | 3건 | **0건** | 0건 | 0건 | 0건 | 0건 |
| **데이터 무결성 버그** | 3건 | **0건** | 0건 | 0건 | 0건 | 0건 |
| **테스트 파일** | 17개 | 17개 | **30개+** | 30개+ | 30개+ | 30개+ |
| **활성 테스트 케이스** | 201건 | 201건 | **370건+** | 370건+ | 370건+ | 370건+ |
| **E2E skip** | 16건 | 16건 | **0건** | 0건 | 0건 | 0건 |
| **`as any`** | 81건 | ~78건 | ~78건 | **20건↓** | 20건↓ | 20건↓ |
| **`eslint-disable`** | 101건 | ~98건 | ~98건 | **40건↓** | 40건↓ | 40건↓ |
| **Edge Fn 복구 점수** | 27% | 27% | 27% | 27% | **88%** | 88% |
| **limit:5000** | 5건 | 5건 | 5건 | 5건 | 5건 | **0건** |
| **TODO** | 122건 | ~117건 | ~117건 | ~117건 | ~117건 | **50건↓** |

### 감사 점수 예상 추이

| 항목 | 현재 | Phase 0 후 | 전체 완료 후 |
|------|------|-----------|-------------|
| 아키텍처 설계 | 84 | 84 | **86** |
| 코드 품질 | 68 | 72 | **82** |
| 테스트/품질보증 | 35 | 35 | **75** |
| 문서화 | 92 | 92 | **92** |
| 운영 준비도 | 55 | 60 | **82** |
| **종합** | **67** | **69** | **85** |

---

## 신규 파일 총 목록

### Phase 0 (수정만, 신규 파일 없음)
```
(기존 파일 수정만)
```

### Phase 1 (테스트 파일 13개+)
```
packages/services/student-service/src/__tests__/service.test.ts
packages/services/attendance-service/src/__tests__/service.test.ts
packages/services/class-service/src/__tests__/service.test.ts
packages/services/auth-service/src/__tests__/service.test.ts
packages/industry/industry-academy/src/__tests__/service.test.ts
packages/industry/industry-academy/src/__tests__/student-transforms.test.ts
packages/core/core-billing/src/__tests__/service.test.ts
packages/core/core-auth/src/__tests__/service.test.ts
packages/core/core-auth/src/__tests__/signup.test.ts
tests/e2e/helpers/seed.ts
tests/e2e/helpers/cleanup.ts
tests/e2e/helpers/auth.ts
.env.test
```

### Phase 2 (타입 파일 3개)
```
packages/schema-engine/src/types/form-rules.ts
packages/ui-core/src/types/events.ts
infra/supabase/supabase/functions/_shared/types.ts
```

### Phase 3 (인프라 파일 5개)
```
infra/supabase/supabase/functions/_shared/retry.ts
infra/supabase/supabase/functions/_shared/dlq.ts
infra/supabase/supabase/functions/_shared/alerting.ts
infra/supabase/supabase/functions/worker-process-dlq/index.ts
infra/supabase/supabase/migrations/XXX_create_dead_letter_queue.sql
```

### Phase 4 (구조 분리 + RPC)
```
packages/industry/industry-academy/src/student-service.ts
packages/industry/industry-academy/src/teacher-service.ts
packages/industry/industry-academy/src/class-service.ts
packages/industry/industry-academy/src/attendance-service.ts
apps/academy-admin/src/routes/index.ts
apps/academy-admin/src/routes/auth-routes.tsx
apps/academy-admin/src/routes/admin-routes.tsx
apps/academy-admin/src/routes/guards.tsx
apps/academy-admin/src/layouts/MainLayout.tsx
apps/academy-admin/src/layouts/AuthLayout.tsx
infra/supabase/supabase/migrations/XXX_create_resolve_student_filter_rpc.sql
infra/supabase/supabase/migrations/XXX_create_tag_student_counts_rpc.sql
```

---

## 완료 후 기대 효과

1. **보안**: 웹훅 위조 공격 차단, 인증 코드 타입 안전성 확보
2. **데이터 무결성**: 빌링 금액 정확, 반별 학생 수 정확, 소속반 표시
3. **품질 보증**: 핵심 비즈니스 로직 테스트 커버리지 70%+, E2E 전수 통과
4. **타입 안전성**: 런타임 타입 에러 90% 감소
5. **운영 안정성**: Edge Function 장애 자동 감지/복구/알림
6. **성능**: 5,000명+ 학원에서도 안정적 동작
7. **유지보수**: 대형 파일 분리, TODO 정리로 개발 속도 향상
