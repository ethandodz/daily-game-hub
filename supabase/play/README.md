# Play tab database setup

Run in the Supabase **SQL Editor**, in order, after the Servers and player card files. Each is safe to run again. Try them in the **test** project first.

| Step | File | What it does |
|---|---|---|
| 1 | `01_wordle_duel.sql` | Who's online (`heartbeat`, `server_friends`), and Wordle Duel: the 2,315 answer words, duels and guesses. Only the database knows the answer; guesses are colored here and you only see your opponent's colors. Ends with a check showing 2315 answer words. |
| 2 | `02_arcade.sql` | Arcade scores and leaderboards for Tile Drop: today, this week and all time, for each of your servers or everyone. Impossible scores are turned away. |

Wordle Duel rules: fewest guesses to solve wins, the same number is a draw, and the game ends as soon as the result can't change. You can challenge anyone who shares a server with you; the challenger can start playing right away.
