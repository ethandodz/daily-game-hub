-- Daily Game Hub: winners for more games.
-- Safe to run again. Run after 01_game_scoring.sql.

-- Box Office Game: the 🏆 total, higher wins.
update public.games
set score_direction = 'higher'
where game_key = 'boxoffice';

-- Check: games that still have no winner.
select game_key, name, score_direction
from public.games
order by score_direction, name;
