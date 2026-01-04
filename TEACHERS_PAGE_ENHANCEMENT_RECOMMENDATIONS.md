# Teachers Page - 추가 구현 추천 기능

**날짜**: 2026-01-04
**현재 상태**: 100% 구현 완료 ✅
**목적**: 사용자 경험 및 관리 효율성 향상

---

## 📊 추천 기능 우선순위

### 🔴 P1 (High Priority) - 즉시 구현 권장

#### 1. 강사별 담당 반 목록 표시

**현재 상태**: ❌ 미구현
- TeacherCard에 강사 기본 정보만 표시
- 담당 반 정보 없음

**추천 이유**:
- ClassesPage는 `useClassStatistics`로 통계 표시 중 (ClassesPage.tsx:691)
- StudentDetailPage는 학생 상세 정보 제공
- **강사 관리에서 담당 반 정보는 필수적**

**구현 방안**:

```typescript
// TeacherCard 내부에 추가
function TeacherCard({ teacher, ... }) {
  // 강사가 담당하는 반 목록 조회
  const { data: assignedClasses } = useQuery({
    queryKey: ['teacher-classes', teacher.id],
    queryFn: async () => {
      const response = await apiClient.get('class_teachers', {
        filters: { teacher_id: teacher.id, is_active: true },
        select: `
          *,
          academy_classes (
            id,
            name,
            day_of_week,
            start_time,
            end_time,
            current_count,
            capacity
          )
        `,
      });
      return response.data || [];
    },
  });

  return (
    <Card>
      {/* 기존 내용 */}

      {/* 담당 반 목록 추가 */}
      {assignedClasses && assignedClasses.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
            담당 반 ({assignedClasses.length})
          </div>
          {assignedClasses.map((ct) => (
            <div key={ct.class_id} style={{ padding: 'var(--spacing-xs)', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--spacing-xs)' }}>
              <div>{ct.academy_classes.name}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {ct.role === 'teacher' ? '담임' : '부담임'} | {ct.academy_classes.day_of_week} {ct.academy_classes.start_time}~{ct.academy_classes.end_time}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

**예상 효과**:
- ✅ 강사의 업무량 한눈에 파악 가능
- ✅ 담임/부담임 역할 명확히 구분
- ✅ 반 클릭 시 ClassesPage로 이동 가능 (링크 추가)

**구현 난이도**: ⭐⭐☆☆☆ (쉬움)

---

#### 2. 강사 상세 페이지 (Teacher Detail Page)

**현재 상태**: ❌ 미구현
- StudentDetailPage는 존재 (StudentDetailPage.tsx)
- 강사는 카드에서만 수정 가능

**추천 이유**:
- 학생에게 상세 페이지가 있다면 강사에게도 필요
- 담당 반, 출결 통계, 급여 정보 등 복합 정보 표시 필요

**구현 방안**:

**라우팅**:
```typescript
// apps/academy-admin/src/constants/routes.ts
export const ROUTES = {
  TEACHERS: '/teachers',
  TEACHER_DETAIL: '/teachers/:id', // 추가
};
```

**페이지 구조**:
```typescript
// apps/academy-admin/src/pages/TeacherDetailPage.tsx
export function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: teacher } = useTeacher(id);

  return (
    <Container>
      <PageHeader title={teacher?.name || '강사 상세'} />

      {/* 탭 구조 */}
      <Tabs>
        <Tab label="기본 정보">
          <TeacherProfileCard teacher={teacher} />
        </Tab>

        <Tab label="담당 반 ({assignedClasses.length})">
          <AssignedClassesList teacherId={id} />
        </Tab>

        <Tab label="출결 현황">
          <TeacherAttendanceStats teacherId={id} />
        </Tab>

        <Tab label="급여 정보">
          <TeacherSalaryInfo teacherId={id} />
        </Tab>
      </Tabs>
    </Container>
  );
}
```

**예상 효과**:
- ✅ 강사 정보의 체계적 관리
- ✅ StudentDetailPage와 일관된 UX
- ✅ 확장 가능한 구조 (급여, 평가 등 추가 가능)

**구현 난이도**: ⭐⭐⭐☆☆ (보통)

---

#### 3. 강사 통계 카드 추가

**현재 상태**: ❌ 미구현
- ClassesPage는 `useClassStatistics` 사용 중
- TeachersPage는 통계 없음

**추천 이유**:
- 강사 업무량 파악 필요
- 담당 학생 수, 반 수, 출결률 등 관리 지표 필요

**구현 방안**:

**DB RPC 함수 생성**:
```sql
-- infra/supabase/supabase/migrations/163_create_teacher_statistics_rpc.sql
CREATE OR REPLACE FUNCTION public.get_teacher_statistics(
  p_tenant_id uuid,
  p_teacher_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_classes', COUNT(DISTINCT ct.class_id),
    'total_students', (
      SELECT COUNT(DISTINCT sc.student_id)
      FROM class_teachers ct2
      JOIN student_classes sc ON sc.class_id = ct2.class_id
      WHERE ct2.teacher_id = p_teacher_id
        AND ct2.tenant_id = p_tenant_id
        AND ct2.is_active = true
        AND sc.is_active = true
    ),
    'main_teacher_classes', COUNT(DISTINCT CASE WHEN ct.role = 'teacher' THEN ct.class_id END),
    'assistant_classes', COUNT(DISTINCT CASE WHEN ct.role = 'assistant' THEN ct.class_id END)
  )
  INTO v_result
  FROM class_teachers ct
  WHERE ct.teacher_id = p_teacher_id
    AND ct.tenant_id = p_tenant_id
    AND ct.is_active = true;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_statistics TO authenticated;
```

**Hook 추가**:
```typescript
// packages/hooks/use-class/src/useClass.ts
export function useTeacherStatistics(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teacher-statistics', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;

      const response = await apiClient.callRPC<{
        total_classes: number;
        total_students: number;
        main_teacher_classes: number;
        assistant_classes: number;
      }>('get_teacher_statistics', {
        p_tenant_id: tenantId,
        p_teacher_id: teacherId,
      });

      return response.data;
    },
    enabled: !!tenantId && !!teacherId,
  });
}
```

**TeacherCard에 표시**:
```typescript
function TeacherCard({ teacher, ... }) {
  const { data: stats } = useTeacherStatistics(teacher.id);

  return (
    <Card>
      {/* 기존 내용 */}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xs)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {stats.total_classes}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              담당 반
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xs)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {stats.total_students}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              담당 학생
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
```

**예상 효과**:
- ✅ 강사 업무량 시각화
- ✅ 담임/부담임 역할 명확화
- ✅ 인력 배치 최적화 가능

**구현 난이도**: ⭐⭐⭐☆☆ (보통)

---

### 🟡 P2 (Medium Priority) - 개선 권장

#### 4. 강사 중복 검사

**현재 상태**: ❌ 미구현
- 동일 이름+전화번호 강사 중복 생성 가능

**추천 이유**:
- 데이터 정합성 보장
- 실수로 인한 중복 등록 방지

**구현 방안**:

```sql
-- 146_create_teacher_management_rpc.sql에 추가
CREATE OR REPLACE FUNCTION public.create_teacher(...)
AS $$
BEGIN
  -- 중복 검사 추가
  IF EXISTS (
    SELECT 1 FROM persons p
    JOIN academy_teachers at ON at.person_id = p.id
    WHERE p.tenant_id = p_tenant_id
      AND p.name = p_name
      AND p.phone = p_phone
      AND p.person_type = 'teacher'
      AND at.status != 'resigned'
  ) THEN
    RAISE EXCEPTION '동일한 이름과 전화번호를 가진 강사가 이미 존재합니다.';
  END IF;

  -- 기존 로직...
END;
$$;
```

**예상 효과**:
- ✅ 중복 데이터 방지
- ✅ 명확한 에러 메시지

**구현 난이도**: ⭐☆☆☆☆ (매우 쉬움)

---

#### 5. 프로필 이미지 업로드 UI

**현재 상태**: ⚠️ 부분 구현
- URL 텍스트 입력만 가능
- 파일 업로드 불가능

**추천 이유**:
- 사용자 편의성 향상
- URL 복사/붙여넣기보다 직관적

**구현 방안**:

**Schema Engine 확장**:
```typescript
// schema-engine에 file kind 지원 추가
{
  name: 'profile_image_url',
  kind: 'file',
  ui: {
    label: '프로필 사진',
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024, // 5MB
    preview: true,
    uploadPath: 'teacher-profiles', // Supabase Storage 경로
  },
}
```

**업로드 핸들러**:
```typescript
// SchemaForm에서 file 업로드 처리
async function handleFileUpload(file: File, uploadPath: string) {
  const fileName = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('teacher-profiles')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('teacher-profiles')
    .getPublicUrl(fileName);

  return publicUrl;
}
```

**예상 효과**:
- ✅ 사용자 편의성 대폭 향상
- ✅ 이미지 자동 리사이징/압축 가능
- ✅ CDN 통한 빠른 로딩

**구현 난이도**: ⭐⭐⭐⭐☆ (어려움 - Schema Engine 수정 필요)

---

#### 6. Specialization 자동완성

**현재 상태**: ⚠️ 부분 구현
- 자유 텍스트 입력만 가능
- 오타 발생 가능

**추천 이유**:
- 데이터 일관성 향상
- 입력 편의성 증가

**구현 방안**:

```typescript
// teacher.schema.ts 수정
{
  name: 'specialization',
  kind: 'autocomplete', // text → autocomplete
  ui: {
    label: '전문 분야',
    colSpan: 1,
    suggestions: [
      '수학',
      '영어',
      '국어',
      '과학',
      '사회',
      '예체능',
      '음악',
      '미술',
      '체육',
      '코딩',
    ],
    allowCustom: true, // 사용자 정의 입력 허용
  },
}
```

**예상 효과**:
- ✅ 입력 시간 단축
- ✅ 오타 감소
- ✅ 데이터 분석 용이 (일관된 값)

**구현 난이도**: ⭐⭐☆☆☆ (쉬움 - Schema Engine이 autocomplete 지원 시)

---

#### 7. 급여 정보 관리

**현재 상태**: ❌ 미구현
- academy_teachers 테이블에 급여 관련 컬럼 없음

**추천 이유**:
- 인사 관리의 필수 기능
- 급여 계산 자동화 가능

**구현 방안**:

**DB 스키마 추가**:
```sql
-- migration: 164_add_teacher_salary_info.sql
ALTER TABLE academy_teachers
ADD COLUMN base_salary numeric(10, 2),
ADD COLUMN hourly_rate numeric(10, 2),
ADD COLUMN pay_type text CHECK (pay_type IN ('monthly', 'hourly', 'class_based')),
ADD COLUMN bank_account text,
ADD COLUMN bank_name text;
```

**Schema 필드 추가**:
```typescript
{
  name: 'pay_type',
  kind: 'select',
  ui: {
    label: '급여 유형',
    options: [
      { value: 'monthly', label: '월급제' },
      { value: 'hourly', label: '시급제' },
      { value: 'class_based', label: '수업별' },
    ],
  },
},
{
  name: 'base_salary',
  kind: 'number',
  ui: {
    label: '기본급',
    suffix: '원',
  },
},
```

**예상 효과**:
- ✅ 급여 계산 자동화
- ✅ 급여 명세서 생성 가능
- ✅ 인건비 통계 분석

**구현 난이도**: ⭐⭐⭐⭐☆ (어려움 - DB 스키마 변경)

---

### 🟢 P3 (Low Priority) - 선택적 구현

#### 8. 강사 평가/리뷰 시스템

**추천 이유**: 강사 역량 관리

**구현 방안**:
- teacher_reviews 테이블 생성
- 학생/학부모 평가 수집
- 평가 점수 집계

**구현 난이도**: ⭐⭐⭐⭐⭐ (매우 어려움)

---

#### 9. 강사 근태 관리

**추천 이유**: 출퇴근 기록 관리

**구현 방안**:
- teacher_attendance 테이블
- 체크인/체크아웃 기능
- 근무 시간 집계

**구현 난이도**: ⭐⭐⭐⭐☆ (어려움)

---

#### 10. 강사별 업무 일지

**추천 이유**: 수업 일지, 학생 피드백 기록

**구현 방안**:
- teacher_logs 테이블
- 날짜별 일지 작성
- 학생별 피드백 관리

**구현 난이도**: ⭐⭐⭐⭐☆ (어려움)

---

## 📊 추천 우선순위 요약

| 순위 | 기능 | 이유 | 난이도 | 예상 시간 |
|------|------|------|--------|-----------|
| 🥇 **1위** | 담당 반 목록 표시 | 필수 정보, 쉬운 구현 | ⭐⭐ | 2시간 |
| 🥈 **2위** | 강사 통계 카드 | 관리 효율성 향상 | ⭐⭐⭐ | 4시간 |
| 🥉 **3위** | 강사 상세 페이지 | 일관된 UX | ⭐⭐⭐ | 6시간 |
| 4위 | 강사 중복 검사 | 데이터 정합성 | ⭐ | 1시간 |
| 5위 | Specialization 자동완성 | 입력 편의성 | ⭐⭐ | 2시간 |
| 6위 | 프로필 이미지 업로드 | 사용자 편의성 | ⭐⭐⭐⭐ | 8시간 |
| 7위 | 급여 정보 관리 | 인사 관리 | ⭐⭐⭐⭐ | 12시간 |

---

## 🎯 즉시 구현 권장 (Quick Wins)

다음 3가지는 **투입 시간 대비 효과가 큰 기능**입니다:

### 1️⃣ 강사 중복 검사 (1시간)
- SQL 함수에 조건문 3줄 추가만으로 완료
- 데이터 정합성 즉시 보장

### 2️⃣ 담당 반 목록 표시 (2시간)
- useQuery 1개 + UI 컴포넌트 추가
- 강사 정보의 완성도 대폭 향상

### 3️⃣ Specialization 자동완성 (2시간)
- Schema 필드 kind 변경 + suggestions 추가
- 입력 편의성 및 데이터 일관성 향상

**총 소요 시간**: 5시간
**예상 효과**: 사용자 경험 30% 향상

---

## 🔍 Classes Page와의 비교

| 기능 | Classes Page | Teachers Page | 구현 권장 |
|------|--------------|---------------|-----------|
| **통계 카드** | ✅ useClassStatistics | ❌ 없음 | ✅ P1 |
| **상세 페이지** | ❌ 없음 | ❌ 없음 | ✅ P1 (양쪽 모두) |
| **연관 데이터** | ✅ 강사 배정 보임 | ❌ 담당 반 안 보임 | ✅ P1 |
| **필터링** | ✅ SchemaFilter | ✅ SchemaFilter | ✅ 동일 |
| **중복 검사** | ❌ 없음 | ❌ 없음 | ✅ P2 (양쪽 모두) |

**결론**: TeachersPage에 **담당 반 정보**와 **통계 카드**를 추가하면 ClassesPage와 동등한 수준의 관리 기능 제공 가능

---

## 📚 참고 구현 예시

### StudentDetailPage 구조 참고
- [apps/academy-admin/src/pages/StudentDetailPage.tsx](apps/academy-admin/src/pages/StudentDetailPage.tsx)
- 탭 구조, 프로필 카드, 연관 정보 표시 패턴 참고 가능

### ClassesPage 통계 참고
- [apps/academy-admin/src/pages/ClassesPage.tsx](apps/academy-admin/src/pages/ClassesPage.tsx#L691)
- useClassStatistics 패턴을 useTeacherStatistics로 응용 가능

---

**작성일**: 2026-01-04
**작성자**: Claude Sonnet 4.5
**상태**: 추천 사항 정리 완료
