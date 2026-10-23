# Test database setup

A separate Supabase project used only by the test copy of the app, so testing never touches real scores, coins or Servers.

Run these in the **test** project's SQL Editor, in this order. Each is safe to run again.

| Step | Where | File | What it does |
|---|---|---|---|
| 1 | Test project | `test-setup/01_base_tables.sql` | Creates the original tables (profiles, games, user games, scores, played status, friendships, feedback) with the same security rules as the real database. Ends by listing 8 tables. |
| 2 | **Real** project | `test-setup/02_copy_games_from_real.sql` | Read-only. Prints the games list as SQL. Copy the one result cell. |
| 3 | Test project | (the result from step 2) | Adds the games to the test database. |
| 4 | Test project | `servers/01` … `servers/06` | Servers, same as the real database. |
| 5 | Test project | `cards/01` … `cards/03` | Player cards, achievements, coins and the shop. |
| 6 | Test project | `play/01` … `play/03` | The Play tab games. |
| 7 | Test project **only** | `test-setup/03_bots.sql` | Adds a computer player, **@robo_bot**, so you can try every Play tab game alone. It joins every Server (and new ones), always shows as online, accepts challenges right away and plays its turns while you play. Never run this in the real project. |

In the test project's **Authentication → Sign In / Providers → Email**, turn off **Confirm email** so test accounts work right away.

## Playing against the computer (test app only)

After step 7, open the Play tab in the test app: **@robo_bot** shows under *Online now*. Tap it, pick a game, and play. It:

- **Wordle Duel:** guesses every few seconds, using what its earlier guesses showed.
- **Word Race, Trivia, Higher or Lower:** plays its whole turn as soon as it accepts (about 7 in 10 trivia answers right, a streak of a few in Higher or Lower).
- **Mind Meld:** says its first word straight away, then answers after you each round, more likely to match as the rounds go on.
- **Dial In:** gives clues like "Kind of Hot" and guesses near the target.

The real database has a matching do-nothing step (`dgh_bot_hook` in `play/03_versus_games.sql`), so nothing about bots happens there.
