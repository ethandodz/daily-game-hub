\set ON_ERROR_STOP 1
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set E 'eeeeeeee-0000-0000-0000-000000000005'
\set BOT '0b0b0b0b-0000-4000-8000-000000000001'
\set S '51515151-0000-0000-0000-000000000001'
-- Test project only: the computer player (supabase/test-setup/03_bots.sql).
reset role;
select public.check('bot: has a profile and card', (select username from profiles where user_id = :'BOT') = 'robo_bot' and (select icon from player_cards where user_id = :'BOT') = '🤖');
select public.check('bot: joined the existing server', exists (select 1 from server_members where server_id = :'S' and user_id = :'BOT'));

set role authenticated;
select set_config('request.jwt.claim.sub', :'E', false);
select public.create_server('Bot check', array['wordle'], current_date) as srv \gset
reset role;
select public.check('bot: joins new servers', exists (select 1 from server_members where server_id = :'srv' and user_id = :'BOT'));
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.check('bot: shows as an online friend', exists (
  select 1 from json_array_elements(public.server_friends()) f where f ->> 'user_id' = :'BOT' and (f ->> 'last_seen')::timestamptz > now()));

-- Wordle Duel: accepts and guesses, a few seconds apart
select public.create_duel(:'BOT') as wd \gset
select public.check('bot: accepts the moment you challenge it', (select public.duel_state(:'wd') ->> 'status') = 'active');
select public.duel_state(:'wd') as s \gset
select public.check('bot wordle: thinks before its first guess (like a person)', json_array_length(:'s'::json->'their_patterns') = 0, :'s');
reset role; update duels set created_at = created_at - interval '32 seconds', accepted_at = accepted_at - interval '32 seconds' where id = :'wd'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'wd') as s \gset
select public.check('bot wordle: guesses once its time comes', json_array_length(:'s'::json->'their_patterns') between 1 and 2, :'s');
reset role; update duels set created_at = created_at - interval '3 minutes', accepted_at = accepted_at - interval '3 minutes' where id = :'wd';
update duel_guesses set created_at = created_at - interval '3 minutes' where duel_id = :'wd'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'wd') as s \gset
select public.check('bot wordle: keeps guessing over time', json_array_length(:'s'::json->'their_patterns') >= 2, :'s');
reset role;
select public.check('bot wordle: second guess fits the first one''s colors', (
  select public.dgh_wordle_pattern(g1.guess, g2.guess) = g1.pattern or g1.pattern = 'GGGGG'
  from duel_guesses g1 join duel_guesses g2 on g2.duel_id = g1.duel_id and g2.user_id = g1.user_id and g2.n = 2
  where g1.duel_id = :'wd' and g1.n = 1));
select public.check('bot wordle: guesses 12 to 31 seconds apart', (
  select bool_and(g2.created_at - g1.created_at between interval '12 seconds' and interval '31 seconds')
  from duel_guesses g1 join duel_guesses g2 on g2.duel_id = g1.duel_id and g2.user_id = g1.user_id and g2.n = g1.n + 1
  where g1.duel_id = :'wd'));
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_guess(:'wd', 'zzzzz');
select public.check('bot is back to being signed out of your session', auth.uid() = :'A'::uuid);

reset role;
insert into duel_guesses (duel_id, user_id, n, guess, pattern)
select :'wd', :'A', n, 'qqqqq', 'BBBBB' from generate_series(2, 6) n;
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'wd') as s \gset
select public.check('bot wordle: plays out the rest at once when you are done', (:'s'::json->>'status') = 'finished'
  or (:'s'::json->'their_patterns')::text like '%GGGGG%', :'s');

-- Word Race, Trivia, Higher or Lower: the bot plays its whole turn
select public.create_versus(:'BOT', 'word_race') as w \gset
reset role;
select public.check('bot word race: plays its turn the moment you challenge it', exists (select 1 from versus_plays where duel_id = :'w' and user_id = :'BOT' and finished_at is not null));
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'w') as s \gset
select public.check('bot word race: plays its turn at once', (:'s'::json->'them'->>'finished')::boolean and (:'s'::json->>'status') = 'active', :'s');
select public.versus_start(:'w');
reset role; update versus_plays set started_at = now() - interval '3 minutes' where duel_id = :'w' and user_id = :'A'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_state(:'w') as s \gset
select public.check('bot word race: game ends when you finish', (:'s'::json->>'status') = 'finished', :'s');

select public.create_versus(:'BOT', 'trivia') as t \gset
select public.duel_state(:'t') as s \gset
select public.check('bot trivia: answers all 10', (:'s'::json->'them'->>'finished')::boolean, :'s');
reset role;
select public.check('bot trivia: takes a few seconds per question', (select bool_and(answered_at - served_at between interval '2 seconds' and interval '9 seconds') from versus_moves where duel_id = :'t' and user_id = :'BOT'));
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.versus_start(:'t');
select public.versus_next(:'t'), public.versus_answer(:'t', n, 0) from generate_series(1, 10) n;
select public.duel_state(:'t') as s \gset
select public.check('bot trivia: result once you finish', (:'s'::json->>'status') = 'finished', :'s');

select public.create_versus(:'BOT', 'higher_lower') as h \gset
select public.duel_state(:'h') as s \gset
select public.check('bot higher or lower: plays a streak', (:'s'::json->'them'->>'finished')::boolean, :'s');

-- Mind Meld: says round 1 right away, then waits for you
select public.create_versus(:'BOT', 'mind_meld') as mm \gset
select public.duel_state(:'mm') as s \gset
select public.check('bot mind meld: says its first word', (:'s'::json->'meld'->>'they_ready')::boolean, :'s');
select public.mind_meld_say(:'mm', 'zebra');
select public.duel_state(:'mm') as s \gset
select public.check('bot mind meld: waits for your word in round 2', (:'s'::json->'meld'->>'round') = '2' and not (:'s'::json->'meld'->>'they_ready')::boolean, :'s');
select public.mind_meld_say(:'mm', 'stripes');
select public.duel_state(:'mm') as s \gset
select public.check('bot mind meld: answers once you have', (:'s'::json->>'status') = 'finished' or (:'s'::json->'meld'->>'round') = '3', :'s');

-- Dial In: guesses your clue, then gives its own
select public.create_versus(:'BOT', 'dial_in') as di \gset
select public.dial_clue(:'di', 'Lukewarm');
select public.duel_state(:'di') as s \gset
select public.check('bot dial in: guesses, then gives the next clue', (:'s'::json->'dial'->'rounds'->0->>'guess') is not null
  and (:'s'::json->'dial'->'rounds'->1->>'clue') is not null and (:'s'::json->'dial'->>'round') = '2', :'s');
reset role;
select public.check('bot: no errors logged during all those games', (select count(*) from public.dgh_bot_log) = 0, (select string_agg(error, ' | ') from public.dgh_bot_log));
