\set ON_ERROR_STOP 1
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'
\set C 'cccccccc-0000-0000-0000-000000000003'
\set D 'dddddddd-0000-0000-0000-000000000004'
\set E 'eeeeeeee-0000-0000-0000-000000000005'
\set S '51515151-0000-0000-0000-000000000001'
\set T '74747474-0000-0000-0000-000000000002'
-- Runs after server-tests.sql (which provides check() and expect_error()).
-- Server S: A, B, C play Wordle (lower) and Krillion (higher).
-- Server T: C and D play Wordle. E shares no server with A.
reset role;
delete from public.daily_scores where play_date < current_date;
insert into public.servers (id, name, owner_id, invite_code, start_date) values
  (:'S', 'S', :'A', 'SSSSSS', current_date - 5),
  (:'T', 'T', :'C', 'TTTTTT', current_date - 5);
insert into public.server_members (server_id, user_id, role) values
  (:'S', :'A', 'owner'), (:'S', :'B', 'member'), (:'S', :'C', 'member'),
  (:'T', :'C', 'owner'), (:'T', :'D', 'member');
insert into public.server_games (server_id, game_key, sort_order) values
  (:'S', 'wordle', 0), (:'S', 'krillion', 1), (:'T', 'wordle', 0);
insert into public.daily_scores (user_id, game_id, play_date, numeric_score, completed) values
  -- 3 days ago: A and C tie on Wordle, B behind
  (:'A', 'wordle', current_date - 3, 3, true),
  (:'B', 'wordle', current_date - 3, 4, true),
  (:'C', 'wordle', current_date - 3, 3, true),
  -- 2 days ago: B fails Wordle, A wins it; B wins Krillion
  (:'A', 'wordle', current_date - 2, 2, true),
  (:'B', 'wordle', current_date - 2, 7, false),
  (:'A', 'krillion', current_date - 2, 300, true),
  (:'B', 'krillion', current_date - 2, 400, true),
  -- yesterday: C alone in S (wins), but D beats C in T
  (:'C', 'wordle', current_date - 1, 5, true),
  (:'D', 'wordle', current_date - 1, 4, true),
  -- 4 days ago: B fails alone, which is not a win
  (:'B', 'wordle', current_date - 4, 7, false),
  -- before S started: never counts as a win
  (:'A', 'wordle', current_date - 9, 1, true);

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);

-- Stats
select public.player_card_stats(:'A', current_date) as a \gset
select public.check('card: own played counts every result', (:'a'::json->>'played')::int = 4, :'a');
select public.check('card: own wins (tie shares, fail loses, before start ignored)', (:'a'::json->>'wins')::int = 2, :'a');
select public.check('card: best streak is days in a row', (:'a'::json->>'best_streak')::int = 2, :'a');
select public.check('card: own card has no head-to-head', (:'a'::json->>'my_wins')::int = 0 and (:'a'::json->>'their_wins')::int = 0, :'a');
select public.player_card_stats(:'B', current_date) as b \gset
select public.check('card: B wins only Krillion (failed alone is not a win)', (:'b'::json->>'wins')::int = 1, :'b');
select public.check('card: head-to-head you 2, B 1', (:'b'::json->>'my_wins')::int = 2 and (:'b'::json->>'their_wins')::int = 1, :'b');
select public.player_card_stats(:'C', current_date) as c \gset
select public.check('card: a game-day won in one server counts once', (:'c'::json->>'wins')::int = 2, :'c');
select public.check('card: tie is neither side in head-to-head', (:'c'::json->>'my_wins')::int = 0 and (:'c'::json->>'their_wins')::int = 0, :'c');
select public.expect_error('card: stats hidden for players outside your servers', format('select public.player_card_stats(%L, current_date)', :'D'), 'only see cards');
select public.expect_error('card: stats hidden for E', format('select public.player_card_stats(%L, current_date)', :'E'), 'only see cards');

-- Cards
insert into public.player_cards (user_id, icon, color, bio, favorite_game) values (:'A', '🐸', 'teal', 'Krillion or bust', 'krillion');
select public.check('card: can save own card', (select icon from player_cards where user_id = :'A') = '🐸');
select public.expect_error('card: cannot save a card for someone else', format('insert into public.player_cards (user_id) values (%L)', :'B'), 'row-level security');
update public.player_cards set bio = 'new bio' where user_id = :'A';
select public.check('card: can edit own card', (select bio from player_cards where user_id = :'A') = 'new bio');
select public.expect_error('card: only allowed icons', format('update public.player_cards set icon = %L where user_id = %L', '👑', :'A'), 'player_cards_icon_check');
select public.expect_error('card: only allowed colors', format('update public.player_cards set color = %L where user_id = %L', 'gold', :'A'), 'player_cards_color_check');
select public.expect_error('card: bio up to 60 characters', format('update public.player_cards set bio = %L where user_id = %L', repeat('x', 61), :'A'), 'player_cards_bio_check');

select set_config('request.jwt.claim.sub', :'B', false);
insert into public.player_cards (user_id, icon) values (:'B', '🦖');
update public.player_cards set bio = 'hacked' where user_id = :'A';
select set_config('request.jwt.claim.sub', :'D', false);
insert into public.player_cards (user_id, icon) values (:'D', '🐙');

select set_config('request.jwt.claim.sub', :'A', false);
select public.check('card: cannot edit someone else''s card', (select bio from player_cards where user_id = :'A') = 'new bio');
select public.check('card: see cards of people in your servers', (select count(*) from player_cards where user_id = :'B') = 1);
select public.check('card: cannot see cards outside your servers', (select count(*) from player_cards where user_id = :'D') = 0);
reset role;
set role anon;
select public.expect_error('card: signed-out visitors cannot read cards', 'select * from public.player_cards', 'permission denied');
select public.expect_error('card: signed-out visitors cannot get stats', format('select public.player_card_stats(%L, current_date)', :'A'), 'permission denied');
reset role;
