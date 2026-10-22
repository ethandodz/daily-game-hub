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
select public.expect_error('card: only allowed icons', format('update public.player_cards set icon = %L where user_id = %L', '👑', :'A'), 'own that icon');
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

-- Achievements and coins.
-- Server U (A owns it, B joins) plays Framed: a full week in January 2026.
\set U '75757575-0000-0000-0000-000000000003'
reset role;
select public.check('icons: Krillion is a shrimp', (select icon from games where game_key = 'krillion') = '🦐');
insert into public.servers (id, name, owner_id, invite_code, start_date) values (:'U', 'U', :'A', 'UUUUUU', '2025-12-01');
insert into public.server_members (server_id, user_id, role) values (:'U', :'A', 'owner'), (:'U', :'B', 'member');
insert into public.server_games (server_id, game_key, sort_order) values (:'U', 'framed', 0);
insert into public.daily_scores (user_id, game_id, play_date, numeric_score, completed, result_text) values
  (:'A', 'framed', '2026-01-05', 2, true, null), (:'B', 'framed', '2026-01-05', 3, true, null),
  (:'A', 'framed', '2026-01-06', 3, true, null), (:'B', 'framed', '2026-01-06', 4, true, null),
  (:'A', 'framed', '2026-01-07', 2, true, null), (:'B', 'framed', '2026-01-07', 5, true, null),
  (:'A', 'framed', '2026-01-08', 5, true, null), (:'B', 'framed', '2026-01-08', 4, true, null),
  (:'B', 'krillion', current_date - 6, 410, true, 'Krillion #1 🦐' || chr(10) || '410' || chr(10) || '💎🦑');

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
create temporary table a_ach as select * from json_to_recordset(public.player_achievements(:'A', current_date))
  as x(id text, tier int, name text, icon text, description text, threshold int, coins int, progress int);
select public.check('achievements: 19 achievements listed', (select count(distinct id) from a_ach) = 19);
select public.check('achievements: Winner counts days won (2 in S + 3 in U)', (select progress from a_ach where id = 'winner' and tier = 1) = 5);
select public.check('achievements: week awards = most wins + best average', (select progress from a_ach where id = 'week_champ' and tier = 1) = 2);
select public.check('achievements: month award needs 15 days for average', (select progress from a_ach where id = 'month_champ' and tier = 1) = 1);
select public.check('achievements: Sharpshooter counts Wordle in 2 or fewer', (select progress from a_ach where id = 'sharpshooter' and tier = 1) = 2);
select public.check('achievements: best streak', (select progress from a_ach where id = 'on_fire' and tier = 1) = 4);
select public.check('achievements: tiers have rising thresholds', (select string_agg(threshold::text, ',' order by tier) from a_ach where id = 'on_fire') = '7,30,100,365');
select public.check('achievements: founder and squad up', (select progress from a_ach where id = 'founder') = 2 and (select progress from a_ach where id = 'joiner') = 2);

select public.player_coins(:'A', current_date) as coins \gset
-- days played: 6 days with 1 result (7 each) + 1 day with 2 (9) = 51
-- wins with 2+ players: 2 in S + 3 in U = 75
-- awards: week wins 100 + week average 100 + month wins 300 = 500
-- badges: winner, week champ, month champ, sharpshooter, founder, squad up = 150
select public.check('coins: balance adds up', (:'coins'::json->>'balance')::int = 776, :'coins');
select public.check('coins: history listed for yourself', json_array_length(:'coins'::json->'history') > 0);
select public.check('coins: week award in history', (:'coins'::json->'history')::text like '%Most wins in U (week of Jan 5)%', :'coins');
select public.check('coins: month award in history', (:'coins'::json->'history')::text like '%Most wins in U (January 2026)%');

select public.player_achievements(:'B', current_date) as bach \gset
select public.check('achievements: Krillion answer (💎) counted', (select progress from json_to_recordset(:'bach'::json) as x(id text, tier int, progress int) where id = 'krillionaire' and tier = 1) = 1);
select public.player_coins(:'B', current_date) as bcoins \gset
select public.check('coins: someone else''s balance but no history', (:'bcoins'::json->>'balance')::int > 0 and (:'bcoins'::json->>'history') is null, :'bcoins');
select public.expect_error('achievements: hidden outside your servers', format('select public.player_achievements(%L, current_date)', :'E'), 'only see cards');
select public.expect_error('coins: hidden outside your servers', format('select public.player_coins(%L, current_date)', :'E'), 'only see cards');
select public.expect_error('coins: helper functions are private', format('select * from public.dgh_player_metrics(%L, current_date)', :'E'), 'permission denied');
select public.expect_error('achievements: list cannot be changed', 'update public.achievements set coins = 9999', 'permission denied');

update public.player_cards set showcase = array['winner', 'sharpshooter'] where user_id = :'A';
select public.check('showcase: pick up to 3 badges', (select cardinality(showcase) from player_cards where user_id = :'A') = 2);
select public.expect_error('showcase: no more than 3', format('update public.player_cards set showcase = %L where user_id = %L', '{a,b,c,d}', :'A'), 'player_cards_showcase_check');
reset role;
set role anon;
select public.expect_error('coins: signed-out visitors cannot get coins', format('select public.player_coins(%L, current_date)', :'A'), 'permission denied');
reset role;

-- Shop. A has 776 coins at this point (see above).
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.expect_error('shop: can''t use a shop icon before buying', format('update public.player_cards set icon = %L where user_id = %L', '👑', :'A'), 'own that icon');
select public.buy_item('icon_crown', current_date) as bought \gset
select public.check('shop: buying returns the new balance', (:'bought'::json->>'balance')::int = 476, :'bought');
select public.check('shop: balance goes down', (public.player_coins(:'A', current_date)->>'balance')::int = 476);
select public.check('shop: purchase in coin history', (public.player_coins(:'A', current_date)->'history')::text like '%Bought Crown%-300%');
update public.player_cards set icon = '👑' where user_id = :'A';
select public.check('shop: bought icon can be used', (select icon from player_cards where user_id = :'A') = '👑');
select public.expect_error('shop: can''t buy twice', 'select public.buy_item(''icon_crown'', current_date)', 'already own');
select public.expect_error('shop: not enough coins', 'select public.buy_item(''frame_rainbow'', current_date)', 'Not enough coins');
select public.expect_error('shop: badge items can''t be bought', 'select public.buy_item(''frame_crown'', current_date)', 'Unlock it with a badge');
select public.expect_error('shop: unknown item', 'select public.buy_item(''nope'', current_date)', 'not in the shop');
update public.player_cards set frame = 'frame_crown', title = 'title_champ' where user_id = :'A';
select public.check('shop: badge items unlocked by a month win can be used', (select frame || ',' || title from player_cards where user_id = :'A') = 'frame_crown,title_champ');
select public.expect_error('shop: locked badge items can''t be used', format('update public.player_cards set frame = %L where user_id = %L', 'frame_fire', :'A'), 'own that frame');
select public.expect_error('shop: unbought name colors can''t be used', format('update public.player_cards set name_color = %L where user_id = %L', 'name_gold', :'A'), 'own that name color');
select public.expect_error('shop: an item of the wrong kind can''t be used', format('update public.player_cards set frame = %L where user_id = %L', 'icon_crown', :'A'), 'own that frame');
select public.expect_error('shop: purchases can''t be added directly', format('insert into public.purchases (user_id, item_id, price) values (%L, %L, 1)', :'A', 'frame_gold'), 'permission denied');
select set_config('request.jwt.claim.sub', :'B', false);
select public.check('shop: can''t see other players'' purchases', (select count(*) from purchases) = 0);
select public.check('shop: others see the equipped items', (select frame from player_cards where user_id = :'A') = 'frame_crown');
reset role;
set role anon;
select public.expect_error('shop: signed-out visitors can''t buy', 'select public.buy_item(''icon_gem'', current_date)', 'permission denied');
reset role;
