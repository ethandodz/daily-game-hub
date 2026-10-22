# Player cards database setup

Run in the Supabase dashboard → **SQL Editor** after the Servers files (`supabase/servers`). Safe to run again.

| Step | File | What it does |
|---|---|---|
| 1 | `01_player_cards.sql` | Adds `player_cards` (icon, card color, bio, favorite game). You can see your own card and the cards of people who share a server with you; you can only change your own. Adds `player_card_stats(user_id, today)` for the numbers on a card. Ends with a check that both are ready. |

Rules this implements:

- Only the free icons and colors listed in the file are allowed; unlockable ones get added later.
- Bio is up to 60 characters.
- Card stats are calculated from `daily_scores` each time, so edited results stay correct. Wins use the same rules as server stats: best score wins, ties share, unsolved can't win, finished days only, and a game-day counts once even if you won it in several servers.
