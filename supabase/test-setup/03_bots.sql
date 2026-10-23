-- TEST PROJECT ONLY. Do not run this in the real database.
--
-- Adds a computer player, @robo_bot, so the Play tab games can be tried
-- without a second person. It joins every Server (old and new), always
-- shows as online, accepts challenges straight away, and takes its turns
-- whenever the app checks in on a game. Safe to run again.
-- Needs the servers, cards and play files first (all of play/01 to 03).

do $$
begin
  if to_regprocedure('public.dgh_bot_hook(uuid)') is null then
    raise exception 'Run supabase/play/03_versus_games.sql (the latest version) first, then this file again.';
  end if;
end;
$$;

create table if not exists public.dgh_bots (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.dgh_bots enable row level security;
revoke all on public.dgh_bots from anon, authenticated;


-- The bot's account (no password, so nobody can log in as it), profile,
-- player card, presence and Server memberships.
do $$
declare
  bot uuid := '0b0b0b0b-0000-4000-8000-000000000001';
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'aud'
  ) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    )
    values (
      '00000000-0000-0000-0000-000000000000', bot, 'authenticated', 'authenticated',
      'robo_bot@dgh-test.invalid', '', now(), now(), now(),
      '{"provider": "email", "providers": ["email"]}', '{}'
    )
    on conflict (id) do nothing;
  else
    -- The local test database's simple stand-in for auth.users
    insert into auth.users (id) values (bot) on conflict (id) do nothing;
  end if;

  insert into public.dgh_bots (user_id) values (bot) on conflict do nothing;

  insert into public.profiles (user_id, username, display_name)
  values (bot, 'robo_bot', 'Robo 🤖')
  on conflict (user_id) do nothing;

  insert into public.purchases (user_id, item_id, price)
  values (bot, 'icon_robot', 0)
  on conflict do nothing;

  insert into public.player_cards (user_id, icon, color, bio)
  values (bot, '🤖', 'slate', 'Computer player for testing. Beep boop.')
  on conflict (user_id) do nothing;

  -- "Seen" far in the future, so it always shows as online.
  insert into public.player_presence (user_id, last_seen)
  values (bot, '2100-01-01')
  on conflict (user_id) do update set last_seen = '2100-01-01';

  insert into public.server_members (server_id, user_id, role)
  select s.id, b.user_id, 'member'
  from public.servers s cross join public.dgh_bots b
  on conflict do nothing;
end;
$$;


-- New Servers get the bot too.
create or replace function public.dgh_bot_join_server()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.server_members (server_id, user_id, role)
  select new.id, b.user_id, 'member' from public.dgh_bots b
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.dgh_bot_join_server() from public, anon, authenticated;

drop trigger if exists servers_add_bots on public.servers;
create trigger servers_add_bots
  after insert on public.servers
  for each row execute function public.dgh_bot_join_server();


-- ---------- How the bot plays each game ----------

-- Wordle Duel: a guess every few seconds, always one that fits what
-- its earlier guesses showed (so it usually solves in 3 to 5).
create or replace function public.dgh_bot_wordle(d public.duels, bot uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  guesses integer;
  last_at timestamptz;
  solved boolean;
  other_done boolean;
  pick text;
begin
  loop
    select status into d.status from public.duels where id = d.id;
    exit when d.status <> 'active';

    select count(*), max(created_at), coalesce(bool_or(pattern = 'GGGGG'), false)
    into guesses, last_at, solved
    from public.duel_guesses where duel_id = d.id and user_id = bot;

    exit when solved or guesses >= 6;

    -- Once you're done, it plays the rest straight away; until then,
    -- a guess every few seconds.
    select coalesce(bool_or(pattern = 'GGGGG'), false) or count(*) >= 6 into other_done
    from public.duel_guesses where duel_id = d.id and user_id <> bot;

    exit when not other_done and last_at > now() - interval '3 seconds';

    if guesses = 0 then
      pick := (array['slate', 'crane', 'trace', 'stare', 'raise', 'arise', 'later', 'alert'])[1 + floor(random() * 8)::integer];
    else
      select w.word into pick
      from public.duel_words w
      where not exists (
        select 1 from public.duel_guesses x
        where x.duel_id = d.id and x.user_id = bot
          and (x.guess = w.word or public.dgh_wordle_pattern(x.guess, w.word) <> x.pattern)
      )
      order by random()
      limit 1;
    end if;

    perform public.duel_guess(d.id, pick);

    exit when not other_done;
  end loop;
end;
$$;


-- Word Race: finds some of the 5-letter words in the letters (and now
-- and then the whole 9-letter word). Its turn is played all at once.
create or replace function public.dgh_bot_word_race(d public.duels, bot uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.versus_plays where duel_id = d.id and user_id = bot) then
    return;
  end if;

  insert into public.versus_plays (duel_id, user_id, started_at, finished_at)
  values (d.id, bot, now() - interval '2 minutes', now());

  insert into public.versus_moves (duel_id, user_id, n, served_at, answered_at, answer, correct, points)
  select d.id, bot, row_number() over (), now(), now(), found.word, true, public.dgh_word_points(found.word)
  from (
    (select w.word from public.duel_words w
     where public.dgh_uses_letters(w.word, d.setup ->> 'letters') and random() < 0.6
     order by random() limit 10)
    union
    (select d.answer where random() < 0.15)
  ) found;

  update public.versus_plays
  set score = (select coalesce(sum(points), 0) from public.versus_moves where duel_id = d.id and user_id = bot)
  where duel_id = d.id and user_id = bot;
end;
$$;


-- Trivia: about 7 in 10 right, taking 2 to 9 seconds a question.
create or replace function public.dgh_bot_trivia(d public.duels, bot uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i integer;
  right_pos integer;
  ok boolean;
  secs numeric;
  total_ms integer := 0;
  right_count integer := 0;
begin
  if exists (select 1 from public.versus_plays where duel_id = d.id and user_id = bot) then
    return;
  end if;

  insert into public.versus_plays (duel_id, user_id, started_at, finished_at)
  values (d.id, bot, now() - interval '1 minute', now());

  for i in 1..10 loop
    select (k - 1)::integer into right_pos
    from jsonb_array_elements(d.setup -> 'questions' -> (i - 1) -> 'order') with ordinality e(x, k)
    where (x::text)::integer = 0;

    ok := random() < 0.7;
    secs := 2 + random() * 7;

    insert into public.versus_moves (duel_id, user_id, n, served_at, answered_at, answer, correct, points)
    values (d.id, bot, i, now() - make_interval(secs => secs), now(),
            (case when ok then right_pos else (right_pos + 1) % 4 end)::text, ok, ok::integer);

    total_ms := total_ms + (secs * 1000)::integer;
    right_count := right_count + ok::integer;
  end loop;

  update public.versus_plays set score = right_count, time_ms = total_ms
  where duel_id = d.id and user_id = bot;
end;
$$;


-- Higher or Lower: each pick has a 4 in 5 chance of being right.
create or replace function public.dgh_bot_higher_lower(d public.duels, bot uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  ok boolean;
  secs numeric;
  total_ms integer := 0;
  streak integer := 0;
begin
  if exists (select 1 from public.versus_plays where duel_id = d.id and user_id = bot) then
    return;
  end if;

  insert into public.versus_plays (duel_id, user_id, started_at, finished_at)
  values (d.id, bot, now() - interval '1 minute', now());

  loop
    n := n + 1;
    exit when n > jsonb_array_length(d.setup -> 'pairs');

    ok := random() < 0.8;
    secs := 2 + random() * 4;

    insert into public.versus_moves (duel_id, user_id, n, served_at, answered_at, answer, correct, points)
    values (d.id, bot, n, now() - make_interval(secs => secs), now(), '0', ok, ok::integer);

    total_ms := total_ms + (secs * 1000)::integer;
    exit when not ok;
    streak := streak + 1;
  end loop;

  update public.versus_plays set score = streak, time_ms = total_ms
  where duel_id = d.id and user_id = bot;
end;
$$;


-- Mind Meld: says a word in round 1 straight away; after that it waits
-- for yours, and gets more likely to match it as the rounds go on.
-- Returns true if it said a word.
create or replace function public.dgh_bot_mind_meld(d public.duels, bot uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  game jsonb := public.dgh_meld_view(d, bot)::jsonb;
  this_round integer := (game ->> 'round')::integer;
  theirs text;
  pick text;
begin
  if game ->> 'my_word' is not null or (this_round > 1 and not (game ->> 'they_ready')::boolean) then
    return false;
  end if;

  select word into theirs from public.mind_meld_words
  where duel_id = d.id and user_id <> bot and round = this_round;

  if theirs is not null and this_round > 1 and random() < least(0.85, 0.15 + 0.15 * this_round) then
    pick := theirs;
  else
    select x into pick
    from unnest(array[
      'apple', 'ocean', 'music', 'pizza', 'summer', 'dog', 'coffee', 'moon', 'school', 'movie',
      'beach', 'money', 'tree', 'city', 'phone', 'fire', 'snow', 'book', 'car', 'garden',
      'river', 'dream', 'party', 'cake', 'star', 'rain', 'bread', 'game', 'light', 'ghost',
      'train', 'candle', 'island', 'robot', 'cookie', 'castle', 'forest', 'guitar', 'rocket', 'cheese',
      'tiger', 'winter', 'cloud', 'shoe', 'clock', 'window', 'mountain', 'dinner', 'honey', 'paint',
      'ice', 'sun', 'wind', 'gold', 'king', 'space', 'storm', 'smile', 'heart', 'salt'
    ]) x
    where x not in (select word from public.mind_meld_words where duel_id = d.id)
    order by random()
    limit 1;
  end if;

  perform public.mind_meld_say(d.id, pick);
  return true;
end;
$$;


-- Dial In: clues like "Kind of Hot"; guesses within about 12 of the
-- target. Returns true if it did something.
create or replace function public.dgh_bot_dial_in(d public.duels, bot uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  game jsonb := public.dgh_dial_view(d, bot)::jsonb;
  this_round integer := (game ->> 'round')::integer;
  cur jsonb;
  target integer;
begin
  if this_round > 6 then
    return false;
  end if;

  cur := game -> 'rounds' -> (this_round - 1);
  target := (d.setup -> 'rounds' -> (this_round - 1) ->> 'target')::integer;

  if (cur ->> 'my_clue')::boolean and cur ->> 'clue' is null then
    perform public.dial_clue(d.id, case
      when target < 15 then 'Very ' || (cur ->> 'left')
      when target < 38 then 'Kind of ' || (cur ->> 'left')
      when target <= 62 then 'Right in the middle'
      when target <= 85 then 'Kind of ' || (cur ->> 'right')
      else 'Very ' || (cur ->> 'right')
    end);
    return true;
  end if;

  if not (cur ->> 'my_clue')::boolean and cur ->> 'clue' is not null and cur ->> 'guess' is null then
    perform public.dial_guess(d.id, greatest(0, least(100, target + (random() * 24 - 12)::integer)));
    return true;
  end if;

  return false;
end;
$$;


-- Called by dgh_bot_hook (in 03_versus_games.sql) whenever someone's
-- app looks at a game. If the bot is in it, the bot accepts and plays.
-- It acts as itself by setting the signed-in user for a moment.
create or replace function public.dgh_bot_play(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
  bot uuid;
  signed_in text := current_setting('request.jwt.claim.sub', true);
  i integer;
begin
  select * into d from public.duels where id = p_duel;

  if not found or d.status not in ('pending', 'active') then
    return;
  end if;

  select user_id into bot from public.dgh_bots where user_id in (d.challenger, d.opponent);

  if bot is null then
    return;
  end if;

  perform set_config('dgh.bot_busy', '1', true);
  perform set_config('request.jwt.claim.sub', bot::text, true);

  begin
    if d.status = 'pending' and d.opponent = bot then
      perform public.respond_duel(d.id, true);
      select * into d from public.duels where id = p_duel;
    end if;

    if d.status = 'active' then
      if d.game = 'wordle_duel' then
        perform public.dgh_bot_wordle(d, bot);
      elsif d.game = 'word_race' then
        perform public.dgh_bot_word_race(d, bot);
      elsif d.game = 'trivia' then
        perform public.dgh_bot_trivia(d, bot);
      elsif d.game = 'higher_lower' then
        perform public.dgh_bot_higher_lower(d, bot);
      elsif d.game = 'mind_meld' then
        perform public.dgh_bot_mind_meld(d, bot);
      elsif d.game = 'dial_in' then
        -- e.g. guess your clue, then give the next one
        for i in 1..2 loop
          select * into d from public.duels where id = p_duel;
          exit when d.status <> 'active' or not public.dgh_bot_dial_in(d, bot);
        end loop;
      end if;
    end if;
  exception when others then
    raise warning 'Bot move failed: %', sqlerrm;
  end;

  perform set_config('request.jwt.claim.sub', coalesce(signed_in, ''), true);
  perform set_config('dgh.bot_busy', '', true);
end;
$$;

revoke all on function public.dgh_bot_wordle(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_word_race(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_trivia(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_higher_lower(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_mind_meld(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_dial_in(public.duels, uuid) from public, anon, authenticated;
revoke all on function public.dgh_bot_play(uuid) from public, anon, authenticated;

-- Challenges to the bot are accepted the moment they're sent, and the
-- bot makes its first move then too.
create or replace function public.dgh_bot_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and exists (select 1 from public.dgh_bots where user_id = new.opponent) then
    new.status := 'active';
    new.accepted_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.dgh_bot_first_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.dgh_bots where user_id in (new.challenger, new.opponent)) then
    perform public.dgh_bot_play(new.id);
  end if;

  return null;
end;
$$;

revoke all on function public.dgh_bot_accept() from public, anon, authenticated;
revoke all on function public.dgh_bot_first_move() from public, anon, authenticated;

drop trigger if exists duels_bot_accept on public.duels;
create trigger duels_bot_accept
  before insert on public.duels
  for each row execute function public.dgh_bot_accept();

drop trigger if exists duels_bot_first_move on public.duels;
create trigger duels_bot_first_move
  after insert on public.duels
  for each row execute function public.dgh_bot_first_move();

-- Challenges already waiting on the bot: accept them now.
update public.duels
set status = 'active', accepted_at = now()
where status = 'pending' and opponent in (select user_id from public.dgh_bots);


-- Check: the bot is set up and in your Servers.
select 'bot' as item, (select username from public.profiles where user_id = '0b0b0b0b-0000-4000-8000-000000000001') as value
union all
select 'Servers it joined', (select count(*)::text from public.server_members where user_id = '0b0b0b0b-0000-4000-8000-000000000001');
