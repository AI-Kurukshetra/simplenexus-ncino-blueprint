create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('patient', 'provider', 'admin', 'super_admin');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('active', 'invited', 'suspended');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'provider_approval_status') then
    create type public.provider_approval_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'provider_account_status') then
    create type public.provider_account_status as enum ('pending_provider_approval', 'active', 'rejected');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_status') then
    create type public.onboarding_status as enum ('not_started', 'in_progress', 'submitted');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'availability_status') then
    create type public.availability_status as enum ('available', 'booked', 'blocked');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_type') then
    create type public.appointment_type as enum ('consult', 'follow-up', 'intake');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum ('pending_provider_approval', 'approved', 'rejected', 'cancelled');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_event_type') then
    create type public.appointment_event_type as enum (
      'requested',
      'approved',
      'rejected',
      'rescheduled',
      'cancelled',
      'reminder_24h_scheduled',
      'reminder_1h_scheduled',
      'reminder_24h_sent',
      'reminder_1h_sent'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('todo', 'in_progress', 'done', 'blocked');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'appointment_requested',
      'appointment_approved',
      'appointment_rejected',
      'appointment_rescheduled',
      'appointment_cancelled',
      'appointment_reminder_24h',
      'appointment_reminder_1h',
      'system'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum ('in_app', 'email', 'sms');
  end if;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  specialty text,
  branding jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  role public.app_role not null default 'patient',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  onboarding_status public.onboarding_status not null default 'not_started',
  ready_for_scheduling boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.provider_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_status public.provider_approval_status not null default 'pending',
  account_status public.provider_account_status not null default 'pending_provider_approval',
  specialty text,
  license_number text,
  years_experience integer,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.provider_availability_slots (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.availability_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_slot_window_valid check (ends_at > starts_at),
  unique (provider_user_id, starts_at)
);

create table if not exists public.appointment_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  provider_slot_id uuid references public.provider_availability_slots(id) on delete set null,
  starts_at timestamptz not null,
  reason text not null,
  appointment_type public.appointment_type not null,
  status public.appointment_status not null default 'pending_provider_approval',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  rescheduled_at timestamptz,
  rescheduled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  appointment_id uuid not null references public.appointment_requests(id) on delete cascade,
  event_type public.appointment_event_type not null,
  occurred_at timestamptz not null default now(),
  dispatched_at timestamptz,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.care_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_provider_user_id uuid references auth.users(id) on delete set null,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by_role public.app_role not null,
  title text not null,
  description text not null default '',
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  related_appointment_id uuid references public.appointment_requests(id) on delete set null,
  dedupe_key text
);

create unique index if not exists notifications_user_dedupe_unique
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.scheduling_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  cancellation_min_hours integer not null default 4 check (cancellation_min_hours between 0 and 168),
  reschedule_min_hours integer not null default 8 check (reschedule_min_hours between 0 and 168),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships(user_id);
create index if not exists organization_memberships_org_role_idx
  on public.organization_memberships(organization_id, role, status);
create index if not exists provider_profiles_org_status_idx
  on public.provider_profiles(organization_id, approval_status);
create index if not exists patient_profiles_org_ready_idx
  on public.patient_profiles(organization_id, ready_for_scheduling);
create index if not exists provider_availability_provider_time_idx
  on public.provider_availability_slots(provider_user_id, starts_at);
create index if not exists appointment_requests_patient_idx
  on public.appointment_requests(patient_user_id, starts_at desc);
create index if not exists appointment_requests_provider_idx
  on public.appointment_requests(provider_user_id, starts_at desc);
create index if not exists appointment_requests_org_status_idx
  on public.appointment_requests(organization_id, status, starts_at desc);
create index if not exists appointment_events_appointment_idx
  on public.appointment_events(appointment_id, occurred_at desc);
create index if not exists care_tasks_patient_status_idx
  on public.care_tasks(patient_user_id, status, created_at desc);
create index if not exists care_tasks_provider_status_idx
  on public.care_tasks(assigned_provider_user_id, status, created_at desc);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_org_created_idx
  on public.notifications(organization_id, created_at desc);
create index if not exists audit_logs_org_created_idx
  on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists patient_profiles_set_updated_at on public.patient_profiles;
create trigger patient_profiles_set_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

drop trigger if exists provider_profiles_set_updated_at on public.provider_profiles;
create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();

drop trigger if exists provider_slots_set_updated_at on public.provider_availability_slots;
create trigger provider_slots_set_updated_at
before update on public.provider_availability_slots
for each row execute function public.set_updated_at();

drop trigger if exists appointment_requests_set_updated_at on public.appointment_requests;
create trigger appointment_requests_set_updated_at
before update on public.appointment_requests
for each row execute function public.set_updated_at();

drop trigger if exists care_tasks_set_updated_at on public.care_tasks;
create trigger care_tasks_set_updated_at
before update on public.care_tasks
for each row execute function public.set_updated_at();

drop trigger if exists scheduling_policies_set_updated_at on public.scheduling_policies;
create trigger scheduling_policies_set_updated_at
before update on public.scheduling_policies
for each row execute function public.set_updated_at();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select case lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'patient'))
    when 'super_admin' then 'super_admin'::public.app_role
    when 'admin' then 'admin'::public.app_role
    when 'provider' then 'provider'::public.app_role
    else 'patient'::public.app_role
  end;
$$;

create or replace function public.is_admin_actor()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('admin'::public.app_role, 'super_admin'::public.app_role);
$$;

create or replace function public.has_org_access(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_app_role() = 'super_admin'::public.app_role
    or exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = org_id
        and m.user_id = auth.uid()
        and m.status = 'active'::public.membership_status
    );
$$;

revoke all on function public.has_org_access(uuid) from public;
grant execute on function public.has_org_access(uuid) to authenticated;

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.organization_memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'::public.membership_status
  order by m.created_at asc
  limit 1;
$$;

revoke all on function public.current_user_org_id() from public;
grant execute on function public.current_user_org_id() to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.user_profiles enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_availability_slots enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.appointment_events enable row level security;
alter table public.care_tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.scheduling_policies enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select_policy
  on public.organizations
  for select
  to authenticated
  using (public.has_org_access(id));

create policy organizations_update_policy
  on public.organizations
  for update
  to authenticated
  using (public.has_org_access(id) and public.is_admin_actor())
  with check (public.has_org_access(id) and public.is_admin_actor());

create policy organizations_insert_policy
  on public.organizations
  for insert
  to authenticated
  with check (public.current_app_role() = 'super_admin'::public.app_role);

create policy organization_memberships_select_policy
  on public.organization_memberships
  for select
  to authenticated
  using (user_id = auth.uid() or (public.has_org_access(organization_id) and public.is_admin_actor()));

create policy organization_memberships_modify_policy
  on public.organization_memberships
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy user_profiles_select_policy
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or (organization_id is not null and public.has_org_access(organization_id) and public.is_admin_actor()));

create policy user_profiles_modify_policy
  on public.user_profiles
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or (organization_id is not null and public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    user_id = auth.uid()
    or (organization_id is not null and public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy patient_profiles_select_policy
  on public.patient_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_org_access(organization_id));

create policy patient_profiles_modify_policy
  on public.patient_profiles
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy provider_profiles_select_policy
  on public.provider_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_access(organization_id)
  );

create policy provider_profiles_modify_policy
  on public.provider_profiles
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy provider_availability_select_policy
  on public.provider_availability_slots
  for select
  to authenticated
  using (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
    or (public.current_app_role() = 'patient'::public.app_role and public.has_org_access(organization_id) and status = 'available'::public.availability_status)
  );

create policy provider_availability_modify_policy
  on public.provider_availability_slots
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

create policy appointment_requests_select_policy
  on public.appointment_requests
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy appointment_requests_insert_policy
  on public.appointment_requests
  for insert
  to authenticated
  with check (
    patient_user_id = auth.uid()
    and public.current_app_role() = 'patient'::public.app_role
    and public.has_org_access(organization_id)
  );

create policy appointment_requests_update_policy
  on public.appointment_requests
  for update
  to authenticated
  using (
    patient_user_id = auth.uid()
    or provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    patient_user_id = auth.uid()
    or provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy appointment_events_select_policy
  on public.appointment_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.appointment_requests a
      where a.id = appointment_id
        and (
          a.patient_user_id = auth.uid()
          or a.provider_user_id = auth.uid()
          or (public.has_org_access(a.organization_id) and public.is_admin_actor())
        )
    )
  );

create policy appointment_events_insert_policy
  on public.appointment_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.appointment_requests a
      where a.id = appointment_id
        and (
          a.patient_user_id = auth.uid()
          or a.provider_user_id = auth.uid()
          or (public.has_org_access(a.organization_id) and public.is_admin_actor())
        )
    )
  );

create policy care_tasks_select_policy
  on public.care_tasks
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or assigned_provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy care_tasks_insert_policy
  on public.care_tasks
  for insert
  to authenticated
  with check (
    (
      public.current_app_role() = 'provider'::public.app_role
      and assigned_provider_user_id = auth.uid()
    )
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy care_tasks_update_policy
  on public.care_tasks
  for update
  to authenticated
  using (
    patient_user_id = auth.uid()
    or assigned_provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    patient_user_id = auth.uid()
    or assigned_provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy notifications_select_policy
  on public.notifications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy notifications_insert_policy
  on public.notifications
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy notifications_update_policy
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy scheduling_policies_select_policy
  on public.scheduling_policies
  for select
  to authenticated
  using (public.has_org_access(organization_id));

create policy scheduling_policies_modify_policy
  on public.scheduling_policies
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy audit_logs_select_policy
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id is not null
    and public.has_org_access(organization_id)
    and public.is_admin_actor()
  );

create policy audit_logs_insert_policy
  on public.audit_logs
  for insert
  to authenticated
  with check (
    (organization_id is null and public.current_app_role() = 'super_admin'::public.app_role)
    or (organization_id is not null and public.has_org_access(organization_id) and public.is_admin_actor())
  );

grant select, insert, update, delete on table
  public.organizations,
  public.organization_memberships,
  public.user_profiles,
  public.patient_profiles,
  public.provider_profiles,
  public.provider_availability_slots,
  public.appointment_requests,
  public.appointment_events,
  public.care_tasks,
  public.notifications,
  public.scheduling_policies,
  public.audit_logs
to authenticated;

grant all privileges on table
  public.organizations,
  public.organization_memberships,
  public.user_profiles,
  public.patient_profiles,
  public.provider_profiles,
  public.provider_availability_slots,
  public.appointment_requests,
  public.appointment_events,
  public.care_tasks,
  public.notifications,
  public.scheduling_policies,
  public.audit_logs
to service_role;
