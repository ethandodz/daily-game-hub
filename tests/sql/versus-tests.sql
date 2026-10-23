\set ON_ERROR_STOP 1
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'
\set E 'eeeeeeee-0000-0000-0000-000000000005'
-- Runs after play-tests.sql: A and B share a server; E shares nothing with A.
reset role;

-- Game data
select public.check('versus data: 400 Word Race starting words', (select count(*) from word_race_seeds) = 400);
select public.check('versus data: trivia questions loaded', (select count(*) from trivia_questions) >= 150);
select public.check('versus data: every trivia question has 4 different choices',
  not exists (select 1 from trivia_questions where (select count(distinct c) from unnest(choices) c) <> 4));
select public.check('versus data: every Higher or Lower category can make pairs', not exists (
  select 1 from hl_categories c where not exists (
    select 1 from hl_items a join hl_items b on b.category = a.category and a.value >= b.value * 1.25
    where a.category = c.category)));
select public.check('versus rules: word points grow with length',
  dgh_word_points('cat') = 1 and dgh_word_points('cart') = 2 and dgh_word_points('gardeners') = 20);
select public.check('versus rules: letters can only be used once',
  dgh_uses_letters('garden', 'rgadsener') and not dgh_uses_letters('dagger', 'rgadsener') and not dgh_uses_letters('zoo', 'rgadsener'));

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.expect_error('versus: only people in your servers', format('select public.create_versus(%L, %L)', :'E', 'trivia'), 'only challenge people in your servers');
select public.expect_error('versus: unknown game', format('select public.create_versus(%L, %L)', :'B', 'chess'), 'Unknown game');
select public.expect_error('versus: questions are private', 'select * from public.trivia_questions limit 1', 'permission denied');
select public.expect_error('versus: facts are private', 'select * from public.hl_items limit 1', 'permission denied');
select public.expect_error('versus: moves are private', 'select * from public.versus_moves limit 1', 'permission denied');

-- Real setups look right
select public.create_versus(:'B', 'trivia') as t0 \gset
select public.create_versus(:'B', 'higher_lower') as h0 \gset
select public.create_versus(:'B', 'word_race') as w0 \gset
reset role;
select public.check('versus setup: trivia gets 10 different questions',
  (select count(distinct q ->> 'id') from duels, jsonb_array_elements(setup -> 'questions') q where id = :'t0') = 10);
select public.check('versus setup: 40 pairs, always 25% apart', (
  select count(*) from duels d, jsonb_array_elements(d.setup -> 'pairs') p
  join hl_items a on a.id = (p ->> 0)::integer
  join hl_items b on b.id = (p ->> 1)::integer
  where d.id = :'h0' and a.category = b.category and greatest(a.value, b.value) >= least(a.value, b.value) * 1.25) = 40);
select public.check('versus setup: Word Race letters are a shuffled starting word', (
  select dgh_uses_letters(answer, setup ->> 'letters') and length(setup ->> 'letters') = 9 from duels where id = :'w0'));
delete from duels where id in (:'t0', :'h0', :'w0');


-- ---------- Word Race ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_versus(:'B', 'word_race') as w \gset
reset role;
update duels set answer = 'gardeners', setup = '{"word": "gardeners", "letters": "rgadsener"}' where id = :'w';
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'w') as s \gset
select public.check('word race: letters hidden until you start', (:'s'::text) not like '%rgadsener%' and (:'s'::json->>'answer') is null, :'s');
select public.expect_error('word race: start first', format('select public.word_race_word(%L, %L)', :'w', 'garden'), 'Start the game first');
select public.versus_start(:'w') as s \gset
select public.check('word race: starting shows letters and the clock', (:'s'::json->>'letters') = 'rgadsener' and (:'s'::json->>'seconds_left')::integer between 118 and 120, :'s');
select public.word_race_word(:'w', 'Garden') as s \gset
select public.check('word race: a 6-letter word is 7 points', (:'s'::json->'duel'->'me'->>'score')::integer = 7 and (:'s'::json->'words'->0->>'word') = 'garden', :'s');
select public.expect_error('word race: no repeats', format('select public.word_race_word(%L, %L)', :'w', 'garden'), 'already found');
select public.expect_error('word race: only your letters', format('select public.word_race_word(%L, %L)', :'w', 'dagger'), 'only the letters');
select public.expect_error('word race: 3 letters or more', format('select public.word_race_word(%L, %L)', :'w', 'ad'), '3 to 9 letters');
select public.word_race_word(:'w', 'gardeners') as s \gset
select public.check('word race: all 9 letters is 20 points', (:'s'::json->'duel'->'me'->>'score')::integer = 27, :'s');

select set_config('request.jwt.claim.sub', :'B', false);
select public.expect_error('word race: opponent accepts first', format('select public.word_race_word(%L, %L)', :'w', 'red'), 'not open');
select public.duel_state(:'w') as s \gset
select public.check('word race: their score hidden while they play', (:'s'::json->'them'->>'started')::boolean and (:'s'::json->'them'->>'score') is null, :'s');

-- A's two minutes run out
reset role; update versus_plays set started_at = now() - interval '3 minutes' where duel_id = :'w' and user_id = :'A'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.expect_error('word race: no words after time is up', format('select public.word_race_word(%L, %L)', :'w', 'red'), 'turn is over');

select set_config('request.jwt.claim.sub', :'B', false);
select public.duel_state(:'w') as s \gset
select public.check('word race: their score shows once they finish', (:'s'::json->'them'->>'score')::integer = 27, :'s');
select public.respond_duel(:'w', true);
select public.versus_start(:'w');
select public.word_race_word(:'w', 'red');
select public.expect_error('word race: results wait for the end', format('select public.versus_result(%L)', :'w'), 'when the game is over');
reset role; update versus_plays set started_at = now() - interval '3 minutes' where duel_id = :'w' and user_id = :'B'; set role authenticated;
select public.duel_state(:'w') as s \gset
select public.check('word race: most points wins', (:'s'::json->>'status') = 'finished' and (:'s'::json->>'winner') = :'A' and (:'s'::json->>'answer') = 'gardeners', :'s');
select public.versus_result(:'w') as r \gset
select public.check('word race: results list both players'' words', json_array_length(:'r'::json->'mine') = 1 and json_array_length(:'r'::json->'theirs') = 2 and (:'r'::json->'theirs'->0->>'word') = 'gardeners', :'r');


-- ---------- Trivia Showdown ----------
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_versus(:'B', 'trivia') as t \gset
reset role;
-- Questions 1-10, right answer always shown first, except question 2 (last).
update duels set setup = jsonb_build_object('questions', (
  select jsonb_agg(jsonb_build_object('id', i, 'order', case when i = 2 then '[3, 2, 1, 0]'::jsonb else '[0, 1, 2, 3]'::jsonb end) order by i)
  from generate_series(1, 10) i)) where id = :'t';
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.versus_start(:'t');
select public.versus_next(:'t') as q \gset
select public.check('trivia: question 1 of 10 with 4 choices, no answer given away',
  (:'q'::json->>'n') = '1' and json_array_length(:'q'::json->'choices') = 4 and (:'q'::json->>'question') = 'What is the capital of Australia?'
  and (:'q'::text) not like '%right%', :'q');
select public.versus_next(:'t') as q2 \gset
select public.check('trivia: asking again gives the same question', (:'q2'::json->>'n') = '1');
select public.versus_answer(:'t', 1, 0) as a \gset
select public.check('trivia: right answer', (:'a'::json->>'correct')::boolean and (:'a'::json->>'right_choice') = '0', :'a');
select public.expect_error('trivia: one answer per question', format('select public.versus_answer(%L, 1, 0)', :'t'), 'closed');
select public.versus_next(:'t');
select public.versus_answer(:'t', 2, 0) as a \gset
select public.check('trivia: wrong answer shows where the right one was', not (:'a'::json->>'correct')::boolean and (:'a'::json->>'right_choice') = '3', :'a');
-- A: right on odd questions, wrong on even ones
select public.versus_next(:'t'), public.versus_answer(:'t', n, case when n % 2 = 1 then 0 else 1 end) from generate_series(3, 10) n;
select public.expect_error('trivia: your turn ends after 10', format('select public.versus_next(%L)', :'t'), 'turn is over');
select public.duel_state(:'t') as s \gset
select public.check('trivia: finished after 10 questions', (:'s'::json->'me'->>'finished')::boolean and (:'s'::json->'me'->>'correct')::integer = 5, :'s');

-- B: wrong on question 1, right (and quicker) on the rest
reset role; update versus_moves set served_at = answered_at - interval '1 second' where duel_id = :'t' and user_id = :'A'; set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'t', true);
select public.versus_start(:'t');
select public.versus_next(:'t'), public.versus_answer(:'t', n, case when n = 1 then 2 when n = 2 then 3 else 0 end) from generate_series(1, 10) n;
select public.duel_state(:'t') as s \gset
select public.check('trivia: fastest right answer gets each point', (:'s'::json->>'status') = 'finished' and (:'s'::json->>'winner') = :'B'
  and (:'s'::json->'me'->>'score')::integer = 9 and (:'s'::json->'them'->>'score')::integer = 1, :'s');
select public.versus_result(:'t') as r \gset
select public.check('trivia: results show each question for both players', json_array_length(:'r'::json->'questions') = 10
  and (:'r'::json->'questions'->0->>'answer') = 'Canberra' and (:'r'::json->'questions'->0->'theirs'->>'correct')::boolean, :'r');

-- Too slow counts as wrong
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_versus(:'B', 'trivia') as t2 \gset
select public.versus_start(:'t2'); select public.versus_next(:'t2');
reset role; update versus_moves set served_at = now() - interval '20 seconds' where duel_id = :'t2'; set role authenticated;
select public.versus_answer(:'t2', 1, 0) as a \gset
select public.check('trivia: answering after the timer is wrong', not (:'a'::json->>'correct')::boolean and (:'a'::json->>'late')::boolean, :'a');


-- ---------- Higher or Lower ----------
-- items 1 = India, 3 = United States
select public.create_versus(:'B', 'higher_lower') as h \gset
reset role; update duels set setup = '{"pairs": [[3, 1], [1, 3], [3, 1]]}' where id = :'h'; set role authenticated;
select public.versus_start(:'h');
select public.versus_next(:'h') as p \gset
select public.check('higher or lower: a pair with the question', (:'p'::json->'choices'->>0) = 'United States' and (:'p'::json->>'prompt') like 'Which%' and (:'p'::text) not like '%1428%', :'p');
select public.versus_answer(:'h', 1, 1) as a \gset
select public.check('higher or lower: right pick shows both numbers', (:'a'::json->>'correct')::boolean and (:'a'::json->'values'->>1)::numeric = 1428000000, :'a');
select public.versus_next(:'h');
select public.versus_answer(:'h', 2, 1) as a \gset
select public.check('higher or lower: a miss ends your turn', not (:'a'::json->>'correct')::boolean);
select public.expect_error('higher or lower: no picks after a miss', format('select public.versus_next(%L)', :'h'), 'turn is over');

select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'h', true);
select public.versus_start(:'h');
select public.versus_next(:'h'), public.versus_answer(:'h', n, case when n = 2 then 0 else 1 end) from generate_series(1, 3) n;
select public.versus_next(:'h') as p \gset
select public.check('higher or lower: getting every pair right ends the turn', (:'p'::json->>'done')::boolean, :'p');
select public.duel_state(:'h') as s \gset
select public.check('higher or lower: longest streak wins', (:'s'::json->>'status') = 'finished' and (:'s'::json->>'winner') = :'B' and (:'s'::json->'me'->>'score')::integer = 3, :'s');

-- Running out of time on a pick is a miss (noticed on the next look)
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_versus(:'B', 'higher_lower') as h2 \gset
select public.versus_start(:'h2'); select public.versus_next(:'h2');
reset role; update versus_moves set served_at = now() - interval '30 seconds' where duel_id = :'h2'; set role authenticated;
select public.my_duels() as all_duels \gset
select public.check('higher or lower: a timed-out pick ends your turn', (
  select (x -> 'me' ->> 'finished')::boolean from json_array_elements(:'all_duels'::json) x where x ->> 'id' = :'h2'), :'all_duels');

-- Giving up works for the new games too
select public.create_versus(:'B', 'word_race') as w2 \gset
select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'w2', true);
select public.cancel_duel(:'w2');
select public.duel_state(:'w2') as s \gset
select public.check('versus: giving up hands them the win', (:'s'::json->>'winner') = :'A', :'s');

select set_config('request.jwt.claim.sub', :'E', false);
select public.expect_error('versus: outsiders cannot look', format('select public.duel_state(%L)', :'h'), 'not found');
select public.expect_error('versus: outsiders cannot play', format('select public.versus_start(%L)', :'h'), 'not found');

-- Wordle Duel still works with the new view
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_duel(:'B') as wd \gset
select public.duel_guess(:'wd', 'slate') as g \gset
select public.check('versus: Wordle Duel unchanged', json_array_length(:'g'::json->'my_guesses') = 1 and (:'g'::json->>'game') = 'wordle_duel', :'g');
reset role;


-- ---------- Mind Meld ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_versus(:'B', 'mind_meld') as mm \gset
select public.mind_meld_say(:'mm', '  Ocean ') as s \gset
select public.check('mind meld: you can say your first word before they accept', (:'s'::json->'meld'->>'my_word') = 'ocean' and (:'s'::json->'meld'->>'round') = '1', :'s');
select public.expect_error('mind meld: one word per round', format('select public.mind_meld_say(%L, %L)', :'mm', 'sea'), 'already said a word');
select public.expect_error('mind meld: words only', format('select public.mind_meld_say(%L, %L)', :'mm', '42!'), 'letters only');

select set_config('request.jwt.claim.sub', :'B', false);
select public.duel_state(:'mm') as s \gset
select public.check('mind meld: their word stays hidden until you both say one', (:'s'::text) not like '%ocean%' and (:'s'::json->'meld'->>'they_ready')::boolean, :'s');
select public.expect_error('mind meld: accept first', format('select public.mind_meld_say(%L, %L)', :'mm', 'beach'), 'not open');
select public.respond_duel(:'mm', true);
select public.mind_meld_say(:'mm', 'beach') as s \gset
select public.check('mind meld: both words shown after round 1', (:'s'::json->'meld'->'rounds'->0->>'mine') = 'beach' and (:'s'::json->'meld'->'rounds'->0->>'theirs') = 'ocean' and (:'s'::json->'meld'->>'round') = '2', :'s');
select public.expect_error('mind meld: no repeating a word already said', format('select public.mind_meld_say(%L, %L)', :'mm', 'ocean'), 'already said');
select public.mind_meld_say(:'mm', 'sand');

select set_config('request.jwt.claim.sub', :'A', false);
select public.mind_meld_say(:'mm', 'Sand') as s \gset
select public.check('mind meld: same word ends it together (no winner)', (:'s'::json->>'status') = 'finished' and (:'s'::json->>'winner') is null
  and (:'s'::json->'meld'->>'matched') = 'sand' and json_array_length(:'s'::json->'meld'->'rounds') = 2, :'s');
select public.expect_error('mind meld: nothing after a match', format('select public.mind_meld_say(%L, %L)', :'mm', 'shore'), 'not open');

-- Giving up ends it with no winner
select public.create_versus(:'B', 'mind_meld') as mm2 \gset
select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'mm2', true);
select public.cancel_duel(:'mm2');
select public.duel_state(:'mm2') as s \gset
select public.check('mind meld: stopping early has no winner', (:'s'::json->>'status') = 'finished' and (:'s'::json->>'winner') is null and (:'s'::json->'meld'->>'matched') is null, :'s');

-- 20 rounds without matching ends the game
select public.create_versus(:'A', 'mind_meld') as mm3 \gset
select set_config('request.jwt.claim.sub', :'A', false);
select public.respond_duel(:'mm3', true);
select set_config('request.jwt.claim.sub', :'B', false);
select public.mind_meld_say(:'mm3', 'b' || repeat('x', n)) from generate_series(1, 1) n;
select set_config('request.jwt.claim.sub', :'A', false);
select public.mind_meld_say(:'mm3', 'a' || repeat('y', 1));
reset role;
insert into mind_meld_words (duel_id, user_id, round, word)
select :'mm3', u, r, case when u = :'A'::uuid then 'a' else 'b' end || repeat('z', r)
from generate_series(2, 19) r, (values (:'A'::uuid), (:'B'::uuid)) v(u);
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.mind_meld_say(:'mm3', 'apple');
select set_config('request.jwt.claim.sub', :'B', false);
select public.mind_meld_say(:'mm3', 'banana') as s \gset
select public.check('mind meld: stops after 20 rounds', (:'s'::json->>'status') = 'finished' and json_array_length(:'s'::json->'meld'->'rounds') = 20 and (:'s'::json->'meld'->>'matched') is null, :'s');
reset role;
