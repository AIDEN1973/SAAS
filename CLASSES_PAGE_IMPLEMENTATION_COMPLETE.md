# Classes Page (반 관리) - 구현 완료 보고서

**날짜**: 2026-01-04
**구현 범위**: 미구현 기능 및 이슈 모두 수정 완료

---

## 📋 구현 완료 항목

### ✅ **1. Schedule Conflict Detection (일정 충돌 감지)** ⭐ 중요

**구현 파일:**
- `infra/supabase/supabase/migrations/160_create_schedule_conflict_detection.sql`
- `packages/hooks/use-class/src/useClass.ts` (useCheckScheduleConflicts Hook)
- `apps/academy-admin/src/pages/ClassesPage.tsx` (handleCreateClass, handleUpdateClass)

**기능:**
- ✅ **Teacher duplicate time slot detection** (강사 중복 시간 배정 감지)
- ✅ **Room resource conflict detection** (강의실 중복 예약 감지)
- ✅ **Partial time overlap detection** (시간대 부분 겹침 감지)
- ✅ **User confirmation prompt** (충돌 시 사용자 확인)

**사용자 경험:**
```
[충돌 감지 시]
→ 팝업: "다음 충돌이 발견되었습니다:
   - 김철수 강사가 이미 수학 A반에 배정되어 있습니다 (14:00 ~ 15:30)
   - 강의실 '301호'가 이미 영어 B반에 예약되어 있습니다 (14:30 ~ 16:00)

   그래도 생성하시겠습니까?"
→ [확인] / [취소]
```

**RPC 함수:**
```sql
check_schedule_conflicts(
  p_tenant_id uuid,
  p_class_id uuid DEFAULT NULL,  -- 수정 시 자기 자신 제외
  p_day_of_week text,
  p_start_time time,
  p_end_time time,
  p_teacher_ids uuid[],
  p_room text
)
RETURNS jsonb {
  has_conflicts: boolean,
  conflict_count: integer,
  conflicts: [
    {
      type: 'teacher_conflict' | 'room_conflict',
      class_name: string,
      message: string,
      ...
    }
  ]
}
```

---

### ✅ **2. Automatic Color Assignment (자동 색상 할당)**

**구현 파일:**
- `infra/supabase/supabase/migrations/161_auto_assign_class_colors.sql`
- `infra/supabase/supabase/migrations/162_add_teacher_role_to_create_class_rpc.sql` (통합)

**기능:**
- ✅ 17가지 Material Design 색상 팔레트 사용
- ✅ 사용되지 않은 색상 우선 선택
- ✅ 모든 색상이 사용 중이면 가장 적게 사용된 색상 순환 선택
- ✅ 사용자가 수동으로 색상 변경 가능

**색상 팔레트:**
```javascript
['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
 '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
 '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e']
```

**로직:**
```sql
-- 트리거: academy_classes INSERT 시 자동 실행
CREATE TRIGGER trigger_auto_assign_class_color
  BEFORE INSERT ON academy_classes
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_class_color();

-- 함수: get_next_class_color(tenant_id) → 다음 사용 가능 색상 반환
```

---

### ✅ **3. Color Picker UI (색상 선택 UI)**

**구현 파일:**
- `apps/academy-admin/src/schemas/class.schema.ts`
- `apps/academy-admin/src/pages/ClassesPage.tsx` (CreateClassForm, EditClassModal)

**기능:**
- ✅ 반 생성/수정 시 색상 필드 추가
- ✅ Hex 색상 코드 검증 (#3b82f6 형식)
- ✅ 자동 할당 안내 메시지 표시

**UI:**
```typescript
{
  name: 'color',
  kind: 'text',
  ui: {
    label: '반 색상',
    placeholder: '#3b82f6',
    helperText: '자동 할당됩니다. 원하는 색상으로 변경 가능합니다.',
  },
  validation: {
    pattern: {
      value: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
      message: '올바른 색상 코드를 입력하세요 (예: #3b82f6)',
    },
  },
}
```

---

### ✅ **4. Time Range Validation (시간 범위 검증)**

**구현 파일:**
- `apps/academy-admin/src/pages/ClassesPage.tsx` (handleCreateClass, handleUpdateClass)
- `infra/supabase/supabase/migrations/160_create_schedule_conflict_detection.sql` (DB 레벨 검증)

**기능:**
- ✅ 클라이언트 측: start_time < end_time 검증
- ✅ 서버 측 (RPC): start_time >= end_time 시 예외 발생
- ✅ 사용자 친화적 오류 메시지

**검증 로직:**
```typescript
// 클라이언트 측
if (input.start_time >= input.end_time) {
  showAlert('시작 시간은 종료 시간보다 빨라야 합니다.', '입력 오류', 'error');
  return;
}

// 서버 측 (RPC)
IF p_start_time >= p_end_time THEN
  RAISE EXCEPTION '시작 시간은 종료 시간보다 빨라야 합니다.';
END IF;
```

---

### ✅ **5. Teacher Assignment in Edit Modal (수정 모달 강사 배정)**

**구현 파일:**
- `packages/industry/industry-academy/src/types.ts` (UpdateClassInput에 teacher_ids 추가)
- `packages/hooks/use-class/src/useClass.ts` (useUpdateClass 수정)
- `apps/academy-admin/src/pages/ClassesPage.tsx` (EditClassModal)

**기능:**
- ✅ UpdateClassInput에 teacher_ids 필드 추가
- ✅ 수정 시 기존 배정 제거 후 신규 배정
- ✅ useClassTeachers Hook으로 현재 배정 강사 조회
- ✅ 폼 defaultValues에 currentTeacherIds 설정

**로직:**
```typescript
// useUpdateClass Hook
if (teacher_ids !== undefined) {
  // 1. 기존 배정 모두 비활성화
  const existingAssignments = await apiClient.get('class_teachers', {
    filters: { class_id: classId, is_active: true },
  });

  for (const assignment of existingAssignments.data) {
    await apiClient.patch('class_teachers', assignment.id, {
      is_active: false,
      unassigned_at: toKST().format('YYYY-MM-DD'),
    });
  }

  // 2. 신규 배정
  for (const teacherId of teacher_ids) {
    await apiClient.post('class_teachers', {
      class_id: classId,
      teacher_id: teacherId,
      role: 'teacher',
      assigned_at: toKST().format('YYYY-MM-DD'),
      is_active: true,
    });
  }
}
```

---

### ✅ **6. Co-teacher (부담임) Support**

**구현 파일:**
- `infra/supabase/supabase/migrations/162_add_teacher_role_to_create_class_rpc.sql`

**기능:**
- ✅ create_class_with_teachers RPC에 p_teacher_roles 파라미터 추가
- ✅ 'teacher' (담임) / 'assistant' (부담임) 역할 구분
- ✅ DB 스키마: class_teachers.role 필드 ('teacher' | 'assistant')

**RPC 업데이트:**
```sql
CREATE OR REPLACE FUNCTION public.create_class_with_teachers(
  ...
  p_teacher_ids uuid[] DEFAULT NULL,
  p_teacher_roles text[] DEFAULT NULL,  -- NEW: 역할 배열
  ...
)
```

**향후 확장:**
- UI에서 강사별 역할 선택 기능 추가 가능
- 현재는 기본값 'teacher'로 모두 담임 배정

---

### ✅ **7. Class Statistics Display Fix (통계 표시 수정)**

**구현 파일:**
- `apps/academy-admin/src/pages/ClassesPage.tsx` (ClassCard 컴포넌트)

**기능:**
- ✅ capacity_rate만 표시 (정원률)
- ✅ attendance_rate, late_rate는 출결 데이터 구현 전까지 숨김
- ✅ capacity_rate > 0일 때만 표시

**변경 전:**
```typescript
{statistics && (
  <>
    <div>정원률: {statistics.capacity_rate.toFixed(1)}%</div>
    <div>출결률: {statistics.attendance_rate.toFixed(1)}%</div>  // 항상 0%
    <div>지각률: {statistics.late_rate.toFixed(1)}%</div>  // 항상 0%
  </>
)}
```

**변경 후:**
```typescript
{statistics && statistics.capacity_rate > 0 && (
  <div>정원률: {statistics.capacity_rate.toFixed(1)}%</div>
)}
{/* 출결률/지각률은 출결 데이터 구현 후 표시 */}
```

---

### ✅ **8. Current Count Auto-update (확인 완료)**

**기존 구현 확인:**
- `infra/supabase/supabase/migrations/019_auto_update_class_current_count.sql`

**기능:**
- ✅ student_classes INSERT/UPDATE/DELETE 시 자동으로 academy_classes.current_count 업데이트
- ✅ 트리거 기반 자동 동기화
- ✅ 일관성 보장

**이슈 없음 - 이미 정상 작동 중**

---

## 🗂️ 새로운 Migration 파일

1. **160_create_schedule_conflict_detection.sql**
   - check_schedule_conflicts RPC 함수
   - 강사/강의실 충돌 감지 로직

2. **161_auto_assign_class_colors.sql**
   - get_next_class_color 함수
   - auto_assign_class_color 트리거
   - 17색 팔레트 자동 할당

3. **162_add_teacher_role_to_create_class_rpc.sql**
   - create_class_with_teachers RPC 업데이트
   - p_color, p_teacher_roles 파라미터 추가
   - 부담임 역할 지원

---

## 🔧 수정된 파일

### Frontend (apps/academy-admin)
1. **src/pages/ClassesPage.tsx**
   - useCheckScheduleConflicts Hook 추가
   - handleCreateClass: 충돌 감지 + 시간 검증
   - handleUpdateClass: 충돌 감지 + 시간 검증
   - CreateClassForm: color 필드 추가
   - EditClassModal: teacher_ids, color 필드 추가

2. **src/schemas/class.schema.ts**
   - color 필드 추가 (Hex 색상 검증)

### Backend (packages)
3. **packages/hooks/use-class/src/useClass.ts**
   - useCheckScheduleConflicts Hook 추가
   - useCreateClass: color 파라미터 전달, RPC 통합 사용
   - useUpdateClass: teacher_ids 지원, 배정 업데이트 로직

4. **packages/industry/industry-academy/src/types.ts**
   - UpdateClassInput에 teacher_ids 필드 추가

---

## 📊 구현 진행 상황

| 항목 | 상태 | 비고 |
|------|------|------|
| Schedule Conflict Detection | ✅ 완료 | RPC + Hook + UI 통합 |
| Automatic Color Assignment | ✅ 완료 | 트리거 + 팔레트 |
| Color Picker UI | ✅ 완료 | 스키마 + 폼 |
| Time Range Validation | ✅ 완료 | 클라이언트 + 서버 |
| Teacher Assignment in Edit | ✅ 완료 | Hook 수정 + UI |
| Co-teacher Support | ✅ 완료 | RPC 확장 |
| Statistics Display Fix | ✅ 완료 | UI 수정 |
| Current Count Auto-update | ✅ 확인 | 기존 구현 정상 |

**전체 구현률: 100% (8/8 완료)**

---

## 🚀 배포 방법

### 1. Database Migrations 적용

```bash
cd infra/supabase
supabase db push --include-all
```

또는 Supabase Dashboard에서 수동 실행:
1. Dashboard → SQL Editor
2. 다음 파일들을 순서대로 실행:
   - `160_create_schedule_conflict_detection.sql`
   - `161_auto_assign_class_colors.sql`
   - `162_add_teacher_role_to_create_class_rpc.sql`

### 2. Frontend 빌드 및 배포

```bash
npm run build
# 또는
npm run dev:admin  # 개발 환경 테스트
```

---

## 🧪 테스트 시나리오

### Scenario 1: Schedule Conflict Detection
1. 반 생성: "수학 A반" - 월요일 14:00~15:30, 강사: 김철수, 강의실: 301호
2. 충돌 반 생성 시도: "영어 B반" - 월요일 14:30~16:00, 강사: 김철수
3. **예상 결과**: "김철수 강사가 이미 수학 A반에 배정되어 있습니다" 경고
4. 확인 후 생성 가능

### Scenario 2: Automatic Color Assignment
1. 첫 번째 반 생성 → 자동 색상: #ef4444 (빨강)
2. 두 번째 반 생성 → 자동 색상: #f97316 (주황)
3. 색상 수동 변경: #3b82f6 (파랑) → 정상 저장

### Scenario 3: Teacher Assignment in Edit
1. 반 생성: "수학 A반" - 강사: 김철수
2. 반 수정 → 강사 변경: 김철수 → 이영희
3. **예상 결과**: 김철수 배정 비활성화, 이영희 신규 배정

### Scenario 4: Time Validation
1. 반 생성: start_time=18:00, end_time=14:00
2. **예상 결과**: "시작 시간은 종료 시간보다 빨라야 합니다" 오류

---

## 📝 주요 개선 사항 요약

1. **안전성 향상**
   - 일정 충돌 실시간 감지 및 사용자 확인
   - 시간 범위 검증 (클라이언트 + 서버)

2. **사용자 경험 개선**
   - 자동 색상 할당으로 수동 작업 감소
   - 수정 모달에서 강사 배정 직접 관리
   - 의미 없는 통계(0%) 숨김

3. **데이터 무결성 보장**
   - 강사/강의실 중복 배정 방지
   - 시간 역전 방지
   - Current count 자동 동기화 (기존)

4. **확장성 확보**
   - 부담임 역할 지원 준비
   - 색상 팔레트 확장 가능
   - 충돌 감지 로직 확장 가능 (학생 충돌 등)

---

## 🔮 향후 개선 가능 항목

1. **UI 개선**
   - Color Picker 위젯 (현재: Hex 입력)
   - 강사별 역할 선택 UI (담임/부담임)
   - 충돌 상세 정보 모달

2. **기능 확장**
   - 학생 다중 반 충돌 감지
   - 추천 시간대 제안 (빈 시간대)
   - 반 복사 기능 (템플릿)

3. **통계 구현**
   - 출결 데이터 연동 시 attendance_rate, late_rate 활성화
   - 반별 성적 분석

---

## ✅ 검증 완료

- [x] TypeScript 타입 체크 통과
- [x] ESLint 검사 통과
- [x] 기존 기능 정상 작동 확인
- [x] 새로운 기능 로직 검증
- [x] DB Migration 스크립트 검증
- [x] RPC 함수 파라미터 검증
- [x] Hook API 일관성 확인

---

**구현 완료일**: 2026-01-04
**구현자**: Claude Sonnet 4.5
**문서 버전**: 1.0
