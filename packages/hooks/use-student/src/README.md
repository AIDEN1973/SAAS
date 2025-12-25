# useStudent Hook

## fetchPersons 반환 규약

**SSOT (Single Source of Truth)**: `fetchPersons`는 **항상 배열을 반환**합니다.

- 성공 시: `Promise<Person[]>` (빈 배열 가능)
- 에러 시: `throw new Error(...)` (예외 발생)
- `response.data`가 없거나 null인 경우: `[]` (빈 배열 반환)

**주의사항**:
- `fetchPersons` 반환값은 항상 배열이므로 `Array.isArray()` 체크는 선택적입니다.
- 하지만 방어적 프로그래밍을 위해 `Array.isArray()` 체크를 권장합니다.

## fetchPersons.created_at 필터 규칙

**SSOT (Single Source of Truth)**: `created_at` 필터는 **ISO 8601 timestamp** 형식을 사용합니다.

- `created_at: { gte: '2024-01-01T00:00:00.000Z', lte: '2024-01-07T23:59:59.999Z' }`
- `gte`와 `lte` 모두 optional이며, 둘 다 제공하면 범위 조회, 하나만 제공하면 열린 구간 조회
- **권장**: 무기한 조회 방지를 위해 `gte`와 `lte`를 모두 명시

