-- =============================================================================
-- Atlas — complete database schema
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query
-- → paste → Run). It is idempotent: running it twice is safe.
--
-- Security model
-- --------------
-- Atlas is a static site with no server, so the anon key is public and row
-- level security is the *only* thing protecting your data. Every table below
-- has RLS enabled and no policy trusts a client-supplied user id — they all
-- derive identity from auth.uid().
--
-- Access rules:
--   * You can read and write rows in any workspace you are a member of.
--   * Rows flagged is_private are visible only to their creator.
--   * Nobody can read a workspace they were not added to.
-- =============================================================================

-- ----------------------------------------------------------------- profiles --

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Mirror new auth users into profiles so members can see each other's names.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- workspaces --

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My workspace',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

-- A second foreign key on the same column, pointing at profiles.
--
-- It looks redundant next to the auth.users reference, but PostgREST can only
-- embed a related table when a foreign key joins them. The client asks for
-- `workspace_members -> profile:profiles(*)` to show who is in a workspace, and
-- without this it fails with "Could not find a relationship ... in the schema
-- cache". auth.users is not exposed over the API, so it cannot serve as the
-- join path.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_profile_fkey'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- The membership check has to run as SECURITY DEFINER. If a policy on
-- workspace_members queried workspace_members directly, Postgres would recurse
-- while evaluating that same policy.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------- projects --

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  color        text not null default 'oklch(65% 0.16 258)',
  icon         text default 'Folder',
  archived     boolean not null default false,
  is_private   boolean not null default false,
  position     double precision not null default 1000,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_workspace_idx on public.projects(workspace_id);

-- -------------------------------------------------------------------- tasks --

create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete set null,
  title            text not null,
  description      text,
  status           text not null default 'inbox'
                     check (status in ('inbox', 'today', 'doing', 'done')),
  priority         smallint not null default 4 check (priority between 1 and 4),
  due_date         date,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes > 0),
  subtasks         jsonb not null default '[]'::jsonb,
  position         double precision not null default 1000,
  completed_at     timestamptz,
  is_private       boolean not null default false,
  created_by       uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_workspace_idx on public.tasks(workspace_id);
create index if not exists tasks_status_idx    on public.tasks(workspace_id, status);
create index if not exists tasks_due_idx       on public.tasks(workspace_id, due_date);
create index if not exists tasks_project_idx   on public.tasks(project_id);

-- ------------------------------------------------------------------- labels --

create table if not exists public.labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default 'oklch(68% 0.14 260)',
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.task_labels (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index if not exists task_labels_label_idx on public.task_labels(label_id);

-- -------------------------------------------------------------------- notes --

create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null default 'Untitled',
  content      text not null default '',
  pinned       boolean not null default false,
  is_private   boolean not null default false,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists notes_workspace_idx on public.notes(workspace_id);

-- ---------------------------------------------------------- calendar_events --

create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete set null,
  task_id      uuid references public.tasks(id) on delete cascade,
  title        text not null,
  description  text,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  all_day      boolean not null default false,
  color        text,
  location     text,
  is_private   boolean not null default false,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_at >= start_at)
);

create index if not exists events_workspace_idx on public.calendar_events(workspace_id);
create index if not exists events_range_idx     on public.calendar_events(workspace_id, start_at);

-- ------------------------------------------------------------------- habits --

create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  name           text not null,
  icon           text not null default 'Circle',
  color          text not null default 'oklch(70% 0.15 258)',
  target_per_day integer not null default 1 check (target_per_day > 0),
  unit           text,
  archived       boolean not null default false,
  position       double precision not null default 1000,
  created_by     uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index if not exists habits_workspace_idx on public.habits(workspace_id);

-- Habit tracking is per person: sharing a workspace shouldn't merge your
-- workout streak with your friend's.
create table if not exists public.habit_logs (
  id       uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  count    integer not null default 1 check (count >= 0),
  unique (habit_id, user_id, date)
);

create index if not exists habit_logs_user_idx on public.habit_logs(user_id, date);

-- ----------------------------------------------------------------- comments --

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type  text not null check (entity_type in ('task', 'note', 'project')),
  entity_id    uuid not null,
  body         text not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists comments_entity_idx on public.comments(entity_type, entity_id);

-- ------------------------------------------------------------ notifications --

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete cascade,
  title        text not null,
  body         text,
  fire_at      timestamptz not null,
  read_at      timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, fire_at);

-- ----------------------------------------------------------------- settings --

create table if not exists public.settings (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  theme                  text not null default 'dark'
                           check (theme in ('dark', 'light', 'system')),
  accent                 text not null default 'oklch(70% 0.16 258)',
  week_start             smallint not null default 1 check (week_start in (0, 1)),
  notifications_enabled  boolean not null default false,
  notify_due_today       boolean not null default true,
  notify_deadlines       boolean not null default true,
  reminder_lead_minutes  integer not null default 10 check (reminder_lead_minutes >= 0),
  default_calendar_view  text not null default 'timeGridWeek'
                           check (default_calendar_view in
                             ('dayGridMonth', 'timeGridWeek', 'timeGridDay')),
  updated_at             timestamptz not null default now()
);

-- =============================================================================
-- Row level security
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.workspaces       enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects         enable row level security;
alter table public.tasks            enable row level security;
alter table public.labels           enable row level security;
alter table public.task_labels      enable row level security;
alter table public.notes            enable row level security;
alter table public.calendar_events  enable row level security;
alter table public.habits           enable row level security;
alter table public.habit_logs       enable row level security;
alter table public.comments         enable row level security;
alter table public.notifications    enable row level security;
alter table public.settings         enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    -- You can see the profile of anyone who shares a workspace with you.
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces -------------------------------------------------------------
-- The owner clause is not redundant with the membership check. On first login
-- the workspace row is inserted before its workspace_members row exists, so for
-- one statement the creator is not yet a member. Without `owner_id = auth.uid()`
-- an INSERT ... RETURNING (any .insert().select() from the client) has its
-- returned row rejected by this policy and the whole insert rolls back.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select
  using (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces for delete
  using (owner_id = auth.uid());

-- workspace_members ------------------------------------------------------
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

-- You may add yourself to a workspace you own (first login), and the owner may
-- add others. Invites go through invite_member_by_email, which runs as definer.
drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members for insert
  with check (
    (user_id = auth.uid() and public.is_workspace_owner(workspace_id))
    or public.is_workspace_owner(workspace_id)
  );

drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members for delete
  using (public.is_workspace_owner(workspace_id) or user_id = auth.uid());

-- Shared shape for workspace-scoped content: members see it, private rows
-- stay with their author.
--   select : member AND (not private OR mine)
--   insert : member AND created_by = me
--   update : member AND (not private OR mine)
--   delete : same as update

drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects for all
  using (public.is_workspace_member(workspace_id) and (not is_private or created_by = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all
  using (public.is_workspace_member(workspace_id) and (not is_private or created_by = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists labels_all on public.labels;
create policy labels_all on public.labels for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists notes_all on public.notes;
create policy notes_all on public.notes for all
  using (public.is_workspace_member(workspace_id) and (not is_private or created_by = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists events_all on public.calendar_events;
create policy events_all on public.calendar_events for all
  using (public.is_workspace_member(workspace_id) and (not is_private or created_by = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists habits_all on public.habits;
create policy habits_all on public.habits for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists comments_all on public.comments;
create policy comments_all on public.comments for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

-- task_labels has no workspace_id; it inherits access from its task.
drop policy if exists task_labels_all on public.task_labels;
create policy task_labels_all on public.task_labels for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_workspace_member(t.workspace_id)
        and (not t.is_private or t.created_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_workspace_member(t.workspace_id)
    )
  );

-- Personal tables: strictly your own rows.
drop policy if exists habit_logs_all on public.habit_logs;
create policy habit_logs_all on public.habit_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_all on public.notifications;
create policy notifications_all on public.notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Inviting a friend
--
-- There is no server to email an invitation from, so the person must already
-- have an Atlas account. This function looks them up by email and adds them —
-- SECURITY DEFINER because the caller cannot read a profile they don't yet
-- share a workspace with. It returns null when no such account exists.
-- =============================================================================

create or replace function public.invite_member_by_email(
  p_workspace_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can invite people';
  end if;

  select id into v_user_id
  from public.profiles
  where lower(email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_user_id, 'member')
  on conflict (workspace_id, user_id) do nothing;

  return v_user_id;
end;
$$;

revoke all on function public.invite_member_by_email(uuid, text) from public;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;

-- =============================================================================
-- Realtime
--
-- Adds the shared tables to the realtime publication so a change made by your
-- friend shows up on your screen without a refresh. RLS still applies, so you
-- only receive changes you were allowed to read.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'tasks', 'labels', 'task_labels',
    'notes', 'calendar_events', 'habits', 'comments', 'workspace_members'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- already published
      when undefined_object then null;  -- publication missing on this plan
    end;
  end loop;
end $$;

-- Realtime DELETE payloads only carry the primary key unless the table is set
-- to REPLICA IDENTITY FULL. Atlas needs workspace_id on deletes to route them.
alter table public.tasks           replica identity full;
alter table public.projects        replica identity full;
alter table public.notes           replica identity full;
alter table public.calendar_events replica identity full;
alter table public.habits          replica identity full;
alter table public.labels          replica identity full;
alter table public.task_labels     replica identity full;
alter table public.comments        replica identity full;

-- =============================================================================
-- Done. Two things left, both in the dashboard:
--   1. Settings → API: copy the Project URL and anon key into .env.local
--   2. Authentication → Providers → Email: turn off "Confirm email" if you'd
--      rather not verify addresses while trying things out.
-- =============================================================================
