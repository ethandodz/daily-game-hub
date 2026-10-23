# Play tab database setup

Run in the Supabase **SQL Editor**, in order, after the Servers and player card files. Each is safe to run again. Try them in the **test** project first.

| Step | File | What it does |
|---|---|---|
| 1 | `01_wordle_duel.sql` | Who's online (`heartbeat`, `server_friends`), and Wordle Duel: the 2,315 answer words, duels and guesses. Only the database knows the answer; guesses are colored here and you only see your opponent's colors. Ends with a check showing 2315 answer words. |
| 2 | `02_arcade.sql` | Arcade scores and leaderboards for Tile Drop: today, this week and all time, for each of your servers or everyone. Impossible scores are turned away. |
| 3 | `03_versus_games.sql` | Word Race, Trivia Showdown and Higher or Lower: the 400 Word Race starting words, the trivia questions and the Higher or Lower facts, plus the rules. Like Wordle Duel, answers stay in the database. Ends with a check showing how many words, questions and facts loaded. If you ever run step 1 again, run this one again after it. |

Wordle Duel rules: fewest guesses to solve wins, the same number is a draw, and the game ends as soon as the result can't change. You can challenge anyone who shares a server with you; the challenger can start playing right away.

## The newer versus games

- **Word Race**: same 9 letters, 2 minutes each. Longer words score more (3 letters = 1 point up to all 9 = 20). Most points wins.
- **Trivia Showdown**: the same 10 questions, 12 seconds each. Each question's point goes to whoever got it right faster.
- **Higher or Lower**: pick which of two has the bigger number, 10 seconds a pick. One miss ends your turn. Longest streak wins; a tie goes to the quicker player.

**Releasing a game to the real app:** these show only in the test app at first. To release one, set `released: true` for it in `VERSUS_GAMES` at the top of `play.js` (and make sure `03_versus_games.sql` has been run in the real project).

**Adding questions or facts:** edit the files in `source/` (one per line, tab-separated; the right trivia answer goes first), run `python3 tools/build-versus-sql.py`, then run `03_versus_games.sql` again.

Word Race word list: SCOWL, Copyright 2000-2016 Kevin Atkinson, used under its permission notice (free to use, copy and share with this notice).
