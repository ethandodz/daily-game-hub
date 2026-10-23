\set ON_ERROR_STOP 1
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'
\set C 'cccccccc-0000-0000-0000-000000000003'
\set D 'dddddddd-0000-0000-0000-000000000004'
\set E 'eeeeeeee-0000-0000-0000-000000000005'
\set S '51515151-0000-0000-0000-000000000001'
-- Runs after card-tests.sql: A, B, C share server S; E shares nothing with A.
reset role;

-- Wordle colors, including repeated letters
select public.check('wordle colors: solved', public.dgh_wordle_pattern('crane', 'crane') = 'GGGGG');
select public.check('wordle colors: repeated letter counted once', public.dgh_wordle_pattern('eerie', 'there') = 'YBYBG', public.dgh_wordle_pattern('eerie', 'there'));
select public.check('wordle colors: green before yellow', public.dgh_wordle_pattern('abbey', 'babes') = 'YYGGB', public.dgh_wordle_pattern('abbey', 'babes'));
select public.check('wordle colors: no match', public.dgh_wordle_pattern('fjord', 'crane') = 'BBBYB', public.dgh_wordle_pattern('fjord', 'crane'));
select public.check('answer list loaded', (select count(*) from duel_words) = 2315);

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.expect_error('duel: only people in your servers', format('select public.create_duel(%L)', :'E'), 'only challenge people in your servers');
select public.expect_error('duel: not yourself', format('select public.create_duel(%L)', :'A'), 'only challenge people in your servers');
select public.create_duel(:'B') as d1 \gset
select public.expect_error('duel: answers table is private', 'select * from public.duel_words limit 1', 'permission denied');
select public.expect_error('duel: duels table is private', 'select answer from public.duels limit 1', 'permission denied');
reset role;
update public.duels set answer = 'crane' where id = :'d1';
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);

-- challenger can start before the challenge is accepted
select public.duel_guess(:'d1', 'SLATE') as g \gset
select public.check('duel: guess colored by the database', (:'g'::json->'my_guesses'->0->>'pattern') = 'BBGBG' and (:'g'::json->'my_guesses'->0->>'guess') = 'slate', :'g');
select public.check('duel: answer hidden while playing', (:'g'::json->>'answer') is null);
select public.expect_error('duel: guesses are 5 letters', format('select public.duel_guess(%L, %L)', :'d1', 'abc'), '5 letters');

select set_config('request.jwt.claim.sub', :'B', false);
select public.expect_error('duel: opponent must accept first', format('select public.duel_guess(%L, %L)', :'d1', 'crane'), 'not open');
select public.duel_state(:'d1') as s \gset
select public.check('duel: opponent sees colors only, not letters', json_array_length(:'s'::json->'their_patterns') = 1 and (:'s'::json->>'their_patterns') not like '%slate%' and (:'s'::json->'their_patterns'->>0) = 'BBGBG', :'s');
select set_config('request.jwt.claim.sub', :'E', false);
select public.expect_error('duel: outsiders cannot see it', format('select public.duel_state(%L)', :'d1'), 'not found');
select public.expect_error('duel: outsiders cannot accept', format('select public.respond_duel(%L, true)', :'d1'), 'no longer open');

select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'d1', true);
select public.duel_guess(:'d1', 'crane') as g \gset
select public.check('duel: solving in fewer guesses wins at once', (:'g'::json->>'status') = 'finished' and (:'g'::json->>'winner') = :'B', :'g');
select public.check('duel: answer shown when finished', (:'g'::json->>'answer') = 'crane');
select set_config('request.jwt.claim.sub', :'A', false);
select public.expect_error('duel: no guesses after it ends', format('select public.duel_guess(%L, %L)', :'d1', 'crane'), 'not open');

-- same number of guesses: the faster player wins
select public.create_duel(:'B') as d2 \gset
reset role; update public.duels set answer = 'crane' where id = :'d2'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.duel_guess(:'d2', 'slate'); select public.duel_guess(:'d2', 'crane') as g \gset
select public.check('duel: solved but waiting for the other player', (:'g'::json->>'status') = 'pending');
select public.expect_error('duel: no more guesses once solved', format('select public.duel_guess(%L, %L)', :'d2', 'trace'), 'already done');
select set_config('request.jwt.claim.sub', :'B', false);
select public.respond_duel(:'d2', true);
select public.duel_guess(:'d2', 'trace') as g \gset
select public.check('duel: still open while a tie is possible', (:'g'::json->>'status') = 'active', :'g');
select public.duel_guess(:'d2', 'crane') as g \gset
select public.check('duel: same number of guesses goes to the faster player', (:'g'::json->>'status') = 'finished' and (:'g'::json->>'their_ms') is not null
  and ((:'g'::json->>'winner') is not null or (:'g'::json->>'my_ms') = (:'g'::json->>'their_ms')), :'g');

-- six misses each is a draw; playing on after the other solved
select public.create_duel(:'A') as d3 \gset
reset role; update public.duels set answer = 'crane' where id = :'d3'; set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.respond_duel(:'d3', true);
select public.duel_guess(:'d3', w) from unnest(array['fjord', 'pious', 'lumpy', 'dizzy', 'bobby', 'mummy']) w;
select set_config('request.jwt.claim.sub', :'B', false);
select public.duel_guess(:'d3', w) from unnest(array['fjord', 'pious', 'lumpy', 'dizzy', 'bobby']) w;
select public.duel_guess(:'d3', 'mummy') as g \gset
select public.check('duel: neither solves it is a draw', (:'g'::json->>'status') = 'finished' and (:'g'::json->>'winner') is null, :'g');

-- calling off and giving up
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_duel(:'C') as d4 \gset
select public.create_duel(:'C') as d5 \gset
select public.cancel_duel(:'d4');
select set_config('request.jwt.claim.sub', :'C', false);
select public.cancel_duel(:'d5');
select public.create_duel(:'A') as d6 \gset
select set_config('request.jwt.claim.sub', :'A', false);
select public.respond_duel(:'d6', true);
select public.cancel_duel(:'d6');
reset role;
select public.check('duel: challenger can call off, opponent can decline', (select status from duels where id = :'d4') = 'cancelled' and (select status from duels where id = :'d5') = 'declined');
select public.check('duel: giving up hands the win to the other player', (select status || ':' || winner from duels where id = :'d6') = 'finished:' || :'C');
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.check('duel: my_duels lists your games', json_array_length(public.my_duels()) = 6, public.my_duels()::text);

-- who's online
select public.heartbeat();
select set_config('request.jwt.claim.sub', :'B', false);
select public.check('online: server friends see you were just here', (select (f->>'last_seen') is not null from json_array_elements(public.server_friends()) f where f->>'user_id' = :'A'));
select public.check('online: friends list is only server friends', (select count(*) from json_array_elements(public.server_friends()) f where f->>'user_id' in (:'D', :'E')) = 0);
select public.expect_error('online: presence table is private', 'select * from public.player_presence', 'permission denied');

-- arcade
select set_config('request.jwt.claim.sub', :'A', false);
select public.submit_arcade_score('tile_drop', current_date, 1200, 8) as r \gset
select public.submit_arcade_score('tile_drop', current_date, 900, 6);
select public.check('arcade: best of the day returned', (:'r'::json->>'best_today')::int = 1200);
select public.expect_error('arcade: impossible scores turned away', 'select public.submit_arcade_score(''tile_drop'', current_date, 900000, 2)', 'not possible');
select public.expect_error('arcade: only for today', 'select public.submit_arcade_score(''tile_drop'', current_date - 5, 100, 1)', 'only be saved for today');
select public.expect_error('arcade: scores table is private', 'insert into public.arcade_scores (user_id, game, play_date, score) values (auth.uid(), ''tile_drop'', current_date, 5)', 'permission denied');
select set_config('request.jwt.claim.sub', :'B', false);
select public.submit_arcade_score('tile_drop', current_date, 3000, 20);
select public.submit_arcade_score('tile_drop', current_date - 1, 9000, 40);
select set_config('request.jwt.claim.sub', :'E', false);
select public.submit_arcade_score('tile_drop', current_date, 5000, 30);
select set_config('request.jwt.claim.sub', :'A', false);
select public.arcade_leaderboard('tile_drop', 'today', null, current_date) as lb \gset
select public.check('arcade: everyone today, best per player', (select string_agg(r->>'score', ',') from json_array_elements(:'lb'::json->'rows') r) = '5000,3000,1200', :'lb');
select public.check('arcade: your own rank', (:'lb'::json->'me'->>'rank')::int = 3 and (:'lb'::json->'rows'->2->>'is_me')::boolean);
select public.arcade_leaderboard('tile_drop', 'today', :'S', current_date) as lb \gset
select public.check('arcade: server board only shows its members', (select string_agg(r->>'score', ',') from json_array_elements(:'lb'::json->'rows') r) = '3000,1200', :'lb');
select public.arcade_leaderboard('tile_drop', 'all', null, current_date) as lb \gset
select public.check('arcade: all time includes earlier days', (:'lb'::json->'rows'->0->>'score')::int = 9000);
select set_config('request.jwt.claim.sub', :'E', false);
select public.expect_error('arcade: other servers'' boards are private', format('select public.arcade_leaderboard(%L, %L, %L, current_date)', 'tile_drop', 'today', :'S'), 'not in that server');
reset role;
set role anon;
select public.expect_error('play: signed-out visitors cannot duel', format('select public.create_duel(%L)', :'B'), 'permission denied');
select public.expect_error('play: signed-out visitors cannot post scores', 'select public.submit_arcade_score(''tile_drop'', current_date, 1, 0)', 'permission denied');
reset role;
