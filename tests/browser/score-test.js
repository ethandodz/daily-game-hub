const { requests, setup, server, devices, chromium, tables } = require('../helpers/mock.js');
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
// old results without numbers, for the backfill
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
tables.daily_scores.push(
  { id: 901, user_id: '11111111-1111-1111-1111-111111111111', game_id: 'framed', play_date: day(5), result_text: 'Framed #1684\n🎥 🟥 🟥 🟥 🟩 ⬛ ⬛', numeric_score: null },
  { id: 902, user_id: '11111111-1111-1111-1111-111111111111', game_id: 'krillion', play_date: day(6), result_text: 'Krillion #97 🦐\n290\n\n🫧🦑', numeric_score: null },
  { id: 903, user_id: '11111111-1111-1111-1111-111111111111', game_id: 'framed', play_date: day(7), result_text: 'played it, forgot to copy', numeric_score: null });
server.listen(0, async () => {
  const browser = await chromium.launch();
  const { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'light' });
  await page.goto(`http://localhost:${server.address().port}/`); await page.waitForTimeout(3000);
  // backfill
  const patches = requests.filter(r => r.method === 'PATCH');
  assert(patches.length === 3 && patches.some(p => p.url.includes('id=eq.17') && JSON.parse(p.body).numeric_score === 2) && patches.some(p => p.url.includes('id=eq.901') && JSON.parse(p.body).numeric_score === 4) && patches.some(p => p.url.includes('id=eq.902') && JSON.parse(p.body).numeric_score === 290), 'backfill fills old results it can read: ' + patches.map(p => p.url.split('?')[1] + ' ' + p.body).join(' | '));
  assert(!patches.some(p => p.url.includes('903')), 'backfill leaves unreadable results alone');
  const before = requests.length;
  await page.reload(); await page.waitForTimeout(2500);
  assert(!requests.slice(before).some(r => r.url.includes('numeric_score=is.null')), 'backfill runs only once per device');
  // live reading in the Enter Result window
  await page.click('[data-filter="all"]');
  await page.click('.game-card[data-id="connections"] .result-button'); await page.waitForTimeout(200);
  await page.fill('#resultText', 'Connections\nPuzzle #1223\n🟦🟨🟦🟦\n🟨🟨🟨🟨\n🟦🟦🟦🟦\n🟪🟪🟪🟪\n🟩🟩🟩🟩');
  assert(await page.textContent('#scoreDetected') === 'Read as: 1 mistake' && await page.inputValue('#numericScore') === '1' && await page.inputValue('#scoreUnit') === 'mistakes', 'pasting fills score: ' + await page.textContent('#scoreDetected'));
  await page.screenshot({ path: process.argv[3] + '-modal.png' });
  await page.click('#saveScoreButton'); await page.waitForTimeout(500);
  const post = requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).pop();
  const body = JSON.parse(post.body);
  assert(body.numeric_score === 1 && body.score_unit === 'mistakes' && body.completed === true, 'save sends the number: ' + post.body);
  // failed game
  await page.locator('[data-close="scoreModal"]').first().click().catch(() => {});
  await page.click('.game-card[data-id="framed"] .result-button'); await page.waitForTimeout(200);
  await page.fill('#resultText', 'Framed #1685\n🎥 🟥 🟥 🟥 🟥 🟥 🟥');
  assert((await page.textContent('#scoreDetected')).startsWith('Read as: not solved (counts as 7'), 'failed game: ' + await page.textContent('#scoreDetected'));
  await page.click('#saveScoreButton'); await page.waitForTimeout(500);
  const post2 = JSON.parse(requests.filter(r => r.method === 'POST' && r.url.includes('daily_scores')).pop().body);
  assert(post2.numeric_score === 7 && post2.completed === false, 'failed game saved as not completed: ' + JSON.stringify(post2));
  // player's own number wins
  await page.locator('[data-close="scoreModal"]').first().click().catch(() => {});
  await page.click('.game-card[data-id="krillion"] .result-button'); await page.waitForTimeout(200);
  await page.fill('#numericScore', '400');
  await page.fill('#resultText', 'Krillion #97 🦐\n290\n\n🫧🦑');
  assert(await page.inputValue('#numericScore') === '400', 'typed number is not overwritten');
  await page.fill('#resultText', 'great game today');
  assert((await page.textContent('#scoreDetected')).startsWith('Couldn’t read'), 'unreadable text shows a hint');
  // game without a reader: no message
  await page.locator('[data-close="scoreModal"]').first().click().catch(() => {});
  await page.click('.game-card[data-id="immaculate"] .result-button'); await page.waitForTimeout(200);
  await page.fill('#resultText', 'Immaculate Grid 7/9');
  assert(await page.textContent('#scoreDetected') === '', 'games without a reader show nothing');
  assert(errors.length === 0, 'no console errors ' + errors.join(' | '));
  await browser.close(); server.close();
});
