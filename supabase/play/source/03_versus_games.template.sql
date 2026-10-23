-- Play tab, step 3: more games with friends (Word Race, Trivia Showdown,
-- Higher or Lower, Mind Meld and Dial In). Safe to run again. Needs
-- 01_wordle_duel.sql first.
-- If you ever run 01 again, run this file again after it.
--
-- Same idea as Wordle Duel: you each play your own turn (the challenger
-- can start right away), and the answers stay in the database. Your
-- opponent's details stay hidden until you're both done.
--
-- Word list: SCOWL (Copyright 2000-2016 Kevin Atkinson; free to use with
-- this notice). Trivia questions and Higher or Lower facts written for
-- this app.

-- Let duels hold the new games and their private setup.
alter table public.duels drop constraint if exists duels_game_check;
alter table public.duels add constraint duels_game_check
  check (game in ('wordle_duel', 'word_race', 'trivia', 'higher_lower', 'mind_meld', 'dial_in'));
alter table public.duels add column if not exists setup jsonb;

-- Each player's turn in a game.
create table if not exists public.versus_plays (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer not null default 0,
  time_ms integer not null default 0,
  primary key (duel_id, user_id)
);

-- Every word found, question answered or pick made.
create table if not exists public.versus_moves (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  n integer not null check (n > 0),
  served_at timestamptz not null default now(),
  answered_at timestamptz,
  answer text,
  correct boolean,
  points integer not null default 0,
  primary key (duel_id, user_id, n)
);

-- Mind Meld: the word each player said in each round.
create table if not exists public.mind_meld_words (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  round integer not null check (round between 1 and 20),
  word text not null,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id, round)
);

alter table public.mind_meld_words enable row level security;
revoke all on public.mind_meld_words from anon, authenticated;

-- Dial In: the scales (two opposite ends) and each round's clue and guess.
create table if not exists public.dial_scales (
  id integer primary key,
  left_end text not null,
  right_end text not null
);

create table if not exists public.dial_rounds (
  duel_id uuid not null references public.duels (id) on delete cascade,
  round integer not null check (round between 1 and 6),
  clue text,
  clue_at timestamptz,
  guess integer check (guess between 0 and 100),
  guessed_at timestamptz,
  points integer,
  primary key (duel_id, round)
);

alter table public.dial_scales enable row level security;
alter table public.dial_rounds enable row level security;
revoke all on public.dial_scales from anon, authenticated;
revoke all on public.dial_rounds from anon, authenticated;

create table if not exists public.word_race_seeds (
  word text primary key check (word ~ '^[a-z]{9}$')
);

create table if not exists public.trivia_questions (
  id integer primary key,
  category text not null,
  question text not null,
  choices text[] not null check (cardinality(choices) = 4)  -- the right one first
);

create table if not exists public.hl_categories (
  category text primary key,
  prompt text not null,
  unit text not null
);

create table if not exists public.hl_items (
  id integer primary key,
  category text not null references public.hl_categories (category),
  name text not null,
  value numeric not null check (value > 0)
);

alter table public.versus_plays enable row level security;
alter table public.versus_moves enable row level security;
alter table public.word_race_seeds enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.hl_categories enable row level security;
alter table public.hl_items enable row level security;
revoke all on public.versus_plays from anon, authenticated;
revoke all on public.versus_moves from anon, authenticated;
revoke all on public.word_race_seeds from anon, authenticated;
revoke all on public.trivia_questions from anon, authenticated;
revoke all on public.hl_categories from anon, authenticated;
revoke all on public.hl_items from anon, authenticated;


-- ---------- Game data ----------

insert into public.word_race_seeds (word) values
{SEEDS}
on conflict do nothing;

insert into public.trivia_questions (id, category, question, choices) values
{TRIVIA}
on conflict (id) do update
set category = excluded.category, question = excluded.question, choices = excluded.choices;

insert into public.dial_scales (id, left_end, right_end) values
{DIAL}
on conflict (id) do update
set left_end = excluded.left_end, right_end = excluded.right_end;

insert into public.hl_categories (category, prompt, unit) values
  ('population', 'Which country has more people?', 'people'),
  ('us_state', 'Which US state has more people? (2020 census)', 'people'),
  ('box_office', 'Which movie made more at the box office worldwide?', 'dollars'),
  ('nba_points', 'Who scored more NBA career points?', 'points'),
  ('mlb_home_runs', 'Who hit more MLB career home runs?', 'home runs'),
  ('grand_slams', 'Who won more Grand Slam singles titles?', 'titles'),
  ('mountain', 'Which mountain is taller?', 'meters')
on conflict (category) do update
set prompt = excluded.prompt, unit = excluded.unit;

insert into public.hl_items (id, category, name, value) values
{HL}
on conflict (id) do update
set category = excluded.category, name = excluded.name, value = excluded.value;


-- ---------- Rules ----------

-- Seconds you get: the whole Word Race, each trivia question, each pick.
create or replace function public.dgh_versus_seconds(p_game text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_game
    when 'word_race' then 120
    when 'trivia' then 12
    when 'higher_lower' then 10
  end;
$$;


create or replace function public.dgh_word_points(p_word text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case length(p_word)
    when 3 then 1 when 4 then 2 when 5 then 4 when 6 then 7
    when 7 then 10 when 8 then 14 when 9 then 20 else 0
  end;
$$;


-- True when p_word only uses the letters in p_letters (each one once).
create or replace function public.dgh_uses_letters(p_word text, p_letters text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  left_over text := p_letters;
  pos integer;
  i integer;
begin
  for i in 1..length(p_word) loop
    pos := strpos(left_over, substr(p_word, i, 1));
    if pos = 0 then
      return false;
    end if;
    left_over := overlay(left_over placing '' from pos for 1);
  end loop;

  return true;
end;
$$;


-- The private setup for a new game: the letters, the questions or
-- the pairs. Both players get the same one.
create or replace function public.dgh_versus_setup(p_game text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seed text;
  pairs jsonb := '[]'::jsonb;
  pick_category text;
  pair integer[];
  i integer;
begin
  if p_game = 'word_race' then
    select word into seed from public.word_race_seeds order by random() limit 1;

    return jsonb_build_object(
      'word', seed,
      'letters', (select string_agg(c, '' order by random()) from regexp_split_to_table(seed, '') c)
    );
  end if;

  if p_game = 'trivia' then
    return jsonb_build_object('questions', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'order', (select jsonb_agg(x order by random()) from generate_series(0, 3) x)
      ))
      from (select id from public.trivia_questions order by random() limit 10) q
    ));
  end if;

  if p_game = 'mind_meld' then
    return '{}'::jsonb;
  end if;

  if p_game = 'dial_in' then
    -- 6 different scales, each with a hidden target from 3 to 97.
    return jsonb_build_object('rounds', (
      select jsonb_agg(jsonb_build_object('scale', id, 'target', 3 + floor(random() * 95)::integer))
      from (select id from public.dial_scales order by random() limit 6) s
    ));
  end if;

  if p_game = 'higher_lower' then
    -- 40 pairs from the same category, at least 25% apart.
    for i in 1..40 loop
      select category into pick_category
      from public.hl_categories order by random() limit 1;

      select case when random() < 0.5 then array[a.id, b.id] else array[b.id, a.id] end
      into pair
      from public.hl_items a
      join public.hl_items b on b.category = a.category and a.value >= b.value * 1.25
      where a.category = pick_category
      order by random()
      limit 1;

      pairs := pairs || jsonb_build_array(to_jsonb(pair));
    end loop;

    return jsonb_build_object('pairs', pairs);
  end if;

  raise exception 'Unknown game.';
end;
$$;

revoke all on function public.dgh_versus_setup(text) from public, anon, authenticated;


-- Trivia: a point for each question you got right faster than them.
create or replace function public.dgh_trivia_points(p_duel uuid, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.versus_moves m
  where m.duel_id = p_duel
    and m.user_id = p_user
    and m.correct
    and not exists (
      select 1 from public.versus_moves o
      where o.duel_id = p_duel
        and o.user_id <> p_user
        and o.n = m.n
        and o.correct
        and o.answered_at - o.served_at < m.answered_at - m.served_at
    );
$$;

revoke all on function public.dgh_trivia_points(uuid, uuid) from public, anon, authenticated;


-- Close turns that ran out of time, and finish the game once both
-- players are done.
create or replace function public.dgh_versus_settle(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
  secs integer;
  a public.versus_plays;
  b public.versus_plays;
  a_points integer;
  b_points integer;
  champ uuid;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or d.game in ('wordle_duel', 'mind_meld', 'dial_in') then
    return;
  end if;

  secs := public.dgh_versus_seconds(d.game);

  -- Questions or picks left unanswered past the time count as wrong.
  update public.versus_moves
  set answered_at = served_at + make_interval(secs => secs), correct = false
  where duel_id = d.id
    and answered_at is null
    and served_at + make_interval(secs => secs + 1) < now();

  -- Finished turns: Word Race when the clock runs out; Higher or Lower
  -- after a miss; Trivia after question 10. A turn left for 15 minutes
  -- also ends.
  update public.versus_plays p
  set finished_at = now()
  where p.duel_id = d.id
    and p.finished_at is null
    and (
      (d.game = 'word_race' and p.started_at + make_interval(secs => secs + 3) < now())
      or (d.game = 'higher_lower' and exists (
        select 1 from public.versus_moves m
        where m.duel_id = d.id and m.user_id = p.user_id and m.correct = false))
      or (d.game = 'trivia' and (
        select count(*) from public.versus_moves m
        where m.duel_id = d.id and m.user_id = p.user_id and m.answered_at is not null) >= 10)
      or p.started_at + interval '15 minutes' < now()
    );

  if d.status <> 'active' then
    return;
  end if;

  select * into a from public.versus_plays where duel_id = d.id and user_id = d.challenger;
  select * into b from public.versus_plays where duel_id = d.id and user_id = d.opponent;

  if a.finished_at is null or b.finished_at is null then
    return;
  end if;

  if d.game = 'trivia' then
    a_points := public.dgh_trivia_points(d.id, d.challenger);
    b_points := public.dgh_trivia_points(d.id, d.opponent);
  else
    a_points := a.score;
    b_points := b.score;
  end if;

  champ := case
    when a_points > b_points then d.challenger
    when b_points > a_points then d.opponent
    -- Higher or Lower tie: the quicker player wins.
    when d.game = 'higher_lower' and a.time_ms < b.time_ms then d.challenger
    when d.game = 'higher_lower' and b.time_ms < a.time_ms then d.opponent
  end;

  update public.duels
  set status = 'finished', finished_at = now(), winner = champ
  where id = d.id;
end;
$$;

revoke all on function public.dgh_versus_settle(uuid) from public, anon, authenticated;


-- A player's turn as they see it.
create or replace function public.dgh_versus_turn(d public.duels, p_user uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'started', p.started_at is not null,
    'finished', p.finished_at is not null,
    'score', case
      when d.game = 'trivia' and d.status = 'finished' then public.dgh_trivia_points(d.id, p_user)
      else coalesce(p.score, 0)
    end,
    'correct', (select count(*) from public.versus_moves m where m.duel_id = d.id and m.user_id = p_user and m.correct),
    'time_ms', coalesce(p.time_ms, 0)
  )
  from (select 1) one
  left join public.versus_plays p on p.duel_id = d.id and p.user_id = p_user;
$$;

revoke all on function public.dgh_versus_turn(public.duels, uuid) from public, anon, authenticated;


-- Mind Meld as one player sees it: the rounds you've both revealed,
-- your word for this round (theirs stays hidden until you've both
-- said one), and the word you matched on.
create or replace function public.dgh_meld_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select round, word from public.mind_meld_words where duel_id = d.id and user_id = me
  ),
  theirs as (
    select round, word from public.mind_meld_words where duel_id = d.id and user_id <> me
  ),
  done as (
    select m.round, m.word as mine, t.word as theirs
    from mine m join theirs t using (round)
  ),
  now_round as (
    select coalesce(max(round), 0) + 1 as round from done
  )
  select json_build_object(
    'rounds', coalesce((select json_agg(json_build_object('mine', mine, 'theirs', theirs) order by round) from done), '[]'::json),
    'round', (select round from now_round),
    'my_word', (select word from mine where round = (select round from now_round)),
    'they_ready', exists (select 1 from theirs where round = (select round from now_round)),
    'matched', case when d.status = 'finished' then nullif(d.answer, '') end
  );
$$;

revoke all on function public.dgh_meld_view(public.duels, uuid) from public, anon, authenticated;


-- Dial In: points for how close the guess is to the target.
create or replace function public.dgh_dial_points(p_guess integer, p_target integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when abs(p_guess - p_target) <= 4 then 4
    when abs(p_guess - p_target) <= 12 then 3
    when abs(p_guess - p_target) <= 20 then 2
    else 0
  end;
$$;


-- Dial In as one player sees it. The challenger gives the clue in odd
-- rounds, the other player in even rounds. You only see the target
-- when you're the one giving the clue, or once the round is guessed.
create or replace function public.dgh_dial_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with plan as (
    select (r.i)::integer as round,
           (r.x ->> 'target')::integer as target,
           sc.left_end, sc.right_end,
           ((r.i % 2 = 1) = (d.challenger = me)) as my_clue
    from jsonb_array_elements(d.setup -> 'rounds') with ordinality r(x, i)
    join public.dial_scales sc on sc.id = (r.x ->> 'scale')::integer
  ),
  played as (
    select p.*, dr.clue, dr.guess, dr.points
    from plan p
    left join public.dial_rounds dr on dr.duel_id = d.id and dr.round = p.round
  ),
  now_round as (
    select coalesce(min(round) filter (where guess is null), 7) as round from played
  )
  select json_build_object(
    'round', (select round from now_round),
    'total', coalesce((select sum(points) from played), 0),
    'rounds', coalesce((
      select json_agg(json_build_object(
        'round', round,
        'left', left_end,
        'right', right_end,
        'my_clue', my_clue,
        'clue', clue,
        'guess', guess,
        'points', points,
        'target', case when guess is not null or my_clue then target end
      ) order by round)
      from played where round <= (select round from now_round)
    ), '[]'::json)
  );
$$;

revoke all on function public.dgh_dial_view(public.duels, uuid) from public, anon, authenticated;


-- Everything one player may see about a duel (all games). Replaces the
-- Wordle-only version from step 1; Wordle Duel fields stay the same.
create or replace function public.dgh_duel_view(d public.duels, me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select n, guess, pattern from public.duel_guesses
    where duel_id = d.id and user_id = me
  ),
  theirs as (
    select n, pattern from public.duel_guesses
    where duel_id = d.id and user_id <> me
  ),
  them as (
    select case when d.challenger = me then d.opponent else d.challenger end as id
  )
  select json_build_object(
    'id', d.id,
    'game', d.game,
    'status', d.status,
    'is_challenger', d.challenger = me,
    'opponent', (select id from them),
    'winner', d.winner,
    'created_at', d.created_at,
    'finished_at', d.finished_at,
    'my_guesses', coalesce((select json_agg(json_build_object('guess', guess, 'pattern', pattern) order by n) from mine), '[]'::json),
    'their_patterns', coalesce((select json_agg(pattern order by n) from theirs), '[]'::json),
    'last_move_at', (select max(created_at) from public.duel_guesses where duel_id = d.id),
    'answer', case when d.status = 'finished' then d.answer end,
    'meld', case when d.game = 'mind_meld' then public.dgh_meld_view(d, me) end,
    'dial', case when d.game = 'dial_in' then public.dgh_dial_view(d, me) end,
    'me', case when d.game <> 'wordle_duel' then public.dgh_versus_turn(d, me) end,
    -- Their score shows once they're done.
    'them', case when d.game <> 'wordle_duel' then (
      select json_build_object(
        'started', (t ->> 'started')::boolean,
        'finished', (t ->> 'finished')::boolean,
        'score', case when (t ->> 'finished')::boolean then (t ->> 'score')::integer end
      )
      from (select public.dgh_versus_turn(d, (select id from them))::jsonb as t) x
    ) end
  );
$$;

revoke all on function public.dgh_duel_view(public.duels, uuid) from public, anon, authenticated;


-- Look up a duel you're in, after closing anything that timed out.
create or replace function public.dgh_my_duel(p_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  perform public.dgh_versus_settle(p_duel);

  select * into d from public.duels where id = p_duel;

  if not found or (select auth.uid()) not in (d.challenger, d.opponent) then
    raise exception 'That game was not found.';
  end if;

  return d;
end;
$$;

revoke all on function public.dgh_my_duel(uuid) from public, anon, authenticated;


create or replace function public.duel_state(p_duel uuid)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  -- Two steps so the view sees anything the settle step just closed.
  d := public.dgh_my_duel(p_duel);

  return public.dgh_duel_view(d, (select auth.uid()));
end;
$$;


-- Your duels: open ones, plus finished ones from the last 3 days.
create or replace function public.my_duels()
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  open_id uuid;
begin
  for open_id in
    select id from public.duels
    where (select auth.uid()) in (challenger, opponent)
      and status in ('pending', 'active')
      and game <> 'wordle_duel'
  loop
    perform public.dgh_versus_settle(open_id);
  end loop;

  return (
    select coalesce(json_agg(public.dgh_duel_view(d, (select auth.uid())) order by d.created_at desc), '[]'::json)
    from public.duels d
    where (select auth.uid()) in (d.challenger, d.opponent)
      and (d.status in ('pending', 'active') or d.finished_at > now() - interval '3 days')
  );
end;
$$;


-- Challenge someone to one of the new games.
create or replace function public.create_versus(p_opponent uuid, p_game text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  setup jsonb;
  new_id uuid;
begin
  if me is null then
    raise exception 'Log in first';
  end if;

  if p_game not in ('word_race', 'trivia', 'higher_lower', 'mind_meld', 'dial_in') then
    raise exception 'Unknown game.';
  end if;

  if p_opponent is null or p_opponent = me or not public.shares_server_with(p_opponent) then
    raise exception 'You can only challenge people in your servers.';
  end if;

  setup := public.dgh_versus_setup(p_game);

  insert into public.duels (game, challenger, opponent, answer, setup)
  values (p_game, me, p_opponent, coalesce(setup ->> 'word', ''), setup)
  returning id into new_id;

  return new_id;
end;
$$;


-- Load the duel for a move: it must be yours, open, and your turn
-- must have started and not finished.
create or replace function public.dgh_versus_for_move(p_duel uuid, p_game text, p_need_started boolean)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  p public.versus_plays;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game <> p_game then
    raise exception 'That game was not found.';
  end if;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger)) then
    raise exception 'This game is not open.';
  end if;

  select * into p from public.versus_plays where duel_id = d.id and user_id = me;

  if p_need_started and not found then
    raise exception 'Start the game first.';
  end if;

  if p.finished_at is not null then
    raise exception 'Your turn is over.';
  end if;

  return d;
end;
$$;

revoke all on function public.dgh_versus_for_move(uuid, text, boolean) from public, anon, authenticated;


-- Your own turn: what you need to keep playing.
create or replace function public.dgh_versus_mine(d public.duels)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'duel', public.dgh_duel_view(d, (select auth.uid())),
    'letters', case when d.game = 'word_race' and p.started_at is not null then d.setup ->> 'letters' end,
    'seconds_left', case when d.game = 'word_race' and p.started_at is not null and p.finished_at is null then
      greatest(0, ceil(extract(epoch from (p.started_at + interval '120 seconds' - now()))))::integer end,
    'words', case when d.game = 'word_race' then (
      select coalesce(json_agg(json_build_object('word', m.answer, 'points', m.points) order by m.n), '[]'::json)
      from public.versus_moves m where m.duel_id = d.id and m.user_id = (select auth.uid())) end,
    'answered', (select count(*) from public.versus_moves m
      where m.duel_id = d.id and m.user_id = (select auth.uid()) and m.answered_at is not null)
  )
  from (select 1) one
  left join public.versus_plays p on p.duel_id = d.id and p.user_id = (select auth.uid());
$$;

revoke all on function public.dgh_versus_mine(public.duels) from public, anon, authenticated;


-- Start your turn (or pick it back up).
create or replace function public.versus_start(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duels;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game = 'wordle_duel' then
    raise exception 'That game was not found.';
  end if;

  if d.status = 'active' or (d.status = 'pending' and (select auth.uid()) = d.challenger) then
    insert into public.versus_plays (duel_id, user_id)
    values (d.id, (select auth.uid()))
    on conflict do nothing;
  end if;

  return public.dgh_versus_mine(d);
end;
$$;


-- Word Race: send a word you found.
create or replace function public.word_race_word(p_duel uuid, p_word text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  word text := lower(trim(p_word));
  next_n integer;
  pts integer;
begin
  d := public.dgh_versus_for_move(p_duel, 'word_race', true);

  if word !~ '^[a-z]{3,9}$' then
    raise exception 'Words are 3 to 9 letters.';
  end if;

  if not public.dgh_uses_letters(word, d.setup ->> 'letters') then
    raise exception 'Use only the letters you have.';
  end if;

  if exists (select 1 from public.versus_moves where duel_id = d.id and user_id = me and answer = word) then
    raise exception 'You already found that one.';
  end if;

  select coalesce(max(n), 0) + 1 into next_n
  from public.versus_moves where duel_id = d.id and user_id = me;

  pts := public.dgh_word_points(word);

  insert into public.versus_moves (duel_id, user_id, n, answered_at, answer, correct, points)
  values (d.id, me, next_n, now(), word, true, pts);

  update public.versus_plays set score = score + pts
  where duel_id = d.id and user_id = me;

  return public.dgh_versus_mine(d);
end;
$$;


-- Trivia and Higher or Lower: get your next question or pair. Asking
-- again before answering gives the same one (the clock keeps running).
create or replace function public.versus_next(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  last_move public.versus_moves;
  next_n integer;
  q public.trivia_questions;
  ord jsonb;
  pair jsonb;
  a public.hl_items;
  b public.hl_items;
  total integer;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game not in ('trivia', 'higher_lower') then
    raise exception 'That game was not found.';
  end if;

  d := public.dgh_versus_for_move(p_duel, d.game, true);

  select * into last_move from public.versus_moves
  where duel_id = d.id and user_id = me
  order by n desc limit 1;

  if found and last_move.answered_at is null then
    next_n := last_move.n;
  else
    next_n := coalesce(last_move.n, 0) + 1;
    total := case d.game when 'trivia' then 10 else jsonb_array_length(d.setup -> 'pairs') end;

    if next_n > total then
      update public.versus_plays set finished_at = now()
      where duel_id = d.id and user_id = me and finished_at is null;
      perform public.dgh_versus_settle(d.id);
      return json_build_object('done', true);
    end if;

    insert into public.versus_moves (duel_id, user_id, n) values (d.id, me, next_n)
    returning * into last_move;
  end if;

  if d.game = 'trivia' then
    select * into q from public.trivia_questions
    where id = (d.setup -> 'questions' -> (next_n - 1) ->> 'id')::integer;
    ord := d.setup -> 'questions' -> (next_n - 1) -> 'order';

    return json_build_object(
      'n', next_n,
      'total', 10,
      'category', q.category,
      'question', q.question,
      'choices', (select json_agg(q.choices[(x::text)::integer + 1] order by i)
                  from jsonb_array_elements(ord) with ordinality e(x, i)),
      'seconds_left', greatest(0, public.dgh_versus_seconds(d.game)
        - extract(epoch from (now() - last_move.served_at)))
    );
  end if;

  pair := d.setup -> 'pairs' -> (next_n - 1);
  select * into a from public.hl_items where id = (pair ->> 0)::integer;
  select * into b from public.hl_items where id = (pair ->> 1)::integer;

  return json_build_object(
    'n', next_n,
    'streak', next_n - 1,
    'prompt', (select prompt from public.hl_categories where category = a.category),
    'category', a.category,
    'choices', json_build_array(a.name, b.name),
    'seconds_left', greatest(0, public.dgh_versus_seconds(d.game)
      - extract(epoch from (now() - last_move.served_at)))
  );
end;
$$;


-- Answer the current question (trivia) or pick (higher or lower).
-- p_choice is the position you tapped: 0-3 for trivia, 0-1 for pairs.
create or replace function public.versus_answer(p_duel uuid, p_n integer, p_choice integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  m public.versus_moves;
  late boolean;
  is_right boolean;
  right_choice integer;
  pair jsonb;
  a public.hl_items;
  b public.hl_items;
  took integer;
  result json;
begin
  d := public.dgh_my_duel(p_duel);

  if d.game not in ('trivia', 'higher_lower') then
    raise exception 'That game was not found.';
  end if;

  select * into m from public.versus_moves
  where duel_id = d.id and user_id = me and n = p_n
  for update;

  if not found or m.answer is not null then
    raise exception 'That question is closed.';
  end if;

  -- Already closed for running out of time: still say what was right.
  late := m.answered_at is not null
    or now() > m.served_at + make_interval(secs => public.dgh_versus_seconds(d.game) + 1);

  if not late then
    d := public.dgh_versus_for_move(p_duel, d.game, true);
  end if;
  took := least(
    public.dgh_versus_seconds(d.game) * 1000,
    (extract(epoch from (now() - m.served_at)) * 1000)::integer
  );

  if d.game = 'trivia' then
    -- The right answer is wherever choice 0 ended up.
    select (i - 1)::integer into right_choice
    from jsonb_array_elements(d.setup -> 'questions' -> (p_n - 1) -> 'order') with ordinality e(x, i)
    where (x::text)::integer = 0;

    is_right := not late and p_choice = right_choice;

    result := json_build_object('correct', is_right, 'late', late, 'right_choice', right_choice, 'ms', took);
  else
    pair := d.setup -> 'pairs' -> (p_n - 1);
    select * into a from public.hl_items where id = (pair ->> 0)::integer;
    select * into b from public.hl_items where id = (pair ->> 1)::integer;

    right_choice := case when a.value > b.value then 0 else 1 end;
    is_right := not late and p_choice = right_choice;

    result := json_build_object(
      'correct', is_right,
      'late', late,
      'right_choice', right_choice,
      'values', json_build_array(a.value, b.value),
      'unit', (select unit from public.hl_categories where category = a.category),
      'ms', took
    );
  end if;

  update public.versus_moves
  set answered_at = coalesce(answered_at, now()), answer = p_choice::text, correct = is_right,
      points = case when is_right then 1 else 0 end
  where duel_id = d.id and user_id = me and n = p_n;

  update public.versus_plays
  set score = score + case when is_right then 1 else 0 end,
      time_ms = time_ms + took,
      finished_at = coalesce(finished_at, case
        when d.game = 'higher_lower' and not is_right then now()
        when d.game = 'trivia' and p_n >= 10 then now()
      end)
  where duel_id = d.id and user_id = me;

  perform public.dgh_versus_settle(d.id);

  return result;
end;
$$;


-- How it went, for both of you, once the game is over.
create or replace function public.versus_result(p_duel uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  them uuid;
begin
  d := public.dgh_my_duel(p_duel);

  if d.status <> 'finished' or d.game = 'wordle_duel' then
    raise exception 'The results show when the game is over.';
  end if;

  them := case when d.challenger = me then d.opponent else d.challenger end;

  if d.game = 'word_race' then
    return json_build_object(
      'letters', d.setup ->> 'letters',
      'word', d.setup ->> 'word',
      'mine', (select coalesce(json_agg(json_build_object('word', answer, 'points', points) order by points desc, answer), '[]'::json)
               from public.versus_moves where duel_id = d.id and user_id = me),
      'theirs', (select coalesce(json_agg(json_build_object('word', answer, 'points', points) order by points desc, answer), '[]'::json)
                 from public.versus_moves where duel_id = d.id and user_id = them)
    );
  end if;

  if d.game = 'trivia' then
    return json_build_object('questions', (
      select json_agg(json_build_object(
        'n', q.i,
        'question', t.question,
        'answer', t.choices[1],
        'mine', (select json_build_object('correct', coalesce(m.correct, false),
                   'ms', (extract(epoch from (m.answered_at - m.served_at)) * 1000)::integer)
                 from public.versus_moves m where m.duel_id = d.id and m.user_id = me and m.n = q.i),
        'theirs', (select json_build_object('correct', coalesce(m.correct, false),
                   'ms', (extract(epoch from (m.answered_at - m.served_at)) * 1000)::integer)
                   from public.versus_moves m where m.duel_id = d.id and m.user_id = them and m.n = q.i)
      ) order by q.i)
      from jsonb_array_elements(d.setup -> 'questions') with ordinality q(x, i)
      join public.trivia_questions t on t.id = (q.x ->> 'id')::integer
    ));
  end if;

  return json_build_object(
    'mine', (select json_build_object('streak', score, 'ms', time_ms) from public.versus_plays where duel_id = d.id and user_id = me),
    'theirs', (select json_build_object('streak', score, 'ms', time_ms) from public.versus_plays where duel_id = d.id and user_id = them)
  );
end;
$$;


-- Mind Meld: say your word for this round. When you've both said one,
-- they're shown to both of you; the same word means you matched.
-- A word can't be used again once it's been said. Ends after 20 rounds.
create or replace function public.mind_meld_say(p_duel uuid, p_word text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  said text := lower(regexp_replace(trim(p_word), '\s+', ' ', 'g'));
  this_round integer;
  their_word text;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'mind_meld' then
    raise exception 'That game was not found.';
  end if;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger)) then
    raise exception 'This game is not open.';
  end if;

  if said !~ '^[a-z]+([ ''-][a-z]+)*$' or length(said) > 30 then
    raise exception 'Use a word (letters only).';
  end if;

  -- The round you're both on: one past the last one you both answered.
  select coalesce(max(m.round), 0) + 1 into this_round
  from public.mind_meld_words m
  join public.mind_meld_words t on t.duel_id = m.duel_id and t.round = m.round and t.user_id <> m.user_id
  where m.duel_id = d.id and m.user_id = me;

  if exists (select 1 from public.mind_meld_words where duel_id = d.id and user_id = me and round = this_round) then
    raise exception 'You already said a word this round.';
  end if;

  if exists (
    select 1 from public.mind_meld_words
    where duel_id = d.id and round < this_round and word = said
  ) then
    raise exception 'That word was already said. Try another.';
  end if;

  insert into public.mind_meld_words (duel_id, user_id, round, word)
  values (d.id, me, this_round, said);

  select m.word into their_word
  from public.mind_meld_words m
  where m.duel_id = d.id and m.user_id <> me and m.round = this_round;

  if d.status = 'active' and their_word is not null and (their_word = said or this_round >= 20) then
    update public.duels
    set status = 'finished',
        finished_at = now(),
        winner = null,
        answer = case when their_word = said then said else '' end
    where id = d.id
    returning * into d;
  end if;

  return public.dgh_duel_view(d, me);
end;
$$;


-- Dial In: the round's clue-giver sends a clue (a word or short phrase).
create or replace function public.dial_clue(p_duel uuid, p_clue text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  clue_text text := regexp_replace(trim(p_clue), '\s+', ' ', 'g');
  this_round integer;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'dial_in' then
    raise exception 'That game was not found.';
  end if;

  this_round := (public.dgh_dial_view(d, me) ->> 'round')::integer;

  if not (d.status = 'active' or (d.status = 'pending' and me = d.challenger and this_round = 1)) then
    raise exception 'This game is not open.';
  end if;

  if (this_round % 2 = 1) <> (d.challenger = me) then
    raise exception 'It''s their turn to give the clue.';
  end if;

  if clue_text = '' or length(clue_text) > 40 then
    raise exception 'Clues are 1 to 40 characters.';
  end if;

  if exists (select 1 from public.dial_rounds where duel_id = d.id and round = this_round and clue is not null) then
    raise exception 'You already gave a clue this round.';
  end if;

  insert into public.dial_rounds (duel_id, round, clue, clue_at)
  values (d.id, this_round, clue_text, now());

  return public.dgh_duel_view(d, me);
end;
$$;


-- Dial In: the other player sets the dial (0 = left end, 100 = right).
create or replace function public.dial_guess(p_duel uuid, p_guess integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
  this_round integer;
  target integer;
  pts integer;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) or d.game <> 'dial_in' then
    raise exception 'That game was not found.';
  end if;

  if d.status <> 'active' then
    raise exception 'This game is not open.';
  end if;

  if p_guess is null or p_guess not between 0 and 100 then
    raise exception 'Set the dial first.';
  end if;

  this_round := (public.dgh_dial_view(d, me) ->> 'round')::integer;

  if (this_round % 2 = 1) = (d.challenger = me) then
    raise exception 'You gave the clue this round, so they guess.';
  end if;

  if not exists (select 1 from public.dial_rounds where duel_id = d.id and round = this_round and clue is not null) then
    raise exception 'Wait for the clue first.';
  end if;

  target := (d.setup -> 'rounds' -> (this_round - 1) ->> 'target')::integer;
  pts := public.dgh_dial_points(p_guess, target);

  update public.dial_rounds
  set guess = p_guess, guessed_at = now(), points = pts
  where duel_id = d.id and round = this_round and guess is null;

  if this_round >= 6 then
    update public.duels
    set status = 'finished', finished_at = now(), winner = null,
        answer = (select sum(points)::text from public.dial_rounds where duel_id = d.id)
    where id = d.id
    returning * into d;
  end if;

  return public.dgh_duel_view(d, me);
end;
$$;


-- Same as step 1, except ending Mind Meld early has no winner
-- (you play it together).
create or replace function public.cancel_duel(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  d public.duels;
begin
  select * into d from public.duels where id = p_duel for update;

  if not found or me not in (d.challenger, d.opponent) then
    raise exception 'That game was not found.';
  end if;

  if d.status = 'pending' and me = d.challenger then
    update public.duels set status = 'cancelled', finished_at = now() where id = p_duel;
  elsif d.status = 'pending' and me = d.opponent then
    update public.duels set status = 'declined', finished_at = now() where id = p_duel;
  elsif d.status = 'active' then
    update public.duels
    set status = 'finished',
        finished_at = now(),
        answer = case when d.game = 'mind_meld' then '' else d.answer end,
        winner = case
          when d.game in ('mind_meld', 'dial_in') then null
          when me = d.challenger then d.opponent
          else d.challenger
        end
    where id = p_duel;
  else
    raise exception 'That game is already over.';
  end if;
end;
$$;


revoke all on function public.dial_clue(uuid, text) from public, anon;
revoke all on function public.dial_guess(uuid, integer) from public, anon;
grant execute on function public.dial_clue(uuid, text) to authenticated;
grant execute on function public.dial_guess(uuid, integer) to authenticated;
revoke all on function public.mind_meld_say(uuid, text) from public, anon;
grant execute on function public.mind_meld_say(uuid, text) to authenticated;
revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;
revoke all on function public.create_versus(uuid, text) from public, anon;
revoke all on function public.versus_start(uuid) from public, anon;
revoke all on function public.word_race_word(uuid, text) from public, anon;
revoke all on function public.versus_next(uuid) from public, anon;
revoke all on function public.versus_answer(uuid, integer, integer) from public, anon;
revoke all on function public.versus_result(uuid) from public, anon;
revoke all on function public.duel_state(uuid) from public, anon;
revoke all on function public.my_duels() from public, anon;
grant execute on function public.create_versus(uuid, text) to authenticated;
grant execute on function public.versus_start(uuid) to authenticated;
grant execute on function public.word_race_word(uuid, text) to authenticated;
grant execute on function public.versus_next(uuid) to authenticated;
grant execute on function public.versus_answer(uuid, integer, integer) to authenticated;
grant execute on function public.versus_result(uuid) to authenticated;
grant execute on function public.duel_state(uuid) to authenticated;
grant execute on function public.my_duels() to authenticated;

-- Check: the game data is loaded.
select 'Word Race starting words' as item, (select count(*) from public.word_race_seeds)::text as value
union all
select 'Trivia questions', (select count(*) from public.trivia_questions)::text
union all
select 'Higher or Lower facts', (select count(*) from public.hl_items)::text
union all
select 'Dial In scales', (select count(*) from public.dial_scales)::text;
