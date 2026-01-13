-- 출결 로그 파티션 대량 생성 (2026-2075년, 50년치)
-- [불변 규칙] 로그성 테이블이므로 파티셔닝 적용
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스가 적용되어야 합니다.
-- [전략] 미리 50년치 파티션을 생성하여 CRON Job 의존성 제거 및 운영 안정성 확보

-- ============================================================
-- 2026년 파티션
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2026
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2026_tenant_occurred
  ON public.attendance_logs_2026(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2026_student
  ON public.attendance_logs_2026(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2026_class
  ON public.attendance_logs_2026(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.attendance_logs_2026 IS '2026년 출결 로그 파티션';

-- ============================================================
-- 2027년 파티션
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2027
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2027_tenant_occurred
  ON public.attendance_logs_2027(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2027_student
  ON public.attendance_logs_2027(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2027_class
  ON public.attendance_logs_2027(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.attendance_logs_2027 IS '2027년 출결 로그 파티션';

-- ============================================================
-- 2028년 파티션
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2028
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2028_tenant_occurred
  ON public.attendance_logs_2028(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2028_student
  ON public.attendance_logs_2028(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2028_class
  ON public.attendance_logs_2028(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.attendance_logs_2028 IS '2028년 출결 로그 파티션';

-- ============================================================
-- 2029년 파티션
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2029
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2029_tenant_occurred
  ON public.attendance_logs_2029(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2029_student
  ON public.attendance_logs_2029(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2029_class
  ON public.attendance_logs_2029(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.attendance_logs_2029 IS '2029년 출결 로그 파티션';

-- ============================================================
-- 2030년 파티션
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2030
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2030_tenant_occurred
  ON public.attendance_logs_2030(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2030_student
  ON public.attendance_logs_2030(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2030_class
  ON public.attendance_logs_2030(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.attendance_logs_2030 IS '2030년 출결 로그 파티션';

-- ============================================================
-- 2031-2035년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2031 PARTITION OF public.attendance_logs FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2031_tenant_occurred ON public.attendance_logs_2031(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2031_student ON public.attendance_logs_2031(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2031_class ON public.attendance_logs_2031(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2032 PARTITION OF public.attendance_logs FOR VALUES FROM ('2032-01-01') TO ('2033-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2032_tenant_occurred ON public.attendance_logs_2032(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2032_student ON public.attendance_logs_2032(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2032_class ON public.attendance_logs_2032(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2033 PARTITION OF public.attendance_logs FOR VALUES FROM ('2033-01-01') TO ('2034-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2033_tenant_occurred ON public.attendance_logs_2033(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2033_student ON public.attendance_logs_2033(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2033_class ON public.attendance_logs_2033(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2034 PARTITION OF public.attendance_logs FOR VALUES FROM ('2034-01-01') TO ('2035-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2034_tenant_occurred ON public.attendance_logs_2034(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2034_student ON public.attendance_logs_2034(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2034_class ON public.attendance_logs_2034(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2035 PARTITION OF public.attendance_logs FOR VALUES FROM ('2035-01-01') TO ('2036-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2035_tenant_occurred ON public.attendance_logs_2035(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2035_student ON public.attendance_logs_2035(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2035_class ON public.attendance_logs_2035(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2036-2040년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2036 PARTITION OF public.attendance_logs FOR VALUES FROM ('2036-01-01') TO ('2037-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2036_tenant_occurred ON public.attendance_logs_2036(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2036_student ON public.attendance_logs_2036(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2036_class ON public.attendance_logs_2036(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2037 PARTITION OF public.attendance_logs FOR VALUES FROM ('2037-01-01') TO ('2038-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2037_tenant_occurred ON public.attendance_logs_2037(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2037_student ON public.attendance_logs_2037(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2037_class ON public.attendance_logs_2037(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2038 PARTITION OF public.attendance_logs FOR VALUES FROM ('2038-01-01') TO ('2039-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2038_tenant_occurred ON public.attendance_logs_2038(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2038_student ON public.attendance_logs_2038(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2038_class ON public.attendance_logs_2038(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2039 PARTITION OF public.attendance_logs FOR VALUES FROM ('2039-01-01') TO ('2040-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2039_tenant_occurred ON public.attendance_logs_2039(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2039_student ON public.attendance_logs_2039(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2039_class ON public.attendance_logs_2039(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2040 PARTITION OF public.attendance_logs FOR VALUES FROM ('2040-01-01') TO ('2041-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2040_tenant_occurred ON public.attendance_logs_2040(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2040_student ON public.attendance_logs_2040(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2040_class ON public.attendance_logs_2040(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2041-2045년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2041 PARTITION OF public.attendance_logs FOR VALUES FROM ('2041-01-01') TO ('2042-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2041_tenant_occurred ON public.attendance_logs_2041(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2041_student ON public.attendance_logs_2041(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2041_class ON public.attendance_logs_2041(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2042 PARTITION OF public.attendance_logs FOR VALUES FROM ('2042-01-01') TO ('2043-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2042_tenant_occurred ON public.attendance_logs_2042(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2042_student ON public.attendance_logs_2042(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2042_class ON public.attendance_logs_2042(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2043 PARTITION OF public.attendance_logs FOR VALUES FROM ('2043-01-01') TO ('2044-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2043_tenant_occurred ON public.attendance_logs_2043(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2043_student ON public.attendance_logs_2043(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2043_class ON public.attendance_logs_2043(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2044 PARTITION OF public.attendance_logs FOR VALUES FROM ('2044-01-01') TO ('2045-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2044_tenant_occurred ON public.attendance_logs_2044(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2044_student ON public.attendance_logs_2044(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2044_class ON public.attendance_logs_2044(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2045 PARTITION OF public.attendance_logs FOR VALUES FROM ('2045-01-01') TO ('2046-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2045_tenant_occurred ON public.attendance_logs_2045(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2045_student ON public.attendance_logs_2045(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2045_class ON public.attendance_logs_2045(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2046-2050년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2046 PARTITION OF public.attendance_logs FOR VALUES FROM ('2046-01-01') TO ('2047-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2046_tenant_occurred ON public.attendance_logs_2046(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2046_student ON public.attendance_logs_2046(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2046_class ON public.attendance_logs_2046(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2047 PARTITION OF public.attendance_logs FOR VALUES FROM ('2047-01-01') TO ('2048-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2047_tenant_occurred ON public.attendance_logs_2047(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2047_student ON public.attendance_logs_2047(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2047_class ON public.attendance_logs_2047(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2048 PARTITION OF public.attendance_logs FOR VALUES FROM ('2048-01-01') TO ('2049-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2048_tenant_occurred ON public.attendance_logs_2048(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2048_student ON public.attendance_logs_2048(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2048_class ON public.attendance_logs_2048(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2049 PARTITION OF public.attendance_logs FOR VALUES FROM ('2049-01-01') TO ('2050-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2049_tenant_occurred ON public.attendance_logs_2049(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2049_student ON public.attendance_logs_2049(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2049_class ON public.attendance_logs_2049(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2050 PARTITION OF public.attendance_logs FOR VALUES FROM ('2050-01-01') TO ('2051-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2050_tenant_occurred ON public.attendance_logs_2050(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2050_student ON public.attendance_logs_2050(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2050_class ON public.attendance_logs_2050(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2051-2055년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2051 PARTITION OF public.attendance_logs FOR VALUES FROM ('2051-01-01') TO ('2052-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2051_tenant_occurred ON public.attendance_logs_2051(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2051_student ON public.attendance_logs_2051(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2051_class ON public.attendance_logs_2051(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2052 PARTITION OF public.attendance_logs FOR VALUES FROM ('2052-01-01') TO ('2053-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2052_tenant_occurred ON public.attendance_logs_2052(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2052_student ON public.attendance_logs_2052(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2052_class ON public.attendance_logs_2052(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2053 PARTITION OF public.attendance_logs FOR VALUES FROM ('2053-01-01') TO ('2054-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2053_tenant_occurred ON public.attendance_logs_2053(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2053_student ON public.attendance_logs_2053(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2053_class ON public.attendance_logs_2053(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2054 PARTITION OF public.attendance_logs FOR VALUES FROM ('2054-01-01') TO ('2055-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2054_tenant_occurred ON public.attendance_logs_2054(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2054_student ON public.attendance_logs_2054(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2054_class ON public.attendance_logs_2054(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2055 PARTITION OF public.attendance_logs FOR VALUES FROM ('2055-01-01') TO ('2056-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2055_tenant_occurred ON public.attendance_logs_2055(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2055_student ON public.attendance_logs_2055(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2055_class ON public.attendance_logs_2055(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2056-2060년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2056 PARTITION OF public.attendance_logs FOR VALUES FROM ('2056-01-01') TO ('2057-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2056_tenant_occurred ON public.attendance_logs_2056(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2056_student ON public.attendance_logs_2056(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2056_class ON public.attendance_logs_2056(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2057 PARTITION OF public.attendance_logs FOR VALUES FROM ('2057-01-01') TO ('2058-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2057_tenant_occurred ON public.attendance_logs_2057(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2057_student ON public.attendance_logs_2057(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2057_class ON public.attendance_logs_2057(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2058 PARTITION OF public.attendance_logs FOR VALUES FROM ('2058-01-01') TO ('2059-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2058_tenant_occurred ON public.attendance_logs_2058(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2058_student ON public.attendance_logs_2058(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2058_class ON public.attendance_logs_2058(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2059 PARTITION OF public.attendance_logs FOR VALUES FROM ('2059-01-01') TO ('2060-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2059_tenant_occurred ON public.attendance_logs_2059(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2059_student ON public.attendance_logs_2059(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2059_class ON public.attendance_logs_2059(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2060 PARTITION OF public.attendance_logs FOR VALUES FROM ('2060-01-01') TO ('2061-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2060_tenant_occurred ON public.attendance_logs_2060(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2060_student ON public.attendance_logs_2060(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2060_class ON public.attendance_logs_2060(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2061-2065년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2061 PARTITION OF public.attendance_logs FOR VALUES FROM ('2061-01-01') TO ('2062-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2061_tenant_occurred ON public.attendance_logs_2061(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2061_student ON public.attendance_logs_2061(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2061_class ON public.attendance_logs_2061(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2062 PARTITION OF public.attendance_logs FOR VALUES FROM ('2062-01-01') TO ('2063-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2062_tenant_occurred ON public.attendance_logs_2062(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2062_student ON public.attendance_logs_2062(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2062_class ON public.attendance_logs_2062(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2063 PARTITION OF public.attendance_logs FOR VALUES FROM ('2063-01-01') TO ('2064-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2063_tenant_occurred ON public.attendance_logs_2063(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2063_student ON public.attendance_logs_2063(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2063_class ON public.attendance_logs_2063(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2064 PARTITION OF public.attendance_logs FOR VALUES FROM ('2064-01-01') TO ('2065-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2064_tenant_occurred ON public.attendance_logs_2064(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2064_student ON public.attendance_logs_2064(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2064_class ON public.attendance_logs_2064(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2065 PARTITION OF public.attendance_logs FOR VALUES FROM ('2065-01-01') TO ('2066-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2065_tenant_occurred ON public.attendance_logs_2065(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2065_student ON public.attendance_logs_2065(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2065_class ON public.attendance_logs_2065(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2066-2070년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2066 PARTITION OF public.attendance_logs FOR VALUES FROM ('2066-01-01') TO ('2067-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2066_tenant_occurred ON public.attendance_logs_2066(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2066_student ON public.attendance_logs_2066(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2066_class ON public.attendance_logs_2066(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2067 PARTITION OF public.attendance_logs FOR VALUES FROM ('2067-01-01') TO ('2068-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2067_tenant_occurred ON public.attendance_logs_2067(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2067_student ON public.attendance_logs_2067(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2067_class ON public.attendance_logs_2067(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2068 PARTITION OF public.attendance_logs FOR VALUES FROM ('2068-01-01') TO ('2069-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2068_tenant_occurred ON public.attendance_logs_2068(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2068_student ON public.attendance_logs_2068(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2068_class ON public.attendance_logs_2068(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2069 PARTITION OF public.attendance_logs FOR VALUES FROM ('2069-01-01') TO ('2070-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2069_tenant_occurred ON public.attendance_logs_2069(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2069_student ON public.attendance_logs_2069(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2069_class ON public.attendance_logs_2069(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2070 PARTITION OF public.attendance_logs FOR VALUES FROM ('2070-01-01') TO ('2071-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2070_tenant_occurred ON public.attendance_logs_2070(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2070_student ON public.attendance_logs_2070(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2070_class ON public.attendance_logs_2070(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 2071-2075년 파티션 (5년치)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs_2071 PARTITION OF public.attendance_logs FOR VALUES FROM ('2071-01-01') TO ('2072-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2071_tenant_occurred ON public.attendance_logs_2071(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2071_student ON public.attendance_logs_2071(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2071_class ON public.attendance_logs_2071(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2072 PARTITION OF public.attendance_logs FOR VALUES FROM ('2072-01-01') TO ('2073-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2072_tenant_occurred ON public.attendance_logs_2072(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2072_student ON public.attendance_logs_2072(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2072_class ON public.attendance_logs_2072(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2073 PARTITION OF public.attendance_logs FOR VALUES FROM ('2073-01-01') TO ('2074-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2073_tenant_occurred ON public.attendance_logs_2073(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2073_student ON public.attendance_logs_2073(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2073_class ON public.attendance_logs_2073(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2074 PARTITION OF public.attendance_logs FOR VALUES FROM ('2074-01-01') TO ('2075-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2074_tenant_occurred ON public.attendance_logs_2074(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2074_student ON public.attendance_logs_2074(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2074_class ON public.attendance_logs_2074(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_logs_2075 PARTITION OF public.attendance_logs FOR VALUES FROM ('2075-01-01') TO ('2076-01-01');
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2075_tenant_occurred ON public.attendance_logs_2075(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2075_student ON public.attendance_logs_2075(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2075_class ON public.attendance_logs_2075(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '출결 로그 파티션 생성 완료: 2026-2075년 (50년치)';
END $$;
