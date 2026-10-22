const m = require('../helpers/mock.js');
const fs = require('fs');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111', ETHAN = '22222222-2222-2222-2222-222222222222', MAYA = '33333333-3333-3333-3333-333333333333';
m.serverState.servers.push({ id: 'srv-sh', name: 'Ball Knowers', owner_id: ME, invite_code: 'SHR222', start_date: m.day(10), created_at: m.day(10) });
for (const u of [ME, ETHAN, MAYA]) m.serverState.members.push({ server_id: 'srv-sh', user_id: u, role: 'member', joined_at: m.day(10) });
m.serverState.games.push({ server_id: 'srv-sh', game_key: 'wordle', sort_order: 1 });
m.tables.daily_scores.length = 0;
for (let n = 1; n <= 10; n++) [[ME, 2], [ETHAN, n % 2 ? 2 : 4], [MAYA, 5]].forEach(([u, v], i) => m.tables.daily_scores.push({ id: n * 10 + i, user_id: u, game_id: 'wordle', play_date: m.day(n), numeric_score: v, completed: true }));
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  const { page, ctx, errors } = await m.setup(browser, { viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2000);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(800);
  if (await page.locator('#serverSwitcher .filter-button:not(.active):has-text("Ball Knowers")').count()) { await page.click('#serverSwitcher .filter-button:has-text("Ball Knowers")'); await page.waitForTimeout(1000); }
  await page.click('[data-social-panel="stats"]'); await page.waitForTimeout(500);
  await page.click('[data-stats-period="all"]'); await page.waitForTimeout(300);
  assert(await page.isVisible('#shareStandingsButton'), 'Share standings button shows');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#shareStandingsButton')]);
  const file = process.argv[3] + '-standings.png';
  await download.saveAs(file);
  assert(download.suggestedFilename() === 'ball-knowers-standings.png' && fs.statSync(file).size > 10000, 'computer: downloads the picture (' + download.suggestedFilename() + ')');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
