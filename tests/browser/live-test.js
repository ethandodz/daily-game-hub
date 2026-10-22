const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111', MAYA = '33333333-3333-3333-3333-333333333333';
m.serverState.servers.push({ id: 'srv-live', name: 'Live Club', owner_id: ME, invite_code: 'LIVE22', start_date: m.day(2), created_at: m.day(2) });
for (const u of [ME, MAYA]) m.serverState.members.push({ server_id: 'srv-live', user_id: u, role: u === ME ? 'owner' : 'member', joined_at: m.day(2) });
m.serverState.games.push({ server_id: 'srv-live', game_key: 'krillion', sort_order: 1 });
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await page.clock.install();
  await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(800);
  if (await page.locator('#serverSwitcher .filter-button:not(.active):has-text("Live Club")').count()) { await page.click('#serverSwitcher .filter-button:has-text("Live Club")'); await page.waitForTimeout(800); }
  await page.click('[data-social-panel="today"]');
  const lead = () => page.$eval('#serverBoard .board-game .board-lead', e => e.textContent);
  assert(await lead() === 'no results yet', 'board starts empty');
  m.tables.daily_scores.push({ id: 7777, user_id: MAYA, game_id: 'krillion', play_date: m.today, numeric_score: 512, completed: true, result_text: 'Krillion #99\n512', score_unit: 'points' });
  await page.clock.fastForward('00:31'); await page.waitForTimeout(800);
  assert(await lead() === '👑 @maya · 512 points', 'new score appears within 30 seconds: ' + await lead());
  // hidden: no board requests
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); });
  const before = m.requests.length;
  await page.clock.fastForward('01:05'); await page.waitForTimeout(500);
  assert(m.requests.slice(before).filter(r => r.url.includes('daily_scores')).length === 0, 'nothing refreshes while the app is hidden');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  // Games tab: card results every 60s
  await page.click('[data-tab-button="games"]'); await page.waitForTimeout(300);
  const b2 = m.requests.length;
  await page.clock.fastForward('01:01'); await page.waitForTimeout(800);
  assert(m.requests.slice(b2).some(r => r.url.includes('daily_scores') && r.url.includes('play_date=eq.')), 'Games tab refreshes results under cards');
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
