-- Fixed icons for some games that players added themselves.
-- Every copy of these games gets this icon, for every player, whatever
-- icon was typed in. Names match without caring about letter case or
-- extra spaces. Safe to run again.
--
-- To add another game later, add a line to game_icon_override() below
-- and run this file again.

create or replace function public.game_icon_override(game_name text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(game_name, '')))
    when 'noillirk' then '🎈'
    when 'waffle'   then '🧇'
  end
$$;


-- Games added or edited from now on.
create or replace function public.games_apply_icon_override()
returns trigger
language plpgsql
as $$
declare
  fixed_icon text := public.game_icon_override(new.name);
begin
  if fixed_icon is not null then
    new.icon := fixed_icon;
  end if;
  return new;
end;
$$;

drop trigger if exists games_icon_override on public.games;

create trigger games_icon_override
before insert or update of name, icon on public.games
for each row
execute function public.games_apply_icon_override();


-- Games already added.
update public.games
set icon = public.game_icon_override(name)
where public.game_icon_override(name) is not null
  and icon is distinct from public.game_icon_override(name);


-- Shows what changed.
select game_key, name, icon
from public.games
where public.game_icon_override(name) is not null
order by name, game_key;
