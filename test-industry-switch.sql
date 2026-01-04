-- Industry Type 전환 테스트 스크립트
-- 사이드바 메뉴 변경 확인용

-- 1. 현재 테넌트 정보 확인
SELECT
  id,
  name,
  industry_type,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- 2. 특정 테넌트의 업종 변경 (테넌트 ID를 실제 값으로 변경하세요)
-- ⚠️ 주의: 아래 쿼리는 주석을 해제하고 실제 tenant_id로 변경 후 실행하세요

-- Academy (학원) → Gym (헬스장) 전환
-- UPDATE tenants
-- SET industry_type = 'gym'
-- WHERE id = 'your-tenant-id-here';

-- Academy (학원) → Salon (미용실) 전환
-- UPDATE tenants
-- SET industry_type = 'salon'
-- WHERE id = 'your-tenant-id-here';

-- Academy (학원) → Nail Salon (네일샵) 전환
-- UPDATE tenants
-- SET industry_type = 'nail_salon'
-- WHERE id = 'your-tenant-id-here';

-- Academy (학원) → Real Estate (부동산) 전환
-- UPDATE tenants
-- SET industry_type = 'real_estate'
-- WHERE id = 'your-tenant-id-here';

-- 원래대로 되돌리기 (Academy)
-- UPDATE tenants
-- SET industry_type = 'academy'
-- WHERE id = 'your-tenant-id-here';

-- 3. 변경 후 확인
SELECT
  id,
  name,
  industry_type,
  updated_at
FROM tenants
ORDER BY updated_at DESC
LIMIT 5;

-- 4. 사이드바 메뉴 차이 요약
/*
업종별 사이드바 차이:

┌─────────────┬──────────────┬──────────────┬──────────────┐
│   Academy   │     Gym      │    Salon     │ Real Estate  │
├─────────────┼──────────────┼──────────────┼──────────────┤
│ 학생 관리   │ 회원 관리    │ 고객 관리    │ 고객 관리    │
│ 출결관리 ✓  │ 출석관리 ✓   │ 예약관리 ✓   │ 예약관리 ✓   │
│ 반 관리     │ 수업 관리    │ 서비스 관리  │ 매물 관리    │
│ 강사 관리   │ 트레이너 관리│스타일리스트  │ 에이전트 관리│
│ 수납관리 ✓  │ 수납관리 ✓   │ 수납관리 ✓   │ (수납 없음)  │
└─────────────┴──────────────┴──────────────┴──────────────┘

테스트 절차:
1. 위 UPDATE 쿼리 중 하나를 주석 해제하고 실행
2. 브라우저에서 앱 새로고침 (Ctrl+Shift+R)
3. 사이드바 메뉴 용어 변경 확인
4. 각 메뉴 클릭해서 페이지 제목도 변경되는지 확인
5. 테스트 완료 후 원래 업종으로 되돌리기
*/
