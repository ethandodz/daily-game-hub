const { day, today, serverState, tables, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111', ETHAN = '22222222-2222-2222-2222-222222222222', MAYA = '33333333-3333-3333-3333-333333333333', SAM = '44444444-4444-4444-4444-444444444444';
serverState.servers.push({ id: 'srv-board', name: 'Ball Knowers', owner_id: ME, invite_code: 'BALL22', start_date: day(3), created_at: day(3) });
for (const [u, role] of [[ME, 'owner'], [ETHAN, 'member'], [MAYA, 'member'], [SAM, 'member']]) serverState.members.push({ server_id: 'srv-board', user_id: u, role, joined_at: day(3) });
['wordle', 'connections', 'krillion', 'immaculate'].forEach((g, i) => serverState.games.push({ server_id: 'srv-board', game_key: g, sort_order: i + 1, score_direction: null }));
const add = (user_id, game_id, play_date, numeric_score, completed = true, result_text = null) => tables.daily_scores.push({ id: 5000 + tables.daily_scores.length, user_id, game_id, play_date, numeric_score, completed, result_text, score_unit: { wordle: 'guesses', connections: 'mistakes', krillion: 'points' }[game_id] || null });
add(MAYA, 'wordle', today, 3, true, 'Wordle 1,585 3/6\n🟩🟩🟩🟩🟩');
add(MAYA, 'connections', today, 4, false); add(SAM, 'connections', today, 1);
add(MAYA, 'krillion', today, 385); add(SAM, 'krillion', today, 290);
add(ME, 'immaculate', today, 7, true, 'Immaculate Grid 7/9');
add(MAYA, 'wordle', day(1), 2);
try { localStorage = null; } catch (e) {}
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(2000);
    await page.click('[data-tab-button="social"]'); await page.waitForTimeout(400);
    if (await page.isVisible('#serverSwitcher')) await page.click('#serverSwitcher .filter-button:has-text("Ball Knowers")');
    await page.waitForTimeout(900);
    await page.click('[data-social-panel="today"]'); await page.waitForTimeout(200);
    const games = await page.$$eval('#serverBoard .board-game', bs => bs.map(b => ({
      name: b.querySelector('.board-game-name').textContent,
      crown: b.querySelector('.board-lead').textContent,
      rows: [...b.querySelectorAll('.board-row summary')].map(s => [...s.children].map(c => { const k = c.cloneNode(true); k.querySelectorAll('.avatar').forEach(a => a.remove()); return k.textContent.trim(); }).join(' ')),
      waiting: (b.querySelector('.board-waiting') || {}).textContent || '' })));
    if (scheme === 'dark') {
      const g = n => games.find(x => x.name === n);
      assert(g('Wordle').crown === '👑 you, @maya · 3 guesses', 'wordle tie leads: ' + g('Wordle').crown);
      assert(g('Wordle').rows.join('|') === '👑 @laur (you) 3 guesses|👑 @maya 3 guesses|3 @ethan 4 guesses', 'wordle ranks: ' + g('Wordle').rows.join('|'));
      assert(g('Wordle').waiting === 'Not played yet: @sam', 'wordle waiting: ' + g('Wordle').waiting);
      assert(g('Connections').rows.join('|') === '👑 @sam 1 mistake|2 @maya Not solved|– @ethan No score', 'connections: fail last, no-number after: ' + g('Connections').rows.join('|'));
      assert(g('Krillion').crown === '👑 @maya · 385 points' && g('Krillion').rows[0].startsWith('👑 @maya 385 points'), 'krillion higher wins: ' + g('Krillion').crown + ' / ' + g('Krillion').rows.join('|'));
      assert(g('Immaculate Grid').crown === '1 played' && g('Immaculate Grid').rows.join('|') === '– @laur (you) 7', 'no-winner game listed without crown: ' + g('Immaculate Grid').crown);
      assert(!(await page.isVisible('#serverBoard .board-game:first-child .board-row')), 'games start collapsed (one line each)');
      await page.click('#serverBoard .board-game:first-child .board-game-header'); await page.waitForTimeout(150);
      assert(await page.isVisible('#serverBoard .board-game:first-child .board-row'), 'tapping a game expands its ranking');
      const summary = await page.textContent('#serverBoardSummary');
      assert(summary === '👑 @maya 2 · you 1 · @sam 1 (leading so far)', 'summary: ' + summary);
      await page.locator('#serverBoard .board-row', { hasText: '@maya' }).first().locator('summary .board-score').click(); await page.waitForTimeout(200);
      assert((await page.locator('#serverBoard .board-row[open] .board-full').first().textContent()).includes('Wordle 1,585 3/6'), 'tap a row shows full result');
      await page.screenshot({ path: out + '-today.png', fullPage: true });
      await page.click('[data-board-day="yesterday"]'); await page.waitForTimeout(600);
      const y = await page.$$eval('#serverBoard .board-game', bs => bs.map(b => b.querySelector('.board-lead').textContent));
      assert(y[0] === '👑 @maya · 2 guesses', 'yesterday final winner: ' + y[0]);
      assert(await page.isVisible('#serverBoard .board-game:first-child .board-row'), 'expanded game stays open after switching day');
      assert((await page.textContent('#serverBoardSummary')).endsWith('(final)'), 'yesterday summary says final');
      assert((await page.textContent('#serverBoard')).includes('Didn’t play'), 'yesterday says didn’t play');
    }
    assert(errors.length === 0, scheme + ': no console errors ' + errors.join('|'));
    await ctx.close();
  }
  // server created today: yesterday is before start
  serverState.servers.find(x => x.id === 'srv-board').start_date = today;
  const { page, errors } = await setup(browser, { ...devices['iPhone 13'] });
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(400);
  if (await page.isVisible('#serverSwitcher')) await page.click('#serverSwitcher .filter-button:has-text("Ball Knowers")');
  await page.waitForTimeout(700);
  await page.click('[data-board-day="yesterday"]'); await page.waitForTimeout(400);
  assert((await page.textContent('#serverBoard')).startsWith('Scores count from'), 'before start date: explains');
  assert(errors.length === 0, 'no console errors');
  await browser.close(); server.close();
});
