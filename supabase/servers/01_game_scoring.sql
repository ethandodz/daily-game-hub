-- Servers, step 1 of 5: which way each game is won.
-- Safe to run more than once.

alter table public.games
  add column if not exists score_direction text not null default 'none';

alter table public.games
  drop constraint if exists games_score_direction_check;

alter table public.games
  add constraint games_score_direction_check
  check (score_direction in ('lower', 'higher', 'none'));

update public.games
set score_direction = 'lower'
where game_key in (
  'wordle', 'worldle', 'weddle', 'poeltl', 'poople', 'globle',
  'contexto', 'framed', 'connections', 'strands', 'minutecryptic'
);

update public.games
set score_direction = 'higher'
where game_key in (
  'guesslist', 'krillion', 'magnitudle', 'maptap', 'whentaken'
);

-- Check: lists every game and its direction.
select game_key, name, score_direction
from public.games
order by score_direction, name;
