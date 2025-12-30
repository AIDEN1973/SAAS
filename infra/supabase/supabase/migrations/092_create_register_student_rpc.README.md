# P0-14: 학생 등록 트랜잭션 RPC 함수

## 목적

`executeRegister` 함수의 수동 롤백 방식을 제거하고 DB 레벨 트랜잭션으로 원자성을 보장합니다.

## 문제점 (Before)

```typescript
// ❌ 수동 롤백 방식의 문제점
// 1. persons 삽입
const { data: person } = await supabase.from('persons').insert(...);

// 2. academy_students 삽입 (실패 시)
const { error: studentError } = await supabase.from('academy_students').insert(...);

if (studentError) {
  // 3. persons 롤백 시도 (네트워크 오류 시 실패 가능)
  await supabase.from('persons').delete().eq('id', person.id);
  // ⚠️ 롤백 실패 시 고아 레코드 발생
}
```

**위험:**
- 네트워크 타임아웃/연결 끊김 시 롤백 실패
- persons 테이블에 고아 레코드 누적
- 데이터 정합성 손상

## 해결책 (After)

```sql
-- ✅ DB RPC 함수로 원자적 트랜잭션
CREATE OR REPLACE FUNCTION register_student(...)
RETURNS TABLE(...) AS $$
BEGIN
  -- 1. persons 삽입
  INSERT INTO persons (...) RETURNING id INTO v_person_id;

  -- 2. academy_students 삽입
  INSERT INTO academy_students (...);

  -- ✅ 자동 COMMIT (성공 시)
  RETURN QUERY SELECT v_person_id, TRUE, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- ✅ 자동 ROLLBACK (실패 시)
    RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 주요 개선 사항

### 1. 트랜잭션 원자성 보장
- DB 함수 내부는 **암묵적 트랜잭션** (BEGIN/COMMIT 자동)
- 예외 발생 시 **자동 ROLLBACK** (네트워크 오류 무관)

### 2. Zero-Trust 검증
```sql
-- tenant_id, name, phone, birth_date 필수 검증
IF p_tenant_id IS NULL OR p_name IS NULL OR ... THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, '필수값 누락'::TEXT;
  RETURN;
END IF;
```

### 3. 중복 체크 내장
```sql
-- P0-24: 이름 + 전화번호 + 생년월일 조합 중복 검증
IF EXISTS (
  SELECT 1 FROM academy_students s
  INNER JOIN persons p ON p.id = s.person_id
  WHERE s.tenant_id = p_tenant_id
    AND p.name = p_name
    AND p.phone = p_phone
    AND s.birth_date = p_birth_date
) THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, '중복 학생'::TEXT;
  RETURN;
END IF;
```

### 4. SECURITY DEFINER
- RLS 정책 우회 (함수 소유자 권한으로 실행)
- Edge Function 서비스 롤에서도 실행 가능

## TypeScript 호출 예시

```typescript
// Before (수동 롤백)
const { data: person } = await supabase.from('persons').insert(...).select().single();
const { error: studentError } = await supabase.from('academy_students').insert(...);
if (studentError) {
  await supabase.from('persons').delete().eq('id', person.id); // ⚠️ 실패 위험
}

// After (RPC 트랜잭션)
const { data, error: rpcError } = await context.supabase
  .rpc('register_student', {
    p_tenant_id: tenantId,
    p_name: name,
    p_phone: phone,
    p_birth_date: birthDate,
    // ... 기타 파라미터
  })
  .single();

if (!data.success) {
  console.error(data.error_message); // DB에서 반환된 오류
}
```

## 마이그레이션 적용

```bash
# Supabase CLI로 적용
supabase db push

# 또는 SQL 파일 직접 실행
psql -U postgres -d samdle -f 092_create_register_student_rpc.sql
```

## 테스트

```sql
-- 정상 케이스
SELECT * FROM register_student(
  'tenant-uuid'::UUID,
  '홍길동',
  '01012345678',
  '2010-01-01'::DATE
);
-- 결과: (person_id, true, null)

-- 중복 케이스
SELECT * FROM register_student(
  'tenant-uuid'::UUID,
  '홍길동',
  '01012345678',
  '2010-01-01'::DATE
);
-- 결과: (null, false, '중복 학생...')

-- 필수값 누락
SELECT * FROM register_student(
  NULL, '홍길동', '01012345678', '2010-01-01'::DATE
);
-- 결과: (null, false, 'tenant_id는 필수입니다')
```

## 관련 이슈

- **P0-14**: 트랜잭션 안전성 확보
- **P0-19**: 롤백 시 tenant 조건 포함 (RPC 내부에서 보장)
- **P0-24**: 중복 체크 (RPC 내부에서 수행)
- **P0-25**: L2 실행 함수 필수값 재검증 (RPC + TypeScript 이중 검증)
- **P0-34**: UUID 노출 금지 (TypeScript에서 maskPII 사용)

## 향후 확장

동일한 패턴으로 다른 L2 액션도 RPC 전환 권장:
- `update_student_rpc` (학생 정보 수정)
- `change_class_rpc` (반 변경)
- `discharge_student_rpc` (퇴원 처리)
