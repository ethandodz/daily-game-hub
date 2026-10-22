# Player cards database setup

Run in the Supabase dashboard → **SQL Editor** after the Servers files (`supabase/servers`), one file at a time, in order. Each is safe to run again.

| Step | File | What it does |
|---|---|---|
| 1 | `01_player_cards.sql` | Adds `player_cards` (icon, card color, bio, favorite game). You can see your own card and the cards of people who share a server with you; you can only change your own. Adds `player_card_stats(user_id, today)` for the numbers on a card. Ends with a check that both are ready. |
| 2 | `02_achievements_and_coins.sql` | Changes the Krillion icon to 🦐, GuessList to 💯 and Poople to 💩. Adds the achievement list (19 achievements, most with bronze/silver/gold/diamond tiers), up to 3 showcase badges per card, and `player_achievements` / `player_coins` for a card. Ends with a check showing 19 achievements. |
| 3 | `03_shop.sql` | The shop: 35 items (icons, card frames, name colors, titles). Most cost coins; some are unlocked by a badge tier instead. Adds `purchases`, `buy_item(item_id, today)`, coin balances minus spending, and a check that cards only use free icons and items the player owns. Ends with a check showing the number of items. |

Rules this implements:

- Only the free icons and colors listed in the file are allowed; unlockable ones get added later.
- Bio is up to 60 characters.
- Card stats are calculated from `daily_scores` each time, so edited results stay correct. Wins use the same rules as server stats: best score wins, ties share, unsolved can't win, finished days only, and a game-day counts once even if you won it in several servers.
- Achievements and coins are also calculated each time, never stored, so nobody can edit their own balance and changed results stay correct.
- Coins: +5 per day with a result and +2 per result (up to 5 a day); +15 per game-day won in a server with 2+ players (once per game-day); +100 for winning a week and +300 for a month in a server (most wins, and separately best average place with at least 4 days played in the week or 15 in the month; ties share; the week or month must be over); +25 / 50 / 100 / 200 per badge tier.
- Shop purchases can only be made through `buy_item`, which checks the balance; nobody can add purchases or equip items they don't own.
