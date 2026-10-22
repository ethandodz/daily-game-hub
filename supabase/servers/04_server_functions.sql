-- Servers, step 4 of 5: create, join, and new invite code.

create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- No I, L, O, 0 or 1, so codes are easy to read aloud.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';

    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.servers where invite_code = code
    );
  end loop;

  return code;
end;
$$;

revoke all on function public.new_invite_code() from public, anon, authenticated;


-- p_start_date is the creator's local "today". Scores count from that
-- day on. It must be within a day of the server's date (time zones).
create or replace function public.create_server(
  p_name text,
  p_game_keys text[],
  p_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'Log in to create a server.';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'Server name must be 1 to 40 characters.';
  end if;

  if p_start_date is null
     or p_start_date not between current_date - 1 and current_date + 1 then
    raise exception 'Invalid start date.';
  end if;

  insert into public.servers (name, owner_id, invite_code, start_date)
  values (btrim(p_name), me, public.new_invite_code(), p_start_date)
  returning id into new_id;

  insert into public.server_members (server_id, user_id, role)
  values (new_id, me, 'owner');

  insert into public.server_games (server_id, game_key, sort_order)
  select new_id, g.game_key, picked.position
  from unnest(coalesce(p_game_keys, '{}')) with ordinality as picked (game_key, position)
  join public.games g on g.game_key = picked.game_key
  on conflict do nothing;

  return new_id;
end;
$$;


create or replace function public.join_server(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  found_id uuid;
begin
  if me is null then
    raise exception 'Log in to join a server.';
  end if;

  select id into found_id
  from public.servers
  where invite_code = upper(btrim(coalesce(p_invite_code, '')));

  if found_id is null then
    raise exception 'No server has that invite code.';
  end if;

  insert into public.server_members (server_id, user_id, role)
  values (found_id, me, 'member')
  on conflict do nothing;

  return found_id;
end;
$$;


-- Owner only: replaces the invite code (old code stops working).
create or replace function public.reset_invite_code(p_server_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_server_owner(p_server_id) then
    raise exception 'Only the server owner can do that.';
  end if;

  code := public.new_invite_code();

  update public.servers
  set invite_code = code
  where id = p_server_id;

  return code;
end;
$$;

revoke all on function public.create_server(text, text[], date) from public, anon;
revoke all on function public.join_server(text) from public, anon;
revoke all on function public.reset_invite_code(uuid) from public, anon;
grant execute on function public.create_server(text, text[], date) to authenticated;
grant execute on function public.join_server(text) to authenticated;
grant execute on function public.reset_invite_code(uuid) to authenticated;
