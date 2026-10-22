# Servers database setup

Run these in the Supabase dashboard → **SQL Editor**, one file at a time, in order.
Each file is safe to run again if something is interrupted.

| Step | File | What it does |
|---|---|---|
| 1 | `01_game_scoring.sql` | Adds `games.score_direction` (lower / higher / none) and sets it for the official games. Ends with a check query listing every game. |
| 2 | `02_server_tables.sql` | Creates `servers`, `server_members`, `server_games` with row level security on (locked until step 3). |
| 3 | `03_server_security.sql` | Membership helper functions and policies: members see their servers; owners rename/delete, manage games and remove members; anyone can leave except the owner. Only the server name can be edited directly. |
| 4 | `04_server_functions.sql` | `create_server(name, game_keys, start_date)`, `join_server(invite_code)`, `reset_invite_code(server_id)`. |
| 5 | `05_server_score_visibility.sql` | Adds a `daily_scores` read policy so members see each other's results for that server's games, from the server's start date on. Existing policies are unchanged. |
| 6 | `06_more_game_directions.sql` | Sets winners for Box Office Game and Perceptle (higher wins) and Duotrigordle and Immaculate Grid (lower wins). Ends with a check query listing every game. |

Rules this implements:

- Scores in a server count from the day it was created (its `start_date`), including results from members who join later.
- Joining is by 6-character invite code only; the owner can reset the code.
- Deleting a server never deletes anyone's results.
- No winners or stats are stored; they are calculated from `daily_scores`, so edited results stay correct.
