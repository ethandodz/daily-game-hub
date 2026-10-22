\set ON_ERROR_STOP 1
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'
\set C 'cccccccc-0000-0000-0000-000000000003'
\set D 'dddddddd-0000-0000-0000-000000000004'
\set E 'eeeeeeee-0000-0000-0000-000000000005'
create table if not exists public.test_results (n serial, label text, ok boolean, detail text);
grant all on public.test_results to authenticated; grant all on sequence public.test_results_n_seq to authenticated;
create or replace function public.check(label text, ok boolean, detail text default '') returns void language sql as
$$ insert into public.test_results (label, ok, detail) values (label, coalesce(ok, false), detail) $$;
grant execute on function public.check(text, boolean, text) to authenticated;
create or replace function public.expect_error(label text, stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  perform public.check(label, false, 'no error raised');
exception when others then
  perform public.check(label, sqlerrm ilike '%' || expected || '%', sqlerrm);
end $$;
grant execute on function public.expect_error(text, text, text) to authenticated;

-- laur (A) creates a server with Wordle + Krillion
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.create_server('  Ball Knowers  ', array['wordle','krillion','not_a_game'], current_date) as sid \gset
select public.check('create: name trimmed', (select name from servers where id = :'sid') = 'Ball Knowers');
select public.check('create: owner is a member with role owner', (select role from server_members where server_id = :'sid' and user_id = :'A') = 'owner');
select public.check('create: only real games added, in order', (select string_agg(game_key, ',' order by sort_order) from server_games where server_id = :'sid') = 'wordle,krillion');
select public.check('create: 6-char code', (select invite_code ~ '^[A-HJKMNP-Z2-9]{6}$' from servers where id = :'sid'));
select invite_code as code from servers where id = :'sid' \gset
select public.expect_error('create: empty name rejected', $q$select public.create_server('   ', array['wordle'], current_date)$q$, '1 to 40');
select public.expect_error('create: backdated start rejected', $q$select public.create_server('Old', array['wordle'], current_date - 30)$q$, 'Invalid start date');
select public.expect_error('owner cannot change start date directly', format($q$update servers set start_date = current_date - 30 where id = %L$q$, :'sid'), 'permission denied');
update servers set name = 'Ball Knowers FC' where id = :'sid';
select public.check('owner can rename', (select name from servers where id = :'sid') = 'Ball Knowers FC');
select public.expect_error('cannot add members directly', format($q$insert into server_members (server_id, user_id) values (%L, %L)$q$, :'sid', :'E'), 'row-level security');
delete from server_members where server_id = :'sid' and user_id = :'A';
select public.check('owner cannot leave own server', (select count(*) from server_members where server_id = :'sid' and user_id = :'A') = 1);

-- outsider (E) cannot see it
select set_config('request.jwt.claim.sub', :'E', false);
select public.check('outsider: cannot see server', (select count(*) from servers where id = :'sid') = 0);
select public.check('outsider: cannot see members', (select count(*) from server_members where server_id = :'sid') = 0);
select public.check('outsider: cannot see server games', (select count(*) from server_games where server_id = :'sid') = 0);
select public.expect_error('outsider: wrong code rejected', $q$select public.join_server('ZZZZZZ')$q$, 'No server has that invite code');
select public.expect_error('outsider: cannot reset code', format($q$select public.reset_invite_code(%L)$q$, :'sid'), 'Only the server owner');
update servers set name = 'hacked' where id = :'sid';
delete from servers where id = :'sid';
select public.expect_error('outsider: cannot add server games', format($q$insert into server_games (server_id, game_key) values (%L, 'framed')$q$, :'sid'), 'row-level security');

-- maya (C) and sam (D) join; code is case/space insensitive
select set_config('request.jwt.claim.sub', :'C', false);
select public.join_server(lower(' ' || :'code' || ' ')) = :'sid'::uuid as joined \gset
select public.check('join: lowercase code with spaces works', :'joined'::boolean);
select public.join_server(:'code');
select public.check('join twice is harmless', (select count(*) from server_members where server_id = :'sid' and user_id = :'C') = 1);
select set_config('request.jwt.claim.sub', :'D', false);
select public.join_server(:'code');

-- laur sees members and scores
select set_config('request.jwt.claim.sub', :'A', false);
select public.check('outsider could not rename/delete/add game', (select name from servers where id = :'sid') = 'Ball Knowers FC' and (select count(*) from server_games where server_id = :'sid') = 2);
select public.check('member list has 3', (select count(*) from server_members where server_id = :'sid') = 3);
select public.check('sees server members'' Wordle today', (select count(*) from daily_scores where game_id = 'wordle' and play_date = current_date) = 2, (select string_agg(user_id::text, ',') from daily_scores where game_id = 'wordle'));
select public.check('does not see scores from before server start', (select count(*) from daily_scores where user_id = :'C' and play_date < current_date) = 0);
select public.check('does not see games outside the server', (select count(*) from daily_scores where user_id = :'C' and game_id = 'framed') = 0);
select public.check('does not see outsider scores', (select count(*) from daily_scores where user_id = :'E') = 0);
select public.check('friend scores still visible (existing rule)', (select count(*) from daily_scores where user_id = :'B') = 1);

-- maya cannot see ethan (laur's friend, not in server)
select set_config('request.jwt.claim.sub', :'C', false);
select public.check('member cannot see owner''s non-member friend', (select count(*) from daily_scores where user_id = :'B') = 0);
update servers set name = 'x' where id = :'sid';
select public.check('rename by member had no effect', (select name from servers where id = :'sid') = 'Ball Knowers FC');
delete from server_members where server_id = :'sid' and user_id = :'D';
select public.check('sam still a member', (select count(*) from server_members where server_id = :'sid' and user_id = :'D') = 1);

-- sam leaves; maya is removed by owner
select set_config('request.jwt.claim.sub', :'D', false);
delete from server_members where server_id = :'sid' and user_id = :'D';
select set_config('request.jwt.claim.sub', :'A', false);
select public.check('member can leave', (select count(*) from server_members where server_id = :'sid' and user_id = :'D') = 0);
select public.check('after leaving, their scores are hidden', (select count(*) from daily_scores where user_id = :'D') = 0);
delete from server_members where server_id = :'sid' and user_id = :'C';
select public.check('owner can remove a member', (select count(*) from server_members where server_id = :'sid' and user_id = :'C') = 0);
select public.reset_invite_code(:'sid') as newcode \gset
select public.check('reset gives a new code', :'newcode' <> :'code');
select set_config('request.jwt.claim.sub', :'C', false);
select public.expect_error('old code stops working', format($q$select public.join_server(%L)$q$, :'code'), 'No server has that invite code');
select set_config('request.jwt.claim.sub', :'A', false);
insert into server_games (server_id, game_key, sort_order) values (:'sid', 'framed', 3);
select public.check('owner can add a game', (select count(*) from server_games where server_id = :'sid') = 3);
delete from servers where id = :'sid';
reset role;
select public.check('owner delete removes server, members and games', (select count(*) from servers) = 0 and (select count(*) from server_members) = 0 and (select count(*) from server_games) = 0);
select public.check('scores untouched by server delete', (select count(*) from daily_scores) = 6);
select public.check('anon cannot call create_server', not has_function_privilege('anon', 'public.create_server(text, text[], date)', 'execute'));
select public.check('anon cannot call join_server', not has_function_privilege('anon', 'public.join_server(text)', 'execute'));
select public.check('authenticated cannot call new_invite_code directly', not has_function_privilege('authenticated', 'public.new_invite_code()', 'execute'));
select public.check('Box Office Game: higher score wins', (select score_direction from games where game_key = 'boxoffice') = 'higher');
