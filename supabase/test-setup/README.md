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

In the test project's **Authentication → Sign In / Providers → Email**, turn off **Confirm email** so test accounts work right away.
