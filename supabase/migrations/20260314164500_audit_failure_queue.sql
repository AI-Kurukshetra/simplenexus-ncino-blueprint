create table if not exists public.audit_log_failures (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  error_message text not null,
  attempts integer not null default 1 check (attempts > 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists audit_log_failures_resolved_idx
  on public.audit_log_failures(resolved_at, last_failed_at desc);
create index if not exists audit_log_failures_org_resolved_idx
  on public.audit_log_failures(organization_id, resolved_at, last_failed_at desc);

alter table public.audit_log_failures enable row level security;

create policy audit_log_failures_select_policy
  on public.audit_log_failures
  for select
  to authenticated
  using (
    (
      organization_id is null
      and public.current_app_role() = 'super_admin'::public.app_role
    )
    or (
      organization_id is not null
      and public.has_org_access(organization_id)
      and public.is_admin_actor()
    )
  );

create policy audit_log_failures_modify_policy
  on public.audit_log_failures
  for all
  to authenticated
  using (
    (
      organization_id is null
      and public.current_app_role() = 'super_admin'::public.app_role
    )
    or (
      organization_id is not null
      and public.has_org_access(organization_id)
      and public.is_admin_actor()
    )
  )
  with check (
    (
      organization_id is null
      and public.current_app_role() = 'super_admin'::public.app_role
    )
    or (
      organization_id is not null
      and public.has_org_access(organization_id)
      and public.is_admin_actor()
    )
  );

grant select, insert, update, delete on table public.audit_log_failures to authenticated;
grant all privileges on table public.audit_log_failures to service_role;
