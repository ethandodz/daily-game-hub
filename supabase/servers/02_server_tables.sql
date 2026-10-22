-- Servers, step 2 of 5: tables.
-- Row level security is turned on here with no policies yet,
-- so nobody can read or change these tables until step 3.

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  start_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.server_members (
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create index if not exists server_members_user_index
  on public.server_members (user_id);

create table if not exists public.server_games (
  server_id uuid not null references public.servers (id) on delete cascade,
  game_key text not null references public.games (game_key) on delete cascade,
  sort_order integer not null default 0,
  score_direction text check (score_direction in ('lower', 'higher', 'none')),
  primary key (server_id, game_key)
);

alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.server_games enable row level security;
