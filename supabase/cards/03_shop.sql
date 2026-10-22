-- Player cards, step 3: the shop. Spend coins on icons, card frames,
-- name colors and titles; some items are unlocked by badges instead.
-- Safe to run again. Run after 02_achievements_and_coins.sql.

create table if not exists public.shop_items (
  id text primary key,
  kind text not null check (kind in ('icon', 'frame', 'name_color', 'title')),
  name text not null,
  value text not null,
  price integer check (price > 0),
  unlock_id text,
  unlock_tier integer,
  sort_order integer not null,
  check ((price is null) <> (unlock_id is null))
);

alter table public.shop_items enable row level security;

drop policy if exists "Anyone signed in reads the shop" on public.shop_items;
create policy "Anyone signed in reads the shop" on public.shop_items
  for select to authenticated
  using (true);

revoke all on public.shop_items from anon, authenticated;
grant select on public.shop_items to authenticated;

-- price = coins; unlock_id + unlock_tier = earned with that badge tier
insert into public.shop_items (id, kind, name, value, price, unlock_id, unlock_tier, sort_order) values
  ('icon_crown',     'icon', 'Crown',        '👑', 300, null, null, 1),
  ('icon_gem',       'icon', 'Gem',          '💎', 300, null, null, 2),
  ('icon_dragon',    'icon', 'Dragon',       '🐉', 400, null, null, 3),
  ('icon_rocket',    'icon', 'Rocket',       '🚀', 250, null, null, 4),
  ('icon_unicorn',   'icon', 'Unicorn',      '🦄', 250, null, null, 5),
  ('icon_bolt',      'icon', 'Lightning',    '⚡', 200, null, null, 6),
  ('icon_wizard',    'icon', 'Wizard',       '🧙', 400, null, null, 7),
  ('icon_robot',     'icon', 'Robot',        '🤖', 300, null, null, 8),
  ('icon_alien',     'icon', 'Alien',        '👽', 300, null, null, 9),
  ('icon_lion',      'icon', 'Lion',         '🦁', 250, null, null, 10),
  ('icon_trophy',    'icon', 'Trophy',       '🏆', null, 'week_champ', 1, 11),
  ('icon_fire',      'icon', 'Fire',         '🔥', null, 'on_fire', 2, 12),
  ('frame_gold',     'frame', 'Gold frame',     'gold',    500, null, null, 20),
  ('frame_neon',     'frame', 'Neon frame',     'neon',    400, null, null, 21),
  ('frame_ice',      'frame', 'Ice frame',      'ice',     400, null, null, 22),
  ('frame_rainbow',  'frame', 'Rainbow frame',  'rainbow', 800, null, null, 23),
  ('frame_fire',     'frame', 'Fire frame',     'fire',    null, 'on_fire', 2, 24),
  ('frame_crown',    'frame', 'Crown frame',    'crown',   null, 'month_champ', 1, 25),
  ('frame_diamond',  'frame', 'Diamond frame',  'diamond', null, 'winner', 4, 26),
  ('name_gold',      'name_color', 'Gold name',    'gold',    300, null, null, 30),
  ('name_mint',      'name_color', 'Mint name',    'mint',    200, null, null, 31),
  ('name_pink',      'name_color', 'Pink name',    'pink',    200, null, null, 32),
  ('name_sky',       'name_color', 'Sky name',     'sky',     200, null, null, 33),
  ('name_rainbow',   'name_color', 'Rainbow name', 'rainbow', 600, null, null, 34),
  ('name_diamond',   'name_color', 'Diamond name', 'diamond', null, 'krillionaire', 2, 35),
  ('title_grinder',  'title', 'Daily Grinder',    'Daily Grinder',    150, null, null, 40),
  ('title_puzzle',   'title', 'Puzzle Pro',       'Puzzle Pro',       200, null, null, 41),
  ('title_wordle',   'title', 'Wordle Wizard',    'Wordle Wizard',    250, null, null, 42),
  ('title_conn',     'title', 'Connections King', 'Connections King', 250, null, null, 43),
  ('title_krillion', 'title', 'Krillion Krusher', 'Krillion Krusher', 250, null, null, 44),
  ('title_trivia',   'title', 'Trivia Titan',     'Trivia Titan',     250, null, null, 45),
  ('title_geo',      'title', 'Geo Genius',       'Geo Genius',       250, null, null, 46),
  ('title_streak',   'title', 'Streak Machine',   'Streak Machine',   300, null, null, 47),
  ('title_champ',    'title', 'Champion',         'Champion',         null, 'month_champ', 1, 48),
  ('title_unstoppable', 'title', 'Unstoppable',   'Unstoppable',      null, 'on_fire', 3, 49)
on conflict (id) do update set
  kind = excluded.kind, name = excluded.name, value = excluded.value, price = excluded.price,
  unlock_id = excluded.unlock_id, unlock_tier = excluded.unlock_tier, sort_order = excluded.sort_order;


-- What each player bought. Only buy_item() adds rows.
create table if not exists public.purchases (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  price integer not null,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.purchases enable row level security;

drop policy if exists "View own purchases" on public.purchases;
create policy "View own purchases" on public.purchases
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;


-- Equipped items on the card (item ids).
alter table public.player_cards add column if not exists frame text;
alter table public.player_cards add column if not exists name_color text;
alter table public.player_cards add column if not exists title text;

-- Shop icons are allowed from now on; the trigger below checks them.
alter table public.player_cards
  drop constraint if exists player_cards_icon_check;


-- True when the player bought the item or has the badge tier that unlocks it.
create or replace function public.dgh_owns_item(p_user_id uuid, p_item_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.purchases
      where user_id = p_user_id and item_id = p_item_id
    )
    or exists (
      select 1
      from public.shop_items i
      join public.achievements a on a.id = i.unlock_id and a.tier = i.unlock_tier
      join public.dgh_player_metrics(p_user_id, current_date) m on m.metric = a.metric
      where i.id = p_item_id and m.value >= a.threshold
    );
$$;

revoke all on function public.dgh_owns_item(uuid, text) from public, anon, authenticated;


-- Cards can only use free icons and items the player owns.
create or replace function public.dgh_check_card_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.icon is distinct from old.icon)
     and new.icon not in (
    '🦊', '🐸', '🦖', '🐙', '🦉', '🐼', '🐯', '🐨',
    '🐧', '🦈', '🐝', '🦋', '🎯', '🧩', '🎬', '🌍',
    '🦐', '⚾', '🏈', '🏀', '🎲', '🧠', '🎮', '🍕'
  )
     and not exists (
       select 1 from public.shop_items i
       where i.kind = 'icon' and i.value = new.icon
         and public.dgh_owns_item(new.user_id, i.id)
     ) then
    raise exception 'You don''t own that icon yet' using errcode = 'check_violation';
  end if;

  if (tg_op = 'INSERT' or new.frame is distinct from old.frame)
     and new.frame is not null
     and not exists (
       select 1 from public.shop_items i
       where i.id = new.frame and i.kind = 'frame'
         and public.dgh_owns_item(new.user_id, i.id)
     ) then
    raise exception 'You don''t own that frame yet' using errcode = 'check_violation';
  end if;

  if (tg_op = 'INSERT' or new.name_color is distinct from old.name_color)
     and new.name_color is not null
     and not exists (
       select 1 from public.shop_items i
       where i.id = new.name_color and i.kind = 'name_color'
         and public.dgh_owns_item(new.user_id, i.id)
     ) then
    raise exception 'You don''t own that name color yet' using errcode = 'check_violation';
  end if;

  if (tg_op = 'INSERT' or new.title is distinct from old.title)
     and new.title is not null
     and not exists (
       select 1 from public.shop_items i
       where i.id = new.title and i.kind = 'title'
         and public.dgh_owns_item(new.user_id, i.id)
     ) then
    raise exception 'You don''t own that title yet' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.dgh_check_card_items() from public, anon, authenticated;

drop trigger if exists player_cards_items on public.player_cards;
create trigger player_cards_items
  before insert or update on public.player_cards
  for each row execute function public.dgh_check_card_items();


-- Coins are worked out from results every time, so they can't be
-- edited directly and stay right if a result is changed.
--   +5 for each day with a result, +2 per result (up to 5 a day)
--   +15 per game-day won in a server with 2+ players (once per
--       game-day, however many servers you won it in)
--   +100 week / +300 month awards (see dgh_period_awards)
--   +25 / 50 / 100 / 200 per badge tier unlocked
--   minus whatever was spent in the shop
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
    union all
    select p.purchased_at::date, 'purchase', 'Bought ' || i.name, -p.price
    from public.purchases p
    join public.shop_items i on i.id = p.item_id
    where p.user_id = p_user_id
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


revoke all on function public.player_coins(uuid, date) from public, anon;
grant execute on function public.player_coins(uuid, date) to authenticated;


-- Buy an item with coins. p_today is the player's date (kept within
-- a day of the server's, for time zones).
create or replace function public.buy_item(p_item_id text, p_today date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  item public.shop_items;
  balance integer;
begin
  if me is null then
    raise exception 'Log in first';
  end if;

  -- One purchase at a time per player, so coins can't be spent twice.
  perform pg_advisory_xact_lock(hashtext('dgh_coins_' || me::text));

  select * into item from public.shop_items where id = p_item_id;

  if not found then
    raise exception 'That item is not in the shop.';
  end if;

  if item.price is null then
    raise exception 'This item can''t be bought. Unlock it with a badge.';
  end if;

  if exists (select 1 from public.purchases where user_id = me and item_id = p_item_id) then
    raise exception 'You already own this.';
  end if;

  balance :=
    (public.player_coins(
      me,
      least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1)
    )->>'balance')::integer;

  if balance < item.price then
    raise exception 'Not enough coins.';
  end if;

  insert into public.purchases (user_id, item_id, price)
  values (me, p_item_id, item.price);

  return json_build_object('balance', balance - item.price);
end;
$$;

revoke all on function public.buy_item(text, date) from public, anon;
grant execute on function public.buy_item(text, date) to authenticated;

-- Check: number of shop items and that buying is ready.
select 'shop items' as item, (select count(*) from public.shop_items)::text as value
union all
select 'buy_item function', (to_regprocedure('public.buy_item(text, date)') is not null)::text;
