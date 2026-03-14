alter table public.provider_availability_slots
  add column if not exists generated_from text not null default 'manual'
  check (generated_from in ('manual', 'weekly_template'));

alter table public.provider_availability_slots
  add column if not exists weekly_day_of_week smallint
  check (weekly_day_of_week between 0 and 6);

create table if not exists public.provider_weekly_schedules (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_enabled boolean not null default false,
  start_time time,
  end_time time,
  slot_duration_minutes smallint not null default 30
    check (slot_duration_minutes in (15, 30, 45, 60)),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_user_id, day_of_week),
  constraint provider_weekly_window_valid check (
    (is_enabled = false and start_time is null and end_time is null)
    or (is_enabled = true and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index if not exists provider_weekly_schedules_provider_idx
  on public.provider_weekly_schedules(provider_user_id, day_of_week);

drop trigger if exists provider_weekly_schedules_set_updated_at on public.provider_weekly_schedules;
create trigger provider_weekly_schedules_set_updated_at
before update on public.provider_weekly_schedules
for each row execute function public.set_updated_at();

alter table public.provider_weekly_schedules enable row level security;

create policy provider_weekly_schedule_select_policy
  on public.provider_weekly_schedules
  for select
  to authenticated
  using (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy provider_weekly_schedule_modify_policy
  on public.provider_weekly_schedules
  for all
  to authenticated
  using (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

grant select, insert, update, delete
on table public.provider_weekly_schedules
to authenticated;

grant all privileges
on table public.provider_weekly_schedules
to service_role;
