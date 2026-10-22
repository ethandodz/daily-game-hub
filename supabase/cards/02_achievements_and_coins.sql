-- Player cards, step 2: achievements (badges), showcase badges and coins.
-- Also updates two game icons. Safe to run again.
-- Run after 01_player_cards.sql.

-- Game icons
update public.games set icon = '🦐' where game_key = 'krillion';
update public.games set icon = '💯' where game_key = 'guesslist';


-- Up to 3 badges shown on your card (achievement ids).
alter table public.player_cards
  add column if not exists showcase text[] not null default '{}';

alter table public.player_cards
  drop constraint if exists player_cards_showcase_check;

alter table public.player_cards
  add constraint player_cards_showcase_check
  check (
    cardinality(showcase) <= 3
    and array_to_string(showcase, ',') ~ '^[a-z0-9_,]*$'
  );


-- Achievement list. Each achievement has 1 to 4 tiers
-- (bronze, silver, gold, diamond); a tier unlocks when the
-- player's number for its metric reaches the threshold.
create table if not exists public.achievements (
  id text not null,
  tier integer not null check (tier between 1 and 4),
  metric text not null,
  threshold integer not null check (threshold > 0),
  name text not null,
  icon text not null,
  description text not null,
  coins integer not null check (coins >= 0),
  sort_order integer not null,
  primary key (id, tier)
);

alter table public.achievements enable row level security;

drop policy if exists "Anyone signed in reads achievements" on public.achievements;
create policy "Anyone signed in reads achievements" on public.achievements
  for select to authenticated
  using (true);

revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to authenticated;

delete from public.achievements;

insert into public.achievements
  (id, sort_order, name, icon, description, metric, tier, threshold, coins)
select a.id, a.sort_order, a.name, a.icon, a.description, a.metric,
       t.tier, t.threshold, (array[25, 50, 100, 200])[t.tier]
from (values
  ('winner',       1, 'Winner',         '👑', 'Days won in your servers',          'wins',                array[1, 10, 50, 100]),
  ('week_champ',   2, 'Week Champ',     '🏆', 'Weeks won in a server',             'week_awards',         array[1, 5, 10]),
  ('month_champ',  3, 'Month Champ',    '🥇', 'Months won in a server',            'month_awards',        array[1, 3, 12]),
  ('on_fire',      4, 'On Fire',        '🔥', 'Days in a row with a result',       'best_streak',         array[7, 30, 100, 365]),
  ('regular',      5, 'Regular',        '🗓️', 'Results posted',                    'played',              array[10, 100, 500, 1000]),
  ('explorer',     6, 'Explorer',       '🧭', 'Different games played',            'distinct_games',      array[5, 10, 20]),
  ('busy_day',     7, 'Busy Day',       '🎮', 'Games played in one day',           'max_games_day',       array[5, 10, 15]),
  ('sharpshooter', 8, 'Sharpshooter',   '🎯', 'Wordle in 2 guesses or fewer',      'wordle_2',            array[1, 5, 25]),
  ('krillionaire', 9, 'Krillionaire',   '💎', 'Krillion answer (💎) in Krillion',  'krillion_diamond',    array[1, 5, 20]),
  ('krill_400',   10, 'Shrimp Boss',    '🦐', '400+ points in Krillion',           'krillion_400',        array[1, 10, 50]),
  ('flawless',    11, 'Flawless',       '🧠', 'Connections with 0 mistakes',       'connections_perfect', array[1, 10, 50]),
  ('first_frame', 12, 'First Frame',    '🎬', 'Framed on the first frame',         'framed_1',            array[1, 5, 20]),
  ('globetrotter',13, 'Globetrotter',   '🌍', 'Worldle in 1 guess',                'worldle_1',           array[1, 10, 50]),
  ('perfect_grid',14, 'Perfect Grid',   '⚾', 'Immaculate Grid 9/9',               'immaculate_9',        array[1, 5, 20]),
  ('duo_master',  15, 'Duo Master',     '🔢', 'Duotrigordle in 34 guesses or fewer','duotrigordle_34',    array[1, 5, 20]),
  ('blockbuster', 16, 'Blockbuster',    '🍿', 'Box Office Game 🏆 400+',           'boxoffice_400',       array[1, 5, 20]),
  ('founder',     17, 'Founder',        '🏰', 'Create a server',                   'servers_owned',       array[1]),
  ('joiner',      18, 'Squad Up',       '🤝', 'Join a server',                     'servers_joined',      array[1]),
  ('full_house',  19, 'Full House',     '👥', 'Be in a server with 5+ players',    'biggest_server',      array[5])
) as a(id, sort_order, name, icon, description, metric, thresholds)
cross join lateral unnest(a.thresholds) with ordinality as t(threshold, tier);


-- Ranked daily results in every server p_user_id is in: finished
-- days only, from each server's start date, games with a winner.
-- place 1 with tier 1 is a win (ties share; unsolved can't win).
create or replace function public.dgh_ranked_results(p_user_id uuid, p_today date)
returns table (
  server_id uuid,
  game_id text,
  play_date date,
  user_id uuid,
  tier integer,
  place bigint,
  players bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with server_game as (
    select
      s.id as server_id,
      s.start_date,
      sg.game_key,
      coalesce(sg.score_direction, g.score_direction) as direction
    from public.servers s
    join public.server_games sg on sg.server_id = s.id
    join public.games g on g.game_key = sg.game_key
    where s.id in (
      select m.server_id from public.server_members m where m.user_id = p_user_id
    )
  ),
  scored as (
    select
      gm.server_id,
      ds.game_id,
      ds.play_date,
      ds.user_id,
      case when ds.completed is false then 2 else 1 end as tier,
      case when gm.direction = 'lower' then ds.numeric_score else -ds.numeric_score end as signed_score
    from server_game gm
    join public.server_members m on m.server_id = gm.server_id
    join public.daily_scores ds
      on ds.user_id = m.user_id
     and ds.game_id = gm.game_key
     and ds.play_date >= gm.start_date
     and ds.play_date < p_today
    where gm.direction in ('lower', 'higher')
      and ds.numeric_score is not null
  )
  select
    server_id,
    game_id,
    play_date,
    user_id,
    tier,
    rank() over (partition by server_id, game_id, play_date order by tier, signed_score) as place,
    count(*) over (partition by server_id, game_id, play_date) as players
  from scored;
$$;


-- Weeks (Monday to Sunday) and months p_user_id won in a server,
-- once the period is over. Two awards each:
--   wins     most daily wins (at least 1)
--   average  best average finishing place, playing at least
--            4 days of the week or 15 days of the month
-- Ties share. Needs at least 2 players in the server that period.
create or replace function public.dgh_period_awards(p_user_id uuid, p_today date)
returns table (
  server_id uuid,
  server_name text,
  period text,
  period_start date,
  period_end date,
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  with results as (
    select * from public.dgh_ranked_results(p_user_id, p_today)
  ),
  periods as (
    select 'week'::text as period, 4 as min_days,
           date_trunc('week', r.play_date)::date as period_start,
           (date_trunc('week', r.play_date) + interval '6 days')::date as period_end,
           r.*
    from results r
    union all
    select 'month', 15,
           date_trunc('month', r.play_date)::date,
           (date_trunc('month', r.play_date) + interval '1 month' - interval '1 day')::date,
           r.*
    from results r
  ),
  totals as (
    select
      p.server_id, p.period, p.period_start, p.period_end, p.user_id, p.min_days,
      count(*) filter (where p.tier = 1 and p.place = 1) as wins,
      avg(p.place) as average_place,
      count(distinct p.play_date) as days
    from periods p
    where p.period_end < p_today
    group by p.server_id, p.period, p.period_start, p.period_end, p.user_id, p.min_days
  ),
  compared as (
    select
      t.*,
      count(*) over w as players,
      max(t.wins) over w as top_wins,
      min(t.average_place) filter (where t.days >= t.min_days) over w as top_average
    from totals t
    window w as (partition by t.server_id, t.period, t.period_start)
  )
  select c.server_id, s.name, c.period, c.period_start, c.period_end, k.kind
  from compared c
  join public.servers s on s.id = c.server_id
  cross join (values ('wins'), ('average')) as k(kind)
  where c.user_id = p_user_id
    and c.players >= 2
    and (
      (k.kind = 'wins' and c.wins > 0 and c.wins = c.top_wins)
      or (k.kind = 'average' and c.days >= c.min_days and c.average_place = c.top_average)
    );
$$;


-- Every number the achievements are based on.
create or replace function public.dgh_player_metrics(p_user_id uuid, p_today date)
returns table (metric text, value bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from public.daily_scores where user_id = p_user_id and play_date <= p_today
  ),
  days as (
    select distinct play_date from mine
  ),
  runs as (
    select count(*) as length
    from (
      select play_date - (row_number() over (order by play_date))::int as run_id
      from days
    ) grouped
    group by run_id
  ),
  wins as (
    select distinct r.game_id, r.play_date
    from public.dgh_ranked_results(p_user_id, p_today) r
    where r.user_id = p_user_id and r.tier = 1 and r.place = 1
  ),
  awards as (
    select * from public.dgh_period_awards(p_user_id, p_today)
  ),
  solved as (
    select * from mine where completed is not false and numeric_score is not null
  )
  select 'played', count(*) from mine
  union all select 'best_streak', coalesce(max(length), 0) from runs
  union all select 'distinct_games', count(distinct game_id) from mine
  union all select 'max_games_day', coalesce(max(games), 0) from (select count(*) as games from mine group by play_date) d
  union all select 'wins', count(*) from wins
  union all select 'week_awards', count(*) from awards where period = 'week'
  union all select 'month_awards', count(*) from awards where period = 'month'
  union all select 'wordle_2', count(*) from solved where game_id = 'wordle' and numeric_score <= 2
  union all select 'krillion_diamond', count(*) from mine where game_id = 'krillion' and result_text like '%💎%'
  union all select 'krillion_400', count(*) from solved where game_id = 'krillion' and numeric_score >= 400
  union all select 'connections_perfect', count(*) from solved where game_id = 'connections' and numeric_score = 0
  union all select 'framed_1', count(*) from solved where game_id = 'framed' and numeric_score = 1
  union all select 'worldle_1', count(*) from solved where game_id = 'worldle' and numeric_score = 1
  union all select 'immaculate_9', count(*) from mine where game_id = 'immaculate' and result_text ~ '(^|[^0-9])9/9'
  union all select 'duotrigordle_34', count(*) from solved where game_id = 'duotrigordle' and numeric_score <= 34
  union all select 'boxoffice_400', count(*) from solved where game_id = 'boxoffice' and numeric_score >= 400
  union all select 'servers_owned', count(*) from public.servers where owner_id = p_user_id
  union all select 'servers_joined', count(*) from public.server_members where user_id = p_user_id
  union all select 'biggest_server', coalesce(max(players), 0)
    from (
      select count(*) as players
      from public.server_members m
      where m.server_id in (select server_id from public.server_members where user_id = p_user_id)
      group by m.server_id
    ) b;
$$;

revoke all on function public.dgh_ranked_results(uuid, date) from public, anon, authenticated;
revoke all on function public.dgh_period_awards(uuid, date) from public, anon, authenticated;
revoke all on function public.dgh_player_metrics(uuid, date) from public, anon, authenticated;


-- Achievements for a card: every tier with the player's progress.
create or replace function public.player_achievements(p_user_id uuid, p_today date)
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

  select coalesce(
    json_agg(
      json_build_object(
        'id', a.id,
        'tier', a.tier,
        'name', a.name,
        'icon', a.icon,
        'description', a.description,
        'threshold', a.threshold,
        'coins', a.coins,
        'progress', coalesce(m.value, 0)
      )
      order by a.sort_order, a.tier
    ),
    '[]'::json
  )
  into result
  from public.achievements a
  left join public.dgh_player_metrics(p_user_id, p_today) m on m.metric = a.metric;

  return result;
end;
$$;


-- Coins are worked out from results every time, so they can't be
-- edited directly and stay right if a result is changed.
--   +5 for each day with a result, +2 per result (up to 5 a day)
--   +15 per game-day won in a server with 2+ players (once per
--       game-day, however many servers you won it in)
--   +100 week / +300 month awards (see dgh_period_awards)
--   +25 / 50 / 100 / 200 per badge tier unlocked
-- History is only returned for your own card.
create or replace function public.player_coins(p_user_id uuid, p_today date)
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

  with daily as (
    select play_date, count(*) as results
    from public.daily_scores
    where user_id = p_user_id and play_date <= p_today
    group by play_date
  ),
  won as (
    select distinct r.game_id, r.play_date
    from public.dgh_ranked_results(p_user_id, p_today) r
    where r.user_id = p_user_id and r.tier = 1 and r.place = 1 and r.players >= 2
  ),
  ledger as (
    select
      d.play_date as day,
      'played' as kind,
      'Played ' || d.results || case when d.results = 1 then ' game' else ' games' end as label,
      5 + least(d.results, 5)::int * 2 as amount
    from daily d
    union all
    select w.play_date, 'win', 'Won ' || coalesce(g.name, w.game_id), 15
    from won w
    left join public.games g on g.game_key = w.game_id
    union all
    select
      a.period_end,
      a.period || '_' || a.kind,
      case a.kind when 'wins' then 'Most wins' else 'Best average place' end
        || ' in ' || a.server_name
        || case a.period
             when 'week' then ' (week of ' || to_char(a.period_start, 'Mon FMDD') || ')'
             else ' (' || to_char(a.period_start, 'FMMonth YYYY') || ')'
           end,
      case a.period when 'week' then 100 else 300 end
    from public.dgh_period_awards(p_user_id, p_today) a
    union all
    select
      null::date,
      'badge',
      'Badge: ' || a.name
        || case when max(a.tier) over (partition by a.id) > 1
             then ' ' || (array['Bronze', 'Silver', 'Gold', 'Diamond'])[a.tier]
             else ''
           end,
      a.coins
    from public.achievements a
    join public.dgh_player_metrics(p_user_id, p_today) m on m.metric = a.metric
    where m.value >= a.threshold
  )
  select json_build_object(
    'balance', (select coalesce(sum(amount), 0) from ledger),
    'history',
      case
        when p_user_id = me then (
          select coalesce(json_agg(json_build_object('day', day, 'label', label, 'amount', amount)), '[]'::json)
          from (
            select * from ledger
            order by day desc nulls first, amount desc, label
            limit 80
          ) recent
        )
      end
  )
  into result;

  return result;
end;
$$;

revoke all on function public.player_achievements(uuid, date) from public, anon;
revoke all on function public.player_coins(uuid, date) from public, anon;
grant execute on function public.player_achievements(uuid, date) to authenticated;
grant execute on function public.player_coins(uuid, date) to authenticated;

-- Check: should list 19 achievements and the new functions.
select 'achievements' as item, (select count(distinct id) from public.achievements)::text as value
union all
select 'player_achievements function', (to_regprocedure('public.player_achievements(uuid, date)') is not null)::text
union all
select 'player_coins function', (to_regprocedure('public.player_coins(uuid, date)') is not null)::text;
