-- automation_actions에 선점 메타 컬럼 추가
alter table if exists public.automation_actions
  add column if not exists claimed_by text,
  add column if not exists claim_expires_at timestamptz;

create index if not exists idx_automation_actions_claim
  on public.automation_actions (tenant_id, dedup_key, claim_expires_at);

-- 원자적 claim 함수
create or replace function public.claim_automation_action(
  p_tenant_id uuid,
  p_dedup_key text,
  p_request_id text,
  p_action_type text,
  p_actor_id text,
  p_execution_context jsonb
)
returns table (
  id uuid,
  dedup_key text,
  request_id text,
  status text,
  claimed_by text,
  claim_expires_at timestamptz,
  result jsonb
)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_exp timestamptz := now() + interval '120 seconds';
begin
  -- 1) row가 없으면 먼저 생성 (pending)
  insert into public.automation_actions (
    tenant_id, dedup_key, request_id, action_type,
    executed_by, executed_at, result, execution_context,
    claimed_by, claim_expires_at
  )
  values (
    p_tenant_id, p_dedup_key, p_request_id, p_action_type,
    p_actor_id, v_now, jsonb_build_object('status','pending'), p_execution_context,
    p_actor_id, v_exp
  )
  on conflict (tenant_id, dedup_key) do nothing;

  -- 2) 내가 claim을 가져올 수 있는지 원자적으로 갱신
  update public.automation_actions a
     set claimed_by = p_actor_id,
         claim_expires_at = v_exp
   where a.tenant_id = p_tenant_id
     and a.dedup_key = p_dedup_key
     and (
          a.claimed_by is null
          or a.claim_expires_at is null
          or a.claim_expires_at < v_now
     )
     and (a.result->>'status') = 'pending'
  returning a.id, a.dedup_key, a.request_id, (a.result->>'status')::text,
            a.claimed_by, a.claim_expires_at, a.result
  into id, dedup_key, request_id, status, claimed_by, claim_expires_at, result;

  -- 3) update가 안되면(=누군가 이미 claim) 현재 row 반환
  if id is null then
    return query
    select a.id, a.dedup_key, a.request_id, (a.result->>'status')::text,
           a.claimed_by, a.claim_expires_at, a.result
      from public.automation_actions a
     where a.tenant_id = p_tenant_id
       and a.dedup_key = p_dedup_key
     limit 1;
  else
    return next;
  end if;
end;
$$;

-- 함수 권한 부여
grant execute on function public.claim_automation_action to service_role;

