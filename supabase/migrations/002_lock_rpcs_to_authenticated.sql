-- =============================================================================
-- Atlas migration: stop anonymous callers reaching the sharing functions
--
-- Both functions already refuse an anonymous caller — they guard on
-- is_workspace_owner(), and auth.uid() is null when signed out. This closes the
-- door one step earlier so the guard is not the only thing protecting a
-- SECURITY DEFINER function.
--
-- Why the original revoke was not enough: Supabase grants EXECUTE on functions
-- in the public schema to the `anon` role explicitly, and
-- `revoke ... from public` does not remove an explicit role grant.
--
-- is_workspace_member and is_workspace_owner are intentionally left alone: RLS
-- policies call them, and the querying role needs EXECUTE or signed-out reads
-- would error instead of quietly returning nothing.
--
-- Safe to run more than once. No tables, policies or data are touched.
-- =============================================================================

revoke all on function public.invite_member_by_email(uuid, text) from public, anon;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;

revoke all on function public.unpair_member(uuid, uuid) from public, anon;
grant execute on function public.unpair_member(uuid, uuid) to authenticated;

-- Who can execute what now. Expect `authenticated` only, for both.
select
  p.proname,
  coalesce(
    (select string_agg(a.grantee::regrole::text, ', ' order by a.grantee::regrole::text)
     from aclexplode(p.proacl) a
     where a.privilege_type = 'EXECUTE'
       and a.grantee::regrole::text in ('anon', 'authenticated', 'public')),
    'no explicit grants'
  ) as can_execute
from pg_proc p
where p.proname in ('invite_member_by_email', 'unpair_member')
order by p.proname;
