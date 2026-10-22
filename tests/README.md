# Tests

Automated checks for Daily Game Hub. GitHub runs them on every pull request
(`.github/workflows/tests.yml`); a red ✗ on the PR means something broke.

| Folder | What it checks |
|---|---|
| `unit/` | Score readers, game detection, ranking, stats math, version numbers — straight from `app.js` |
| `browser/` | The real app in a headless Chromium (iPhone and desktop sizes, light and dark) against a fake Supabase (`helpers/mock.js`) |
| `sql/` | The Servers database setup and security rules, on a throwaway Postgres that mimics Supabase |

## Run them yourself

```bash
cd tests
npm install
npx playwright install chromium
npm test                 # unit + browser
npm run test:sql         # database (needs Postgres; set PGHOST/PGUSER/PGPASSWORD)
node run-all.js stats    # only tests whose path contains "stats"
```

Screenshots from the browser tests land in `tests/output/` (not committed).

## When you change the app

- Bump the version before merging so open apps show "A new version is ready":
  `python3 tools/bump-version.py`
- If a test fails because the app *should* behave differently now, update the test in the
  same pull request and say why.
