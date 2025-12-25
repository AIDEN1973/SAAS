# useClass Hook

## fetchClasses 반환 규약

**SSOT (Single Source of Truth)**: `fetchClasses`는 **항상 배열을 반환**합니다.

- 성공 시: `Promise<Class[]>` (빈 배열 가능)
- 에러 시: `throw new Error(...)` (예외 발생)
- `response.data`가 없거나 null인 경우: `[]` (빈 배열 반환)

**주의사항**:
- `fetchClasses` 반환값은 항상 배열이므로 `Array.isArray()` 체크는 선택적입니다.
- 하지만 방어적 프로그래밍을 위해 `Array.isArray()` 체크를 권장합니다.

