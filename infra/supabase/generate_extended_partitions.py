#!/usr/bin/env python3
"""
50년치 파티션 확장 SQL 생성 스크립트
execution_audit_runs, execution_audit_steps, automation_actions를
2033~2075년까지 확장
"""

# 테이블 설정
TABLES = {
    'execution_audit_runs': {
        'time_column': 'occurred_at',
        'indexes': [
            ('tenant_occurred', 'tenant_id, {time_column} DESC'),
            ('operation', 'tenant_id, operation_type, {time_column} DESC'),
            ('status', 'tenant_id, status, {time_column} DESC'),
        ]
    },
    'execution_audit_steps': {
        'time_column': 'occurred_at',
        'indexes': [
            ('tenant_occurred', 'tenant_id, {time_column} DESC'),
            ('run', 'tenant_id, run_id'),
            ('status', 'tenant_id, status, {time_column} DESC'),
        ]
    },
    'automation_actions': {
        'time_column': 'executed_at',
        'indexes': [
            ('tenant_executed', 'tenant_id, {time_column} DESC'),
            ('task', 'task_id'),
        ]
    }
}

START_YEAR = 2033
END_YEAR = 2075

sql_lines = [
    "-- 모든 감사/자동화 로그 파티션 50년 확장 (2033~2075)",
    "-- [불변 규칙] 기존 파티션 테이블에 추가 파티션만 생성",
    "-- [전략] 장기 법적 분쟁 대비 + 규제 변경 대응 + 운영 안정성 확보",
    "-- [비용] 빈 파티션 = 메타데이터만 (약 2MB 추가, 무시할 수 있는 수준)",
    ""
]

for table_name, config in TABLES.items():
    time_column = config['time_column']

    sql_lines.append(f"-- ============================================================")
    sql_lines.append(f"-- {table_name.upper()} 파티션 확장 (2033~2075, 43년 추가)")
    sql_lines.append(f"-- ============================================================")
    sql_lines.append("")

    for year in range(START_YEAR, END_YEAR + 1):
        next_year = year + 1
        partition_name = f"{table_name}_{year}"

        # 파티션 생성
        sql_lines.append(
            f"CREATE TABLE IF NOT EXISTS public.{partition_name} "
            f"PARTITION OF public.{table_name} "
            f"FOR VALUES FROM ('{year}-01-01') TO ('{next_year}-01-01');"
        )

        # 인덱스 생성
        for idx_suffix, idx_columns in config['indexes']:
            idx_name = f"idx_{partition_name}_{idx_suffix}"
            idx_cols = idx_columns.format(time_column=time_column)
            sql_lines.append(
                f"CREATE INDEX IF NOT EXISTS {idx_name} "
                f"ON public.{partition_name}({idx_cols});"
            )

        sql_lines.append("")

    sql_lines.append(f"COMMENT ON TABLE public.{table_name} IS "
                     f"'{table_name} 테이블 (파티션 확장: 2025-2075, 51년치)';")
    sql_lines.append("")

# 완료 메시지
sql_lines.extend([
    "DO $$",
    "BEGIN",
    "  RAISE NOTICE '=== 파티션 50년 확장 완료 ===';",
    "  RAISE NOTICE 'execution_audit_runs: 2025-2075 (51년치)';",
    "  RAISE NOTICE 'execution_audit_steps: 2025-2075 (51년치)';",
    "  RAISE NOTICE 'automation_actions: 2025-2075 (51년치)';",
    "  RAISE NOTICE '비용: 빈 파티션 약 2MB 추가 (무시할 수 있는 수준)';",
    "  RAISE NOTICE '장점: 2075년까지 파티션 관리 불필요';",
    "END $$;",
    ""
])

# SQL 파일 저장
output_file = 'c:/cursor/SAMDLE/infra/supabase/supabase/migrations/20260112000014_extend_partitions_to_2075.sql'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"SQL file generated: {output_file}")
print(f"Total lines: {len(sql_lines)}")
print(f"Year range: {START_YEAR}~{END_YEAR} ({END_YEAR - START_YEAR + 1} years)")
print(f"Tables: {len(TABLES)}")
