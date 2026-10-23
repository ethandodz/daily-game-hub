-- RUN THIS IN THE REAL Daily Game Hub project (it only reads, changes nothing).
--
-- It writes out the games list as one block of SQL. Copy the single
-- result cell, then paste and run it in the TEST project's SQL Editor.
-- Custom games are copied without their creator, since test accounts
-- are different people.

select string_agg(
  format(
    'insert into public.games (game_key, name, url, category, description, icon, color, is_official) '
    'values (%L, %L, %L, %L, %L, %L, %L, %L) on conflict (game_key) do nothing;',
    game_key, name, url, category, description, icon, color, is_official::text
  ),
  E'\n'
  order by created_at
) as paste_this_into_the_test_project
from public.games;
