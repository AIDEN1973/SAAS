# useAttendance Hook

## fetchAttendanceLogs 반환 규약

**SSOT (Single Source of Truth)**: `fetchAttendanceLogs`는 **항상 배열을 반환**합니다.

- 성공 시: `Promise<AttendanceLog[]>` (빈 배열 가능)
- 에러 시: `throw new Error(...)` (예외 발생)
- `response.data`가 없거나 null인 경우: `[]` (빈 배열 반환)

**주의사항**:
- `fetchAttendanceLogs` 반환값은 항상 배열이므로 `Array.isArray()` 체크는 선택적입니다.
- 하지만 방어적 프로그래밍을 위해 `Array.isArray()` 체크를 권장합니다.

## AttendanceFilter.date_to 처리 규칙

**SSOT (Single Source of Truth)**: `date_to`는 **inclusive (포함)**로 처리됩니다.

- `date_from: '2024-01-01', date_to: '2024-01-07'` → 2024-01-01 00:00:00 ~ 2024-01-07 23:59:59 (양쪽 포함)
- 내부적으로 `occurred_at` 필드에 `{ gte: date_from, lte: date_to }` 조건으로 변환됨
- 서버/PostgREST의 `lte`는 해당 날짜의 23:59:59까지 포함

**주의사항**:
- `date_to`가 없으면 `date_from`부터 무기한 조회 가능하므로, 명시적으로 `date_to`를 지정하는 것을 권장합니다.
