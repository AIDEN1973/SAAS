# Phase 4: 성능 최적화 및 TODO 정리

> **기간**: 1~2주 | **우선순위**: P2 | **담당**: 1명
> **선행 조건**: Phase 0, 1 완료
> **목표**: limit:5000 제거, TODO 122건 → 50건 이하, 대형 파일 분리

---

## 4-1. limit:5000 클라이언트 전체 로드 제거 (3일)

### 현재 발생 위치 (5건)

| 파일 | 라인 | 컨텍스트 | 영향도 |
|------|------|----------|--------|
| `packages/hooks/use-student/src/student-queries.ts` | 123 | fetchStudents 전체 로드 | 🔴 High |
| `packages/hooks/use-student/src/student-list-core.ts` | 34 | tag 필터 해석 | 🔴 High |
| `packages/hooks/use-student/src/student-list-core.ts` | 58 | status/grade 필터 해석 | 🔴 High |
| `packages/hooks/use-student/src/student-list-core.ts` | 75 | class_id 필터 해석 | 🟡 Medium |
| `packages/hooks/use-student/src/student-list-core.ts` | 104 | soft-delete 필터 | 🔴 High |

> **참고**: `tag-hooks.ts:132`는 이미 limit 1000으로 감소됨 (5000 → 1000)

### 4-1-1. student-list-core.ts 필터 로직 서버 이전 (2일)

**문제**: `resolveStudentFilterIds()`가 필터 조건별로 최대 5,000건씩 ID 배열을 로드한 후 클라이언트에서 교집합 계산.

```
현재 플로우:
1. tag_ids 필터 → student_tag_assignments에서 5000건 로드
2. status/grade 필터 → academy_students에서 5000건 로드
3. class_id 필터 → student_classes에서 5000건 로드
4. soft-delete 필터 → academy_students에서 5000건 로드
5. 클라이언트에서 4개 배열 교집합 → 최종 ID 목록
```

**수정 방향**: DB 레벨에서 필터 결합

```
수정 대상:
- packages/hooks/use-student/src/student-list-core.ts (전체 리팩토링)

방안 A: RPC 함수 생성 (권장)
  - infra/supabase/supabase/migrations/XXX_create_resolve_student_filter_rpc.sql
  - 서버에서 JOIN + WHERE로 필터 해석
  - 클라이언트는 필터 파라미터만 전달, ID 배열 수신

방안 B: PostgREST 복합 필터
  - Supabase의 .or() / .in() 조합으로 서버 필터링
  - RPC 없이 가능하나 복잡한 조건 시 한계

권장: 방안 A (RPC)
```

```sql
-- 예시 RPC
CREATE OR REPLACE FUNCTION resolve_student_filter_ids(
  p_tenant_id UUID,
  p_tag_ids UUID[] DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_include_deleted BOOLEAN DEFAULT FALSE
) RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT p.id)
  FROM persons p
  JOIN academy_students a ON a.person_id = p.id
  LEFT JOIN student_tag_assignments sta ON sta.student_id = p.id
  LEFT JOIN student_classes sc ON sc.student_id = p.id
  WHERE p.tenant_id = p_tenant_id
    AND p.person_type = 'student'
    AND (p_tag_ids IS NULL OR sta.tag_id = ANY(p_tag_ids))
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_grade IS NULL OR a.grade = p_grade)
    AND (p_class_id IS NULL OR sc.class_id = p_class_id)
    AND (p_include_deleted OR a.deleted_at IS NULL);
$$ LANGUAGE sql SECURITY DEFINER;
```

### 4-1-2. fetchStudents 전체 로드 제거 (1일)

```
수정 대상:
- packages/hooks/use-student/src/student-queries.ts

현재 (Line 123):
  limit: 5000,

수정 후:
  - 전체 로드 함수(fetchStudents)를 deprecated 처리
  - 모든 호출자를 useStudentsPaged로 마이그레이션
  - 내보내기/벌크 작업은 별도 서버 API로 처리

영향 받는 호출자:
  - packages/hooks/use-student/src/useStudent.ts (메인 훅)
  - packages/hooks/use-student/src/useRecentActivity.ts (활동 피드)
  - 기타 대시보드 컴포넌트
```

### 4-1-3. 태그 통계 서버 집계 전환 (0.5일)

```
수정 대상:
- packages/hooks/use-student/src/tag-hooks.ts Line 132

현재: 전체 학생 로드 후 클라이언트에서 태그별 카운트
수정: RPC 또는 View로 서버 집계

CREATE OR REPLACE FUNCTION get_tag_student_counts(p_tenant_id UUID)
RETURNS TABLE(tag_id UUID, student_count BIGINT) AS $$
  SELECT sta.tag_id, COUNT(DISTINCT sta.student_id)
  FROM student_tag_assignments sta
  JOIN persons p ON p.id = sta.student_id
  WHERE p.tenant_id = p_tenant_id
  GROUP BY sta.tag_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 4-2. TODO 정리 — Critical/High 항목 (3일)

### 제거 또는 구현 대상 (30건)

Phase 0에서 이미 처리된 항목은 제외. 나머지 Critical/High TODO:

#### 즉시 구현 (10건)

| 파일:라인 | TODO | 작업 |
|-----------|------|------|
| `industry-academy/service.ts:990` | `attendance_rate: 0 // TODO: 출석 데이터 계산` | attendance_logs 기반 출석률 계산 쿼리 작성 |
| `industry-academy/service.ts:568` | `TODO: 향후 AI 연동 구현` | 현재 불필요하면 TODO 제거, 필요하면 이슈 생성 후 TODO를 이슈 번호로 교체 |
| `hooks/use-student/src/class-hooks.ts:216` | `TODO: Edge Function을 통해 enrollStudentToClass 호출로 변경` | RPC 또는 Edge Function으로 전환 |
| `hooks/use-student/src/class-hooks.ts:307` | `TODO: Edge Function을 통해 unenrollStudentFromClass 호출로 변경` | 위와 동일 |
| `hooks/use-regional-stats-cards/src:89` | `const region = '강남구' // TODO` | config 또는 tenant 설정에서 지역 조회 |
| `hooks/use-schema/src/useSchema.ts:153` | `const clientVersion = '1.0.0' // TODO` | package.json에서 버전 읽기 |
| `hooks/use-schema/src/useSchema.ts:162` | `TODO: Semver 비교 로직` | semver 라이브러리 적용 또는 간단 비교 함수 |
| `schema-engine/src/loader/index.ts:58` | `industryType: undefined // TODO` | context에서 industryType 주입 |
| `apps/academy-admin/src/utils/pdf-generator.ts:65` | `TODO: 한글 폰트 임베드` | Noto Sans KR 웹폰트 임베드 |
| `kiosk-check-in/index.ts:367` | `TODO: 실제 알림 발송 구현` | alimtalk-send Edge Function 연동 |

#### 이슈로 전환 후 TODO 교체 (10건)

형식: `// TODO` → `// See: #123` (GitHub Issue 번호)

| 파일:라인 | TODO | 이슈 제목 |
|-----------|------|-----------|
| `hooks/use-weather-signals/src:47` | `TODO: 실제 날씨 API` | "날씨 신호 API 연동" |
| `schema-engine/src/loader/migration.ts:35` | `TODO: Migration Rule` | "스키마 마이그레이션 규칙 엔진" |
| `schema-engine/src/loader/i18n.ts:127` | `TODO: table, detail 처리` | "스키마 i18n 완전 지원" |
| `pages/HomePage.tsx:420` | `TODO[DATA]: 출결 오류 전용` | "출결 오류 추적 테이블" |
| `pages/HomePage.tsx:474` | `TODO[DATA]: 시스템 오류 로그` | "시스템 오류 로그 테이블" |
| `pages/BillingPage.tsx:214` | `P2 TODO: settlements 테이블` | "정산 기록 테이블 생성" |
| `pages/BillingPage.tsx:267` | `P1 TODO: 인보이스 상태 업데이트` | "인보이스 상태 관리 기능" |
| `plan-upgrade/index.ts:175` | `TODO: plan_changes 테이블` | "플랜 변경 이력 추적" |
| `pages/StudentsHomePage.tsx:66` | `TODO: 태그 관리 기능` | "학생 태그 관리 UI" |
| `schema-engine/src/renderer.tsx:46` | `TODO: Table → ui-core` | "SchemaTable ui-core 마이그레이션" |

#### 삭제 (불필요한 TODO 10건)

```
- 문서 파일 내 TODO (docu/*.md) → 문서 업데이트 또는 삭제
- 스크립트 파일 내 TODO (scripts/*.ts) → 구현 또는 삭제
- 매뉴얼 드래프트 내 TODO (data/manuals/drafts/*.ts) → 구현 또는 삭제
```

---

## 4-3. 대형 파일 분리 (2일)

### industry-academy/service.ts 분리

```
현재: packages/industry/industry-academy/src/service.ts (1,974줄, 4개 도메인 혼재)

분리 후:
  packages/industry/industry-academy/src/
  ├── service.ts              → 재export + 공통 유틸 (~200줄)
  ├── student-service.ts      → 학생 CRUD (~600줄)
  ├── teacher-service.ts      → 강사 CRUD (~300줄)
  ├── class-service.ts        → 수업 관리 (~400줄)
  ├── attendance-service.ts   → 출결 관리 (~400줄)
  └── student-transforms.ts   → 기존 유지 (139줄)
```

**주의**: 기존 `service.ts`에서 `export class AcademyService`를 유지하되, 내부적으로 분리된 파일을 위임. 외부 import 경로는 변경하지 않음.

```typescript
// service.ts (분리 후)
import { StudentDomain } from './student-service';
import { TeacherDomain } from './teacher-service';
import { ClassDomain } from './class-service';
import { AttendanceDomain } from './attendance-service';

export class AcademyService {
  private students = new StudentDomain(this.supabase);
  private teachers = new TeacherDomain(this.supabase);
  private classes = new ClassDomain(this.supabase);
  private attendance = new AttendanceDomain(this.supabase);

  // 기존 API 유지 (위임)
  getStudents = this.students.getStudents.bind(this.students);
  createStudent = this.students.createStudent.bind(this.students);
  // ...
}
```

### App.tsx 라우팅 분리

```
현재: apps/academy-admin/src/App.tsx (841줄)

분리 후:
  apps/academy-admin/src/
  ├── App.tsx                 → 최상위 Provider + Router (100줄)
  ├── routes/
  │   ├── index.ts            → 라우트 정의 배열 (200줄)
  │   ├── auth-routes.tsx     → 인증 관련 라우트
  │   ├── admin-routes.tsx    → 관리자 라우트
  │   └── guards.tsx          → AuthGuard, RoleGuard
  └── layouts/
      ├── MainLayout.tsx      → 사이드바 + 콘텐츠 영역
      └── AuthLayout.tsx      → 로그인/회원가입 레이아웃
```

---

## Phase 4 완료 기준

| 지표 | 현재 | 목표 |
|------|------|------|
| `limit: 5000` | 5건 | **0건** |
| TODO/FIXME/HACK | 122건 | **50건 이하** (나머지는 이슈 번호로 교체) |
| 1000줄+ 파일 (src 코드) | 12개 | **2개 이하** |
| fetchStudents (비페이징) 호출 | 다수 | **deprecated + 0건 사용** |

### 검증 명령어

```bash
# limit:5000 잔여 확인
grep -r "limit: 5000\|limit:5000" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# TODO 잔여 카운트
grep -r "TODO\|FIXME\|HACK" packages/ apps/ infra/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "*.test.*" | wc -l

# 대형 파일 확인
find packages/ apps/ -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs wc -l | sort -rn | head -10
```

---

## 다음 단계

← [Phase 3: Edge Function 안정성](./RISK_REMEDIATION_PHASE_3.md)
→ [마스터 플랜 인덱스](./RISK_REMEDIATION_MASTER.md)
