-- Servers, step 5 of 5: let server members see each other's results,
-- but only for that server's games and only from its start date on.
-- Adds a policy; the existing "View own scores" and
-- "Friends view scores" policies are unchanged.

create or replace function public.can_view_server_score(
  p_user_id uuid,
  p_game_id text,
  p_play_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.server_members me
    join public.server_members them
      on them.server_id = me.server_id
    join public.server_games sg
      on sg.server_id = me.server_id
     and sg.game_key = p_game_id
    join public.servers s
      on s.id = me.server_id
    where me.user_id = (select auth.uid())
      and them.user_id = p_user_id
      and p_play_date >= s.start_date
  );
$$;

revoke all on function public.can_view_server_score(uuid, text, date) from public, anon;
grant execute on function public.can_view_server_score(uuid, text, date) to authenticated;

drop policy if exists "Server members view scores" on public.daily_scores;
create policy "Server members view scores" on public.daily_scores
  for select to authenticated
  using (public.can_view_server_score(user_id, game_id, play_date));
