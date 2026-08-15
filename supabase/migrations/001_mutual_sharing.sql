-- =============================================================================
-- Atlas migration: mutual workspace sharing
--
-- Before: inviting someone added them to your workspace only. You could see
-- nothing of theirs.
-- After:  inviting pairs you both ways — they join yours, you join theirs — and
--         removing someone undoes both directions at once.
--
-- Run this in the Supabase SQL editor. It only replaces two functions; no
-- tables, policies or data are touched. Safe to run more than once.
--
-- (Re-running the whole supabase/schema.sql has the same effect — it already
-- contains these definitions — this file is just the smaller change.)
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
  v_me              uuid := auth.uid();
  v_user_id         uuid;
  v_their_workspace uuid;
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

  if v_user_id = v_me then
    raise exception 'That is your own account';
  end if;

  -- They join yours.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_user_id, 'member')
  on conflict (workspace_id, user_id) do nothing;

  -- And you join theirs, so access is mutual. This half cannot be done from
  -- the client: members_insert only lets the owner of a workspace add people,
  -- and you do not own theirs. Hence SECURITY DEFINER.
  select id into v_their_workspace
  from public.workspaces
  where owner_id = v_user_id
  order by created_at
  limit 1;

  if v_their_workspace is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_their_workspace, v_me, 'member')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return v_user_id;
end;
$$;

-- Undo the pairing from both sides at once. Leaving one direction behind
-- would mean "removed" people could still read your workspace.
create or replace function public.unpair_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can remove people';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;

  delete from public.workspace_members
  where user_id = v_me
    and workspace_id in (
      select id from public.workspaces where owner_id = p_user_id
    );
end;
$$;

revoke all on function public.unpair_member(uuid, uuid) from public;
grant execute on function public.unpair_member(uuid, uuid) to authenticated;

revoke all on function public.invite_member_by_email(uuid, text) from public;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;

-- Confirm both functions exist:
select proname from pg_proc
where proname in ('invite_member_by_email', 'unpair_member')
order by proname;
