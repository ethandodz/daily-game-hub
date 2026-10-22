-- Servers, step 3 of 5: who can see and change what.
-- The helper functions run with elevated rights so policies on
-- server_members can check membership without calling themselves
-- (which would cause infinite recursion).

create or replace function public.is_server_member(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.server_members
    where server_id = p_server_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_server_owner(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.servers
    where id = p_server_id
      and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_server_member(uuid) from public, anon;
revoke all on function public.is_server_owner(uuid) from public, anon;
grant execute on function public.is_server_member(uuid) to authenticated;
grant execute on function public.is_server_owner(uuid) to authenticated;

-- servers: members can see it; only the owner can rename or delete it.
-- New servers are created through create_server() in step 4.
drop policy if exists "Members view servers" on public.servers;
create policy "Members view servers" on public.servers
  for select to authenticated
  using (public.is_server_member(id));

drop policy if exists "Owners update servers" on public.servers;
create policy "Owners update servers" on public.servers
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Only the name can be edited directly. The start date and invite
-- code are set by create_server() and reset_invite_code().
revoke update on public.servers from authenticated, anon;
grant update (name) on public.servers to authenticated;

drop policy if exists "Owners delete servers" on public.servers;
create policy "Owners delete servers" on public.servers
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- server_members: members can see each other.
-- Anyone can leave (except the owner); the owner can remove others.
-- Joining goes through join_server() in step 4.
drop policy if exists "Members view members" on public.server_members;
create policy "Members view members" on public.server_members
  for select to authenticated
  using (public.is_server_member(server_id));

drop policy if exists "Leave or remove members" on public.server_members;
create policy "Leave or remove members" on public.server_members
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (public.is_server_owner(server_id) and user_id <> (select auth.uid()))
  );

-- server_games: members can see the list; only the owner changes it.
drop policy if exists "Members view server games" on public.server_games;
create policy "Members view server games" on public.server_games
  for select to authenticated
  using (public.is_server_member(server_id));

drop policy if exists "Owners add server games" on public.server_games;
create policy "Owners add server games" on public.server_games
  for insert to authenticated
  with check (public.is_server_owner(server_id));

drop policy if exists "Owners update server games" on public.server_games;
create policy "Owners update server games" on public.server_games
  for update to authenticated
  using (public.is_server_owner(server_id))
  with check (public.is_server_owner(server_id));

drop policy if exists "Owners remove server games" on public.server_games;
create policy "Owners remove server games" on public.server_games
  for delete to authenticated
  using (public.is_server_owner(server_id));
