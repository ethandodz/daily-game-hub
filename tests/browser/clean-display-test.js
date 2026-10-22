const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111', MAYA = '33333333-3333-3333-3333-333333333333';
m.serverState.servers.push({ id: 'srv-c', name: 'Clean Club', owner_id: ME, invite_code: 'CLN222', start_date: m.day(3), created_at: m.day(3) });
for (const u of [ME, MAYA]) m.serverState.members.push({ server_id: 'srv-c', user_id: u, role: 'member', joined_at: m.day(3) });
m.serverState.games.push({ server_id: 'srv-c', game_key: 'framed', sort_order: 1 });
m.tables.daily_scores.length = 0;
// Results saved before cleaning existed, with links still in them.
m.tables.daily_scores.push(
  { id: 1, user_id: ME, game_id: 'framed', play_date: m.today, numeric_score: 4, score_unit: 'guesses', completed: true, result_text: 'Framed #1684\n🎥 🟥 🟥 🟥 🟩 ⬛ ⬛\n\nhttps://framed.wtf' },
  { id: 2, user_id: MAYA, game_id: 'framed', play_date: m.today, numeric_score: 2, score_unit: 'guesses', completed: true, result_text: 'Framed #1684\n🎥 🟥 🟩 ⬛ ⬛ ⬛ ⬛\n\nhttps://framed.wtf' });
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  const { page, ctx, errors } = await m.setup(browser, { ...m.devices['iPhone 13'] });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${m.server.address().port}` });
  await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2500);
  const noLink = text => !/https?:|www\./.test(text);
  await page.click('[data-filter="all"]');
  const card = page.locator('.game-card[data-id="framed"]');
  assert(noLink(await card.locator('.result-summary').textContent()), 'your old result on the card has no link');
  assert(noLink(await card.locator('.friend-results').textContent()), 'others’ old results on the card have no link');
  await m.openCard(page, 'framed'); await card.locator('.expand-button').click(); await page.waitForTimeout(200);
  await card.locator('.history-button').click(); await page.waitForTimeout(600);
  assert(noLink(await page.textContent('#historyList')) && (await page.textContent('#historyList')).includes('Framed #1684'), 'History shows the result without the link');
  await page.click('[data-close="historyModal"]');
  await card.locator('.expand-button').click();
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(1200);
  if (await page.locator('#serverSwitcher .filter-button:not(.active):has-text("Clean Club")').count()) { await page.click('#serverSwitcher .filter-button:has-text("Clean Club")'); await page.waitForTimeout(1000); }
  await page.click('[data-social-panel="today"]');
  await page.click('#serverBoard .board-game-header'); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#serverBoard details').forEach(d => d.open = true));
  const board = await page.textContent('#serverBoard');
  assert(noLink(board) && board.includes('🎥'), 'server board shows results without links');
  // editing an old result: the box shows it clean
  await page.click('[data-tab-button="games"]');
  await m.openCard(page, 'framed'); await card.locator('.result-button').click(); await page.waitForTimeout(300);
  assert(noLink(await page.inputValue('#resultText')) && await page.inputValue('#numericScore') === '4', 'Edit Result shows the saved result without the link');
  await page.click('[data-close="scoreModal"]');
  // pasting a new result with a link
  await page.evaluate(t => navigator.clipboard.writeText(t), 'GuessList (October 22, 2026)\nScore: 120/490\n\n🟨🟨🟨🟥🟨\n\nBest Guess: #59\n\nPlay at: https://playguesslist.com');
  await page.click('#pasteResultButton'); await page.waitForTimeout(400);
  const pasted = await page.inputValue('#resultText');
  const isOpen = await page.evaluate(() => document.getElementById('scoreModal').classList.contains('open') || document.getElementById('pasteModal').classList.contains('open'));
  assert(isOpen, 'paste opens a window');
  // GuessList isn't in the sample library, so pick a game and continue
  if (await page.isVisible('#pasteGameSelect')) { await page.selectOption('#pasteGameSelect', 'krillion'); await page.click('#pasteContinueButton'); await page.waitForTimeout(300); }
  assert(noLink(await page.inputValue('#resultText')) && !(await page.inputValue('#resultText')).includes('Play at'), 'pasted result shows without the link: ' + JSON.stringify(await page.inputValue('#resultText')));
  // typing a link by hand: saved clean anyway
  await page.fill('#resultText', 'Krillion #99 🦐\n410\n\nhttps://krillion.example/share');
  await page.click('#saveScoreButton'); await page.waitForTimeout(600);
  const saved = JSON.parse(m.requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).pop().body);
  assert(saved.result_text === 'Krillion #99 🦐\n410' && saved.numeric_score === 410, 'saved without the link, score still read: ' + JSON.stringify(saved.result_text));
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); m.server.close();
});
