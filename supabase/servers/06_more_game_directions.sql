-- Daily Game Hub: winners for more games.
-- Safe to run again. Run after 01_game_scoring.sql.

-- Box Office Game: the 🏆 total. Perceptle: the score in brackets.
update public.games
set score_direction = 'higher'
where game_key in (
  'boxoffice', 'custom-d624eb38-1792591388191-perceptle'
);

-- Duotrigordle: guesses out of 37. Immaculate Grid: rarity.
update public.games
set score_direction = 'lower'
where game_key in ('duotrigordle', 'immaculate');

-- Check: lists every game and its direction (none = no winner).
select game_key, name, score_direction
from public.games
order by score_direction, name;
