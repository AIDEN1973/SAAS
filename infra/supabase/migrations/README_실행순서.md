# 마이그레이션 실행 순서

⚠️ **중요**: 반드시 아래 순서대로 실행해야 합니다. 순서를 바꾸면 외래키 참조 오류가 발생합니다.

## 필수 실행 순서

### 1단계: 공통 함수 생성 (가장 먼저 실행)
```
000_create_common_functions.sql
```
- `update_updated_at_column()` 함수 생성 (트리거에서 사용)

### 2단계: Core Platform 테이블
```
000_create_core_tables.sql
```
- `tenants` 테이블 생성 (모든 테이블이 참조)
- `user_tenant_roles` 테이블
- `tenant_settings` 테이블
- `tenant_features` 테이블

### 3단계: Core Platform RLS
```
000_create_core_rls.sql
```
- Core Platform 테이블들의 RLS 정책

### 4단계: Core Tags 테이블
```
003_create_core_tags_tables.sql
```
- `tags` 테이블
- `tag_assignments` 테이블

### 5단계: Core Tags RLS
```
004_create_core_tags_rls.sql
```
- Tags 테이블들의 RLS 정책

### 6단계: Core Party 테이블
```
005_create_persons_table.sql
```
- `persons` 테이블 (Core Party)

### 7단계: Academy Students 테이블
```
006_create_academy_students_table.sql
```
- `academy_students` 테이블 (persons 참조)

### 8단계: Academy 관련 테이블
```
011_create_academy_related_tables.sql
```
- `guardians` 테이블 (persons 참조)
- `student_classes` 테이블 (persons 참조)
- `student_consultations` 테이블 (persons 참조)

### 9단계: Academy 관련 RLS
```
012_create_academy_related_rls.sql
```
- Academy 관련 테이블들의 RLS 정책

### 10단계: students View 생성 (기존 코드 호환성)
```
013_create_students_view.sql
또는
014_finalize_students_view.sql (권장 - 더 안전한 버전)
```
- `students` View 생성 (기존 코드 호환성)
- [불변 규칙] 기술문서 정책 준수: 별도 테이블이 아닌 View 사용
- `persons` + `academy_students` 조인하여 조회
- ⚠️ 중요: 이 View는 읽기 전용입니다. INSERT/UPDATE/DELETE는 Service Layer를 통해 `persons` + `academy_students` 테이블에 직접 수행해야 합니다.
- `014_finalize_students_view.sql`은 더 안전한 검증 로직을 포함합니다.

---

## 실행하지 않을 파일

다음 파일들은 **실행하지 마세요** (기존 students 테이블 구조용):

- ❌ `001_create_students_tables.sql` (기존 구조, 사용 안 함)
- ❌ `002_create_students_rls.sql` (기존 구조, 사용 안 함)
- ❌ `007_migrate_students_to_persons.sql` (마이그레이션용, 테이블이 없으면 불필요)
- ❌ `008_update_guardians_fk_to_person_id.sql` (FK 업데이트용, 테이블이 없으면 불필요)
- ❌ `009_update_consultations_fk_to_person_id.sql` (FK 업데이트용, 테이블이 없으면 불필요)
- ❌ `010_update_student_classes_fk_to_person_id.sql` (FK 업데이트용, 테이블이 없으면 불필요)

---

## 빠른 실행 가이드

Supabase SQL Editor에서 다음 순서로 실행:

1. `000_create_common_functions.sql` ✅ **먼저 실행 필수** (함수 정의)
2. `000_create_core_tables.sql` ✅ **두 번째 실행 필수** (tenants 테이블)
3. `000_create_core_rls.sql`
4. `003_create_core_tags_tables.sql`
5. `004_create_core_tags_rls.sql`
6. `005_create_persons_table.sql`
7. `006_create_academy_students_table.sql`
8. `011_create_academy_related_tables.sql`
9. `012_create_academy_related_rls.sql`
10. `014_finalize_students_view.sql` ✅ **기존 코드 호환성을 위해 필수** (기술문서 정책 준수, 권장)
   또는 `013_create_students_view.sql` (간단한 버전)
11. `017_create_academy_classes_tables.sql` ✅ **반/강사 관리 테이블 생성** (요구사항 3.2)
12. `018_create_academy_classes_rls.sql` ✅ **반/강사 관리 RLS 정책**
13. `019_auto_update_class_current_count.sql` ✅ **current_count 자동 업데이트 트리거** (데이터 일관성 보장)
14. `015_dev_rls_bypass.sql` ⚠️ **개발 환경 전용** (프로덕션 배포 전 제거 필수)

---

## 오류 해결

### 오류: `function update_updated_at_column() does not exist`
**원인**: `000_create_common_functions.sql`을 먼저 실행하지 않음

**해결**: `000_create_common_functions.sql`을 가장 먼저 실행하세요.

### 오류: `relation "public.tenants" does not exist`
**원인**: `000_create_core_tables.sql`을 먼저 실행하지 않음

**해결**: `000_create_core_tables.sql`을 두 번째로 실행하세요.

### 오류: `relation "public.persons" does not exist`
**원인**: `005_create_persons_table.sql`을 먼저 실행하지 않음

**해결**: `005_create_persons_table.sql`을 먼저 실행하세요.

### 오류: `GET /rest/v1/students 404 (Not Found)`
**원인**: PostgREST가 `students` View를 인식하지 못함

**해결**: 
1. `013_create_students_view.sql`을 실행한 후
2. Supabase Dashboard > Settings > API > "Reload schema" 버튼을 클릭하거나
3. Supabase CLI를 사용하여 스키마를 다시 로드: `supabase db reset` (개발 환경)
4. 또는 몇 분 기다린 후 자동으로 스키마가 갱신될 수 있습니다.

