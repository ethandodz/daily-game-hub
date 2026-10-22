-- Player cards, step 1 of 1: icon, card color, bio and favorite game,
-- plus the stats shown on a card. Safe to run again.
-- Needs the Servers files (supabase/servers) to have been run first.

create table if not exists public.player_cards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  icon text not null default '🦊',
  color text not null default 'purple',
  bio text not null default '',
  favorite_game text,
  updated_at timestamptz not null default now()
);

-- Free icons and colors. Once the shop (03_shop.sql) is installed,
-- icons are checked by its trigger instead, so this check is skipped.
do $$
begin
  if to_regclass('public.shop_items') is null then
    alter table public.player_cards
      drop constraint if exists player_cards_icon_check;

    alter table public.player_cards
      add constraint player_cards_icon_check
      check (icon in (
        '🦊', '🐸', '🦖', '🐙', '🦉', '🐼', '🐯', '🐨',
        '🐧', '🦈', '🐝', '🦋', '🎯', '🧩', '🎬', '🌍',
        '🦐', '⚾', '🏈', '🏀', '🎲', '🧠', '🎮', '🍕'
      ));
  end if;
end $$;

alter table public.player_cards
  drop constraint if exists player_cards_color_check;

alter table public.player_cards
  add constraint player_cards_color_check
  check (color in ('purple', 'teal', 'orange', 'pink', 'slate', 'red'));

alter table public.player_cards
  drop constraint if exists player_cards_bio_check;

alter table public.player_cards
  add constraint player_cards_bio_check
  check (char_length(bio) <= 60);

alter table public.player_cards
  drop constraint if exists player_cards_favorite_game_check;

alter table public.player_cards
  add constraint player_cards_favorite_game_check
  check (favorite_game is null or char_length(favorite_game) <= 100);

alter table public.player_cards enable row level security;

-- True when the signed-in player and p_user_id are in a server together.
create or replace function public.shares_server_with(p_user_id uuid)
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
    where me.user_id = (select auth.uid())
      and them.user_id = p_user_id
  );
$$;

revoke all on function public.shares_server_with(uuid) from public, anon;
grant execute on function public.shares_server_with(uuid) to authenticated;

-- You see your own card and the cards of people in a server with you.
drop policy if exists "View own and server cards" on public.player_cards;
create policy "View own and server cards" on public.player_cards
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.shares_server_with(user_id)
  );

drop policy if exists "Add own card" on public.player_cards;
create policy "Add own card" on public.player_cards
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own card" on public.player_cards;
create policy "Update own card" on public.player_cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.player_cards from anon;
grant select, insert, update on public.player_cards to authenticated;

-- Stats on a card:
--   played       every result the player has saved
--   best_streak  most days in a row with at least one result
--   wins         game-days they won in any of their servers
--                (best score, ties share, unsolved can't win;
--                 finished days only, counted once across servers)
--   my_wins / their_wins  for someone else's card: head-to-head on
--                game-days you both played in a server you share
create or replace function public.player_card_stats(
  p_user_id uuid,
  p_today date
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  result json;
begin
  if me is null then
    raise exception 'Log in first';
  end if;

  if p_user_id <> me and not public.shares_server_with(p_user_id) then
    raise exception 'You can only see cards of people in your servers';
  end if;

  with server_game as (
    select
      s.id as server_id,
      s.start_date,
      sg.game_key,
      coalesce(sg.score_direction, g.score_direction) as direction
    from public.servers s
    join public.server_games sg on sg.server_id = s.id
    join public.games g on g.game_key = sg.game_key
  ),
  ranked as (
    select
      gm.server_id,
      ds.user_id,
      ds.game_id,
      ds.play_date,
      ds.completed,
      ds.numeric_score,
      gm.direction,
      case
        when ds.numeric_score is null then 3
        when ds.completed is false then 2
        else 1
      end as tier
    from server_game gm
    join public.server_members m on m.server_id = gm.server_id
    join public.daily_scores ds
      on ds.user_id = m.user_id
     and ds.game_id = gm.game_key
     and ds.play_date >= gm.start_date
     and ds.play_date < p_today
    where gm.direction in ('lower', 'higher')
      and gm.server_id in (
        select server_id from public.server_members where user_id = p_user_id
      )
  ),
  best as (
    select
      server_id,
      game_id,
      play_date,
      case
        when min(direction) = 'lower' then min(numeric_score)
        else max(numeric_score)
      end as best_score
    from ranked
    where tier = 1
    group by server_id, game_id, play_date
  ),
  won as (
    select distinct r.game_id, r.play_date
    from ranked r
    join best b using (server_id, game_id, play_date)
    where r.user_id = p_user_id
      and r.tier = 1
      and r.numeric_score = b.best_score
  ),
  shared as (
    select a.server_id
    from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = me
      and b.user_id = p_user_id
      and p_user_id <> me
  ),
  duel as (
    select distinct on (mine.game_id, mine.play_date)
      mine.game_id,
      mine.play_date,
      case
        when mine.tier = 3 or theirs.tier = 3 then 0
        when mine.tier <> theirs.tier then sign(theirs.tier - mine.tier)
        when mine.tier = 2 or mine.numeric_score = theirs.numeric_score then 0
        when mine.direction = 'lower' then sign(theirs.numeric_score - mine.numeric_score)
        else sign(mine.numeric_score - theirs.numeric_score)
      end as outcome
    from ranked mine
    join ranked theirs
      on theirs.server_id = mine.server_id
     and theirs.game_id = mine.game_id
     and theirs.play_date = mine.play_date
     and theirs.user_id = p_user_id
    where mine.user_id = me
      and mine.server_id in (select server_id from shared)
  ),
  days as (
    select distinct play_date
    from public.daily_scores
    where user_id = p_user_id
  ),
  runs as (
    select count(*) as length
    from (
      select play_date - (row_number() over (order by play_date))::int as run_id
      from days
    ) grouped
    group by run_id
  )
  select json_build_object(
    'played', (select count(*) from public.daily_scores where user_id = p_user_id),
    'best_streak', coalesce((select max(length) from runs), 0),
    'wins', (select count(*) from won),
    'member_since', (select created_at from public.profiles where user_id = p_user_id),
    'my_wins', (select count(*) from duel where outcome > 0),
    'their_wins', (select count(*) from duel where outcome < 0)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.player_card_stats(uuid, date) from public, anon;
grant execute on function public.player_card_stats(uuid, date) to authenticated;

-- Check: should list the new table and function.
select 'player_cards table' as item, to_regclass('public.player_cards') is not null as ready
union all
select 'player_card_stats function', to_regprocedure('public.player_card_stats(uuid, date)') is not null;
