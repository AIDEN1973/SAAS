-- 모든 감사/자동화 로그 파티션 50년 확장 (2033~2075)
-- [불변 규칙] 기존 파티션 테이블에 추가 파티션만 생성
-- [전략] 장기 법적 분쟁 대비 + 규제 변경 대응 + 운영 안정성 확보
-- [비용] 빈 파티션 = 메타데이터만 (약 2MB 추가, 무시할 수 있는 수준)

-- ============================================================
-- EXECUTION_AUDIT_RUNS 파티션 확장 (2033~2075, 43년 추가)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2033 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2033-01-01') TO ('2034-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2033_tenant_occurred ON public.execution_audit_runs_2033(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2033_operation ON public.execution_audit_runs_2033(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2033_status ON public.execution_audit_runs_2033(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2034 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2034-01-01') TO ('2035-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2034_tenant_occurred ON public.execution_audit_runs_2034(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2034_operation ON public.execution_audit_runs_2034(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2034_status ON public.execution_audit_runs_2034(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2035 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2035-01-01') TO ('2036-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2035_tenant_occurred ON public.execution_audit_runs_2035(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2035_operation ON public.execution_audit_runs_2035(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2035_status ON public.execution_audit_runs_2035(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2036 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2036-01-01') TO ('2037-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2036_tenant_occurred ON public.execution_audit_runs_2036(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2036_operation ON public.execution_audit_runs_2036(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2036_status ON public.execution_audit_runs_2036(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2037 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2037-01-01') TO ('2038-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2037_tenant_occurred ON public.execution_audit_runs_2037(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2037_operation ON public.execution_audit_runs_2037(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2037_status ON public.execution_audit_runs_2037(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2038 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2038-01-01') TO ('2039-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2038_tenant_occurred ON public.execution_audit_runs_2038(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2038_operation ON public.execution_audit_runs_2038(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2038_status ON public.execution_audit_runs_2038(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2039 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2039-01-01') TO ('2040-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2039_tenant_occurred ON public.execution_audit_runs_2039(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2039_operation ON public.execution_audit_runs_2039(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2039_status ON public.execution_audit_runs_2039(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2040 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2040-01-01') TO ('2041-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2040_tenant_occurred ON public.execution_audit_runs_2040(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2040_operation ON public.execution_audit_runs_2040(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2040_status ON public.execution_audit_runs_2040(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2041 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2041-01-01') TO ('2042-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2041_tenant_occurred ON public.execution_audit_runs_2041(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2041_operation ON public.execution_audit_runs_2041(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2041_status ON public.execution_audit_runs_2041(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2042 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2042-01-01') TO ('2043-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2042_tenant_occurred ON public.execution_audit_runs_2042(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2042_operation ON public.execution_audit_runs_2042(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2042_status ON public.execution_audit_runs_2042(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2043 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2043-01-01') TO ('2044-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2043_tenant_occurred ON public.execution_audit_runs_2043(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2043_operation ON public.execution_audit_runs_2043(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2043_status ON public.execution_audit_runs_2043(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2044 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2044-01-01') TO ('2045-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2044_tenant_occurred ON public.execution_audit_runs_2044(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2044_operation ON public.execution_audit_runs_2044(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2044_status ON public.execution_audit_runs_2044(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2045 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2045-01-01') TO ('2046-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2045_tenant_occurred ON public.execution_audit_runs_2045(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2045_operation ON public.execution_audit_runs_2045(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2045_status ON public.execution_audit_runs_2045(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2046 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2046-01-01') TO ('2047-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2046_tenant_occurred ON public.execution_audit_runs_2046(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2046_operation ON public.execution_audit_runs_2046(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2046_status ON public.execution_audit_runs_2046(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2047 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2047-01-01') TO ('2048-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2047_tenant_occurred ON public.execution_audit_runs_2047(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2047_operation ON public.execution_audit_runs_2047(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2047_status ON public.execution_audit_runs_2047(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2048 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2048-01-01') TO ('2049-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2048_tenant_occurred ON public.execution_audit_runs_2048(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2048_operation ON public.execution_audit_runs_2048(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2048_status ON public.execution_audit_runs_2048(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2049 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2049-01-01') TO ('2050-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2049_tenant_occurred ON public.execution_audit_runs_2049(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2049_operation ON public.execution_audit_runs_2049(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2049_status ON public.execution_audit_runs_2049(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2050 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2050-01-01') TO ('2051-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2050_tenant_occurred ON public.execution_audit_runs_2050(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2050_operation ON public.execution_audit_runs_2050(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2050_status ON public.execution_audit_runs_2050(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2051 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2051-01-01') TO ('2052-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2051_tenant_occurred ON public.execution_audit_runs_2051(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2051_operation ON public.execution_audit_runs_2051(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2051_status ON public.execution_audit_runs_2051(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2052 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2052-01-01') TO ('2053-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2052_tenant_occurred ON public.execution_audit_runs_2052(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2052_operation ON public.execution_audit_runs_2052(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2052_status ON public.execution_audit_runs_2052(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2053 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2053-01-01') TO ('2054-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2053_tenant_occurred ON public.execution_audit_runs_2053(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2053_operation ON public.execution_audit_runs_2053(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2053_status ON public.execution_audit_runs_2053(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2054 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2054-01-01') TO ('2055-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2054_tenant_occurred ON public.execution_audit_runs_2054(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2054_operation ON public.execution_audit_runs_2054(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2054_status ON public.execution_audit_runs_2054(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2055 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2055-01-01') TO ('2056-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2055_tenant_occurred ON public.execution_audit_runs_2055(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2055_operation ON public.execution_audit_runs_2055(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2055_status ON public.execution_audit_runs_2055(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2056 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2056-01-01') TO ('2057-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2056_tenant_occurred ON public.execution_audit_runs_2056(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2056_operation ON public.execution_audit_runs_2056(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2056_status ON public.execution_audit_runs_2056(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2057 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2057-01-01') TO ('2058-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2057_tenant_occurred ON public.execution_audit_runs_2057(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2057_operation ON public.execution_audit_runs_2057(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2057_status ON public.execution_audit_runs_2057(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2058 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2058-01-01') TO ('2059-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2058_tenant_occurred ON public.execution_audit_runs_2058(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2058_operation ON public.execution_audit_runs_2058(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2058_status ON public.execution_audit_runs_2058(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2059 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2059-01-01') TO ('2060-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2059_tenant_occurred ON public.execution_audit_runs_2059(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2059_operation ON public.execution_audit_runs_2059(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2059_status ON public.execution_audit_runs_2059(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2060 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2060-01-01') TO ('2061-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2060_tenant_occurred ON public.execution_audit_runs_2060(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2060_operation ON public.execution_audit_runs_2060(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2060_status ON public.execution_audit_runs_2060(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2061 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2061-01-01') TO ('2062-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2061_tenant_occurred ON public.execution_audit_runs_2061(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2061_operation ON public.execution_audit_runs_2061(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2061_status ON public.execution_audit_runs_2061(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2062 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2062-01-01') TO ('2063-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2062_tenant_occurred ON public.execution_audit_runs_2062(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2062_operation ON public.execution_audit_runs_2062(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2062_status ON public.execution_audit_runs_2062(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2063 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2063-01-01') TO ('2064-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2063_tenant_occurred ON public.execution_audit_runs_2063(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2063_operation ON public.execution_audit_runs_2063(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2063_status ON public.execution_audit_runs_2063(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2064 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2064-01-01') TO ('2065-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2064_tenant_occurred ON public.execution_audit_runs_2064(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2064_operation ON public.execution_audit_runs_2064(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2064_status ON public.execution_audit_runs_2064(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2065 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2065-01-01') TO ('2066-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2065_tenant_occurred ON public.execution_audit_runs_2065(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2065_operation ON public.execution_audit_runs_2065(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2065_status ON public.execution_audit_runs_2065(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2066 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2066-01-01') TO ('2067-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2066_tenant_occurred ON public.execution_audit_runs_2066(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2066_operation ON public.execution_audit_runs_2066(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2066_status ON public.execution_audit_runs_2066(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2067 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2067-01-01') TO ('2068-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2067_tenant_occurred ON public.execution_audit_runs_2067(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2067_operation ON public.execution_audit_runs_2067(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2067_status ON public.execution_audit_runs_2067(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2068 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2068-01-01') TO ('2069-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2068_tenant_occurred ON public.execution_audit_runs_2068(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2068_operation ON public.execution_audit_runs_2068(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2068_status ON public.execution_audit_runs_2068(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2069 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2069-01-01') TO ('2070-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2069_tenant_occurred ON public.execution_audit_runs_2069(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2069_operation ON public.execution_audit_runs_2069(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2069_status ON public.execution_audit_runs_2069(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2070 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2070-01-01') TO ('2071-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2070_tenant_occurred ON public.execution_audit_runs_2070(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2070_operation ON public.execution_audit_runs_2070(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2070_status ON public.execution_audit_runs_2070(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2071 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2071-01-01') TO ('2072-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2071_tenant_occurred ON public.execution_audit_runs_2071(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2071_operation ON public.execution_audit_runs_2071(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2071_status ON public.execution_audit_runs_2071(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2072 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2072-01-01') TO ('2073-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2072_tenant_occurred ON public.execution_audit_runs_2072(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2072_operation ON public.execution_audit_runs_2072(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2072_status ON public.execution_audit_runs_2072(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2073 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2073-01-01') TO ('2074-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2073_tenant_occurred ON public.execution_audit_runs_2073(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2073_operation ON public.execution_audit_runs_2073(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2073_status ON public.execution_audit_runs_2073(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2074 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2074-01-01') TO ('2075-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2074_tenant_occurred ON public.execution_audit_runs_2074(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2074_operation ON public.execution_audit_runs_2074(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2074_status ON public.execution_audit_runs_2074(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2075 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2075-01-01') TO ('2076-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2075_tenant_occurred ON public.execution_audit_runs_2075(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2075_operation ON public.execution_audit_runs_2075(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2075_status ON public.execution_audit_runs_2075(tenant_id, status, occurred_at DESC);

COMMENT ON TABLE public.execution_audit_runs IS 'execution_audit_runs 테이블 (파티션 확장: 2025-2075, 51년치)';

-- ============================================================
-- EXECUTION_AUDIT_STEPS 파티션 확장 (2033~2075, 43년 추가)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2033 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2033-01-01') TO ('2034-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2033_tenant_occurred ON public.execution_audit_steps_2033(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2033_run ON public.execution_audit_steps_2033(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2033_status ON public.execution_audit_steps_2033(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2034 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2034-01-01') TO ('2035-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2034_tenant_occurred ON public.execution_audit_steps_2034(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2034_run ON public.execution_audit_steps_2034(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2034_status ON public.execution_audit_steps_2034(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2035 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2035-01-01') TO ('2036-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2035_tenant_occurred ON public.execution_audit_steps_2035(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2035_run ON public.execution_audit_steps_2035(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2035_status ON public.execution_audit_steps_2035(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2036 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2036-01-01') TO ('2037-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2036_tenant_occurred ON public.execution_audit_steps_2036(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2036_run ON public.execution_audit_steps_2036(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2036_status ON public.execution_audit_steps_2036(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2037 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2037-01-01') TO ('2038-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2037_tenant_occurred ON public.execution_audit_steps_2037(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2037_run ON public.execution_audit_steps_2037(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2037_status ON public.execution_audit_steps_2037(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2038 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2038-01-01') TO ('2039-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2038_tenant_occurred ON public.execution_audit_steps_2038(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2038_run ON public.execution_audit_steps_2038(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2038_status ON public.execution_audit_steps_2038(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2039 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2039-01-01') TO ('2040-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2039_tenant_occurred ON public.execution_audit_steps_2039(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2039_run ON public.execution_audit_steps_2039(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2039_status ON public.execution_audit_steps_2039(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2040 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2040-01-01') TO ('2041-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2040_tenant_occurred ON public.execution_audit_steps_2040(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2040_run ON public.execution_audit_steps_2040(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2040_status ON public.execution_audit_steps_2040(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2041 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2041-01-01') TO ('2042-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2041_tenant_occurred ON public.execution_audit_steps_2041(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2041_run ON public.execution_audit_steps_2041(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2041_status ON public.execution_audit_steps_2041(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2042 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2042-01-01') TO ('2043-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2042_tenant_occurred ON public.execution_audit_steps_2042(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2042_run ON public.execution_audit_steps_2042(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2042_status ON public.execution_audit_steps_2042(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2043 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2043-01-01') TO ('2044-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2043_tenant_occurred ON public.execution_audit_steps_2043(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2043_run ON public.execution_audit_steps_2043(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2043_status ON public.execution_audit_steps_2043(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2044 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2044-01-01') TO ('2045-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2044_tenant_occurred ON public.execution_audit_steps_2044(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2044_run ON public.execution_audit_steps_2044(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2044_status ON public.execution_audit_steps_2044(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2045 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2045-01-01') TO ('2046-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2045_tenant_occurred ON public.execution_audit_steps_2045(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2045_run ON public.execution_audit_steps_2045(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2045_status ON public.execution_audit_steps_2045(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2046 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2046-01-01') TO ('2047-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2046_tenant_occurred ON public.execution_audit_steps_2046(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2046_run ON public.execution_audit_steps_2046(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2046_status ON public.execution_audit_steps_2046(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2047 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2047-01-01') TO ('2048-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2047_tenant_occurred ON public.execution_audit_steps_2047(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2047_run ON public.execution_audit_steps_2047(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2047_status ON public.execution_audit_steps_2047(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2048 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2048-01-01') TO ('2049-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2048_tenant_occurred ON public.execution_audit_steps_2048(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2048_run ON public.execution_audit_steps_2048(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2048_status ON public.execution_audit_steps_2048(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2049 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2049-01-01') TO ('2050-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2049_tenant_occurred ON public.execution_audit_steps_2049(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2049_run ON public.execution_audit_steps_2049(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2049_status ON public.execution_audit_steps_2049(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2050 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2050-01-01') TO ('2051-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2050_tenant_occurred ON public.execution_audit_steps_2050(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2050_run ON public.execution_audit_steps_2050(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2050_status ON public.execution_audit_steps_2050(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2051 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2051-01-01') TO ('2052-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2051_tenant_occurred ON public.execution_audit_steps_2051(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2051_run ON public.execution_audit_steps_2051(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2051_status ON public.execution_audit_steps_2051(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2052 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2052-01-01') TO ('2053-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2052_tenant_occurred ON public.execution_audit_steps_2052(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2052_run ON public.execution_audit_steps_2052(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2052_status ON public.execution_audit_steps_2052(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2053 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2053-01-01') TO ('2054-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2053_tenant_occurred ON public.execution_audit_steps_2053(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2053_run ON public.execution_audit_steps_2053(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2053_status ON public.execution_audit_steps_2053(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2054 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2054-01-01') TO ('2055-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2054_tenant_occurred ON public.execution_audit_steps_2054(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2054_run ON public.execution_audit_steps_2054(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2054_status ON public.execution_audit_steps_2054(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2055 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2055-01-01') TO ('2056-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2055_tenant_occurred ON public.execution_audit_steps_2055(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2055_run ON public.execution_audit_steps_2055(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2055_status ON public.execution_audit_steps_2055(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2056 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2056-01-01') TO ('2057-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2056_tenant_occurred ON public.execution_audit_steps_2056(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2056_run ON public.execution_audit_steps_2056(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2056_status ON public.execution_audit_steps_2056(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2057 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2057-01-01') TO ('2058-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2057_tenant_occurred ON public.execution_audit_steps_2057(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2057_run ON public.execution_audit_steps_2057(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2057_status ON public.execution_audit_steps_2057(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2058 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2058-01-01') TO ('2059-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2058_tenant_occurred ON public.execution_audit_steps_2058(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2058_run ON public.execution_audit_steps_2058(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2058_status ON public.execution_audit_steps_2058(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2059 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2059-01-01') TO ('2060-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2059_tenant_occurred ON public.execution_audit_steps_2059(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2059_run ON public.execution_audit_steps_2059(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2059_status ON public.execution_audit_steps_2059(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2060 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2060-01-01') TO ('2061-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2060_tenant_occurred ON public.execution_audit_steps_2060(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2060_run ON public.execution_audit_steps_2060(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2060_status ON public.execution_audit_steps_2060(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2061 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2061-01-01') TO ('2062-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2061_tenant_occurred ON public.execution_audit_steps_2061(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2061_run ON public.execution_audit_steps_2061(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2061_status ON public.execution_audit_steps_2061(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2062 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2062-01-01') TO ('2063-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2062_tenant_occurred ON public.execution_audit_steps_2062(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2062_run ON public.execution_audit_steps_2062(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2062_status ON public.execution_audit_steps_2062(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2063 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2063-01-01') TO ('2064-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2063_tenant_occurred ON public.execution_audit_steps_2063(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2063_run ON public.execution_audit_steps_2063(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2063_status ON public.execution_audit_steps_2063(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2064 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2064-01-01') TO ('2065-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2064_tenant_occurred ON public.execution_audit_steps_2064(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2064_run ON public.execution_audit_steps_2064(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2064_status ON public.execution_audit_steps_2064(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2065 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2065-01-01') TO ('2066-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2065_tenant_occurred ON public.execution_audit_steps_2065(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2065_run ON public.execution_audit_steps_2065(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2065_status ON public.execution_audit_steps_2065(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2066 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2066-01-01') TO ('2067-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2066_tenant_occurred ON public.execution_audit_steps_2066(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2066_run ON public.execution_audit_steps_2066(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2066_status ON public.execution_audit_steps_2066(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2067 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2067-01-01') TO ('2068-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2067_tenant_occurred ON public.execution_audit_steps_2067(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2067_run ON public.execution_audit_steps_2067(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2067_status ON public.execution_audit_steps_2067(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2068 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2068-01-01') TO ('2069-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2068_tenant_occurred ON public.execution_audit_steps_2068(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2068_run ON public.execution_audit_steps_2068(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2068_status ON public.execution_audit_steps_2068(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2069 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2069-01-01') TO ('2070-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2069_tenant_occurred ON public.execution_audit_steps_2069(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2069_run ON public.execution_audit_steps_2069(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2069_status ON public.execution_audit_steps_2069(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2070 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2070-01-01') TO ('2071-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2070_tenant_occurred ON public.execution_audit_steps_2070(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2070_run ON public.execution_audit_steps_2070(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2070_status ON public.execution_audit_steps_2070(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2071 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2071-01-01') TO ('2072-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2071_tenant_occurred ON public.execution_audit_steps_2071(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2071_run ON public.execution_audit_steps_2071(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2071_status ON public.execution_audit_steps_2071(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2072 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2072-01-01') TO ('2073-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2072_tenant_occurred ON public.execution_audit_steps_2072(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2072_run ON public.execution_audit_steps_2072(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2072_status ON public.execution_audit_steps_2072(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2073 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2073-01-01') TO ('2074-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2073_tenant_occurred ON public.execution_audit_steps_2073(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2073_run ON public.execution_audit_steps_2073(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2073_status ON public.execution_audit_steps_2073(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2074 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2074-01-01') TO ('2075-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2074_tenant_occurred ON public.execution_audit_steps_2074(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2074_run ON public.execution_audit_steps_2074(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2074_status ON public.execution_audit_steps_2074(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2075 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2075-01-01') TO ('2076-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2075_tenant_occurred ON public.execution_audit_steps_2075(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2075_run ON public.execution_audit_steps_2075(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2075_status ON public.execution_audit_steps_2075(tenant_id, status, occurred_at DESC);

COMMENT ON TABLE public.execution_audit_steps IS 'execution_audit_steps 테이블 (파티션 확장: 2025-2075, 51년치)';

-- ============================================================
-- AUTOMATION_ACTIONS 파티션 확장 (2033~2075, 43년 추가)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_actions_2033 PARTITION OF public.automation_actions FOR VALUES FROM ('2033-01-01') TO ('2034-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2033_tenant_executed ON public.automation_actions_2033(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2033_task ON public.automation_actions_2033(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2034 PARTITION OF public.automation_actions FOR VALUES FROM ('2034-01-01') TO ('2035-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2034_tenant_executed ON public.automation_actions_2034(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2034_task ON public.automation_actions_2034(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2035 PARTITION OF public.automation_actions FOR VALUES FROM ('2035-01-01') TO ('2036-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2035_tenant_executed ON public.automation_actions_2035(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2035_task ON public.automation_actions_2035(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2036 PARTITION OF public.automation_actions FOR VALUES FROM ('2036-01-01') TO ('2037-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2036_tenant_executed ON public.automation_actions_2036(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2036_task ON public.automation_actions_2036(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2037 PARTITION OF public.automation_actions FOR VALUES FROM ('2037-01-01') TO ('2038-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2037_tenant_executed ON public.automation_actions_2037(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2037_task ON public.automation_actions_2037(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2038 PARTITION OF public.automation_actions FOR VALUES FROM ('2038-01-01') TO ('2039-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2038_tenant_executed ON public.automation_actions_2038(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2038_task ON public.automation_actions_2038(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2039 PARTITION OF public.automation_actions FOR VALUES FROM ('2039-01-01') TO ('2040-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2039_tenant_executed ON public.automation_actions_2039(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2039_task ON public.automation_actions_2039(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2040 PARTITION OF public.automation_actions FOR VALUES FROM ('2040-01-01') TO ('2041-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2040_tenant_executed ON public.automation_actions_2040(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2040_task ON public.automation_actions_2040(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2041 PARTITION OF public.automation_actions FOR VALUES FROM ('2041-01-01') TO ('2042-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2041_tenant_executed ON public.automation_actions_2041(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2041_task ON public.automation_actions_2041(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2042 PARTITION OF public.automation_actions FOR VALUES FROM ('2042-01-01') TO ('2043-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2042_tenant_executed ON public.automation_actions_2042(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2042_task ON public.automation_actions_2042(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2043 PARTITION OF public.automation_actions FOR VALUES FROM ('2043-01-01') TO ('2044-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2043_tenant_executed ON public.automation_actions_2043(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2043_task ON public.automation_actions_2043(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2044 PARTITION OF public.automation_actions FOR VALUES FROM ('2044-01-01') TO ('2045-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2044_tenant_executed ON public.automation_actions_2044(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2044_task ON public.automation_actions_2044(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2045 PARTITION OF public.automation_actions FOR VALUES FROM ('2045-01-01') TO ('2046-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2045_tenant_executed ON public.automation_actions_2045(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2045_task ON public.automation_actions_2045(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2046 PARTITION OF public.automation_actions FOR VALUES FROM ('2046-01-01') TO ('2047-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2046_tenant_executed ON public.automation_actions_2046(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2046_task ON public.automation_actions_2046(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2047 PARTITION OF public.automation_actions FOR VALUES FROM ('2047-01-01') TO ('2048-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2047_tenant_executed ON public.automation_actions_2047(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2047_task ON public.automation_actions_2047(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2048 PARTITION OF public.automation_actions FOR VALUES FROM ('2048-01-01') TO ('2049-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2048_tenant_executed ON public.automation_actions_2048(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2048_task ON public.automation_actions_2048(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2049 PARTITION OF public.automation_actions FOR VALUES FROM ('2049-01-01') TO ('2050-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2049_tenant_executed ON public.automation_actions_2049(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2049_task ON public.automation_actions_2049(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2050 PARTITION OF public.automation_actions FOR VALUES FROM ('2050-01-01') TO ('2051-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2050_tenant_executed ON public.automation_actions_2050(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2050_task ON public.automation_actions_2050(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2051 PARTITION OF public.automation_actions FOR VALUES FROM ('2051-01-01') TO ('2052-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2051_tenant_executed ON public.automation_actions_2051(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2051_task ON public.automation_actions_2051(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2052 PARTITION OF public.automation_actions FOR VALUES FROM ('2052-01-01') TO ('2053-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2052_tenant_executed ON public.automation_actions_2052(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2052_task ON public.automation_actions_2052(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2053 PARTITION OF public.automation_actions FOR VALUES FROM ('2053-01-01') TO ('2054-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2053_tenant_executed ON public.automation_actions_2053(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2053_task ON public.automation_actions_2053(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2054 PARTITION OF public.automation_actions FOR VALUES FROM ('2054-01-01') TO ('2055-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2054_tenant_executed ON public.automation_actions_2054(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2054_task ON public.automation_actions_2054(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2055 PARTITION OF public.automation_actions FOR VALUES FROM ('2055-01-01') TO ('2056-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2055_tenant_executed ON public.automation_actions_2055(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2055_task ON public.automation_actions_2055(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2056 PARTITION OF public.automation_actions FOR VALUES FROM ('2056-01-01') TO ('2057-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2056_tenant_executed ON public.automation_actions_2056(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2056_task ON public.automation_actions_2056(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2057 PARTITION OF public.automation_actions FOR VALUES FROM ('2057-01-01') TO ('2058-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2057_tenant_executed ON public.automation_actions_2057(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2057_task ON public.automation_actions_2057(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2058 PARTITION OF public.automation_actions FOR VALUES FROM ('2058-01-01') TO ('2059-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2058_tenant_executed ON public.automation_actions_2058(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2058_task ON public.automation_actions_2058(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2059 PARTITION OF public.automation_actions FOR VALUES FROM ('2059-01-01') TO ('2060-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2059_tenant_executed ON public.automation_actions_2059(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2059_task ON public.automation_actions_2059(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2060 PARTITION OF public.automation_actions FOR VALUES FROM ('2060-01-01') TO ('2061-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2060_tenant_executed ON public.automation_actions_2060(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2060_task ON public.automation_actions_2060(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2061 PARTITION OF public.automation_actions FOR VALUES FROM ('2061-01-01') TO ('2062-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2061_tenant_executed ON public.automation_actions_2061(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2061_task ON public.automation_actions_2061(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2062 PARTITION OF public.automation_actions FOR VALUES FROM ('2062-01-01') TO ('2063-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2062_tenant_executed ON public.automation_actions_2062(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2062_task ON public.automation_actions_2062(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2063 PARTITION OF public.automation_actions FOR VALUES FROM ('2063-01-01') TO ('2064-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2063_tenant_executed ON public.automation_actions_2063(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2063_task ON public.automation_actions_2063(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2064 PARTITION OF public.automation_actions FOR VALUES FROM ('2064-01-01') TO ('2065-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2064_tenant_executed ON public.automation_actions_2064(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2064_task ON public.automation_actions_2064(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2065 PARTITION OF public.automation_actions FOR VALUES FROM ('2065-01-01') TO ('2066-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2065_tenant_executed ON public.automation_actions_2065(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2065_task ON public.automation_actions_2065(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2066 PARTITION OF public.automation_actions FOR VALUES FROM ('2066-01-01') TO ('2067-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2066_tenant_executed ON public.automation_actions_2066(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2066_task ON public.automation_actions_2066(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2067 PARTITION OF public.automation_actions FOR VALUES FROM ('2067-01-01') TO ('2068-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2067_tenant_executed ON public.automation_actions_2067(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2067_task ON public.automation_actions_2067(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2068 PARTITION OF public.automation_actions FOR VALUES FROM ('2068-01-01') TO ('2069-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2068_tenant_executed ON public.automation_actions_2068(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2068_task ON public.automation_actions_2068(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2069 PARTITION OF public.automation_actions FOR VALUES FROM ('2069-01-01') TO ('2070-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2069_tenant_executed ON public.automation_actions_2069(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2069_task ON public.automation_actions_2069(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2070 PARTITION OF public.automation_actions FOR VALUES FROM ('2070-01-01') TO ('2071-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2070_tenant_executed ON public.automation_actions_2070(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2070_task ON public.automation_actions_2070(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2071 PARTITION OF public.automation_actions FOR VALUES FROM ('2071-01-01') TO ('2072-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2071_tenant_executed ON public.automation_actions_2071(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2071_task ON public.automation_actions_2071(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2072 PARTITION OF public.automation_actions FOR VALUES FROM ('2072-01-01') TO ('2073-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2072_tenant_executed ON public.automation_actions_2072(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2072_task ON public.automation_actions_2072(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2073 PARTITION OF public.automation_actions FOR VALUES FROM ('2073-01-01') TO ('2074-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2073_tenant_executed ON public.automation_actions_2073(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2073_task ON public.automation_actions_2073(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2074 PARTITION OF public.automation_actions FOR VALUES FROM ('2074-01-01') TO ('2075-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2074_tenant_executed ON public.automation_actions_2074(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2074_task ON public.automation_actions_2074(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2075 PARTITION OF public.automation_actions FOR VALUES FROM ('2075-01-01') TO ('2076-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2075_tenant_executed ON public.automation_actions_2075(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2075_task ON public.automation_actions_2075(task_id);

COMMENT ON TABLE public.automation_actions IS 'automation_actions 테이블 (파티션 확장: 2025-2075, 51년치)';

DO $$
BEGIN
  RAISE NOTICE '=== 파티션 50년 확장 완료 ===';
  RAISE NOTICE 'execution_audit_runs: 2025-2075 (51년치)';
  RAISE NOTICE 'execution_audit_steps: 2025-2075 (51년치)';
  RAISE NOTICE 'automation_actions: 2025-2075 (51년치)';
  RAISE NOTICE '비용: 빈 파티션 약 2MB 추가 (무시할 수 있는 수준)';
  RAISE NOTICE '장점: 2075년까지 파티션 관리 불필요';
END $$;
