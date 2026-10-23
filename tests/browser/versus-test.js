// Play tab: header, online friends, Wordle Duel and Tile Drop with leaderboards.
const m = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const FRIEND = '22222222-2222-2222-2222-222222222222';
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: process.env.SCHEME || 'light' });
  page.on('dialog', d => d.accept());
  m.serverState.members.push({ server_id: 'srv-ethan', user_id: m.ME, role: 'member', joined_at: '2026-10-02' });
  await page.goto(url); await page.waitForTimeout(1500);

  // Tab bar: five tabs with Play (the logo) in the middle
  const tabs = await page.$$eval('.tab-bar [data-tab-button]', bs => bs.map(b => b.dataset.tabButton));
  assert(tabs.join(',') === 'games,social,play,activity,account', 'Play is the middle of five tabs');
  const bar = await page.$eval('.tab-bar', b => b.getBoundingClientRect().width);
  const middle = await page.$eval('[data-tab-button="play"]', b => { const r = b.getBoundingClientRect(); return r.left + r.width / 2; });
  assert(Math.abs(middle - bar / 2) < 2, 'Play tab is centered');

  await page.click('[data-tab-button="play"]'); await page.waitForTimeout(800);
  assert(await page.isVisible('#playView .play-title'), 'Play header shows');
  assert((await page.textContent('#playOnline')).trim() === '1 online', 'live pill counts online friends');
  const chips = await page.$$eval('.friend-chip', cs => cs.map(c => c.lastElementChild.textContent + ':' + Boolean(c.querySelector('.online-dot.on'))));
  assert(chips.join(',') === 'ethan:true,maya:false', 'friend strip lists online friends first with a green dot');
  assert(m.requests.some(r => r.url.endsWith('/rpc/heartbeat')), 'sends a heartbeat');
  await page.screenshot({ path: out + '-tab.png' });

  // Challenge from the Games list
  await page.click('#wordleDuelButton'); await page.waitForTimeout(300);
  assert(await page.isVisible('#challengeModal .challenge-row'), 'challenge picker lists friends');
  await page.click(`#challengeModal .challenge-row[data-friend="${FRIEND}"]`); await page.waitForTimeout(800);
  assert(await page.isVisible('#duelScreen'), 'duel screen opens');
  assert((await page.textContent('#duelTitle')).includes('@ethan'), 'duel title names the opponent');
  assert(await page.evaluate(() => { const r = document.getElementById('duelScreen').getBoundingClientRect(); const t = document.querySelector('.tab-bar').getBoundingClientRect();
    return document.elementFromPoint(t.left + 10, t.top + 10)?.closest('#duelScreen') !== null && r.height >= innerHeight - 1; }), 'duel screen covers the tab bar');

  // Typing and guessing
  await page.keyboard.type('cra');
  assert((await page.$$eval('#duelMyBoard .duel-square.typed', s => s.map(x => x.textContent).join(''))) === 'CRA', 'typed letters show');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  assert((await page.textContent('#duelMessage')).includes('Not enough letters'), 'short guess is rejected');
  await page.keyboard.type('zz');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  assert((await page.textContent('#duelMessage')).includes('Not in word list'), 'unknown word is rejected');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  for (const letter of 'trace') await page.click(`.duel-key[data-key="${letter}"]`);
  await page.click('.duel-key[data-key="enter"]'); await page.waitForTimeout(500);
  const row1 = await page.$$eval('#duelMyBoard .duel-row-squares:first-child .duel-square', s => s.map(x => x.dataset.mark).join(''));
  assert(row1 === 'BGGYG', 'guess gets colored by the database (TRACE vs CRANE)');
  assert(await page.$eval('.duel-key[data-key="r"]', k => k.dataset.mark) === 'G', 'keyboard shows letter colors');
  await page.screenshot({ path: out + '-playing.png' });
  assert(await page.$eval('#duelKeyboard', k => k.getBoundingClientRect().bottom <= innerHeight), 'keyboard fits on screen');

  // The opponent accepts and solves in 3; the next poll shows their squares
  const duel = m.serverState.duels[0];
  duel.status = 'active'; duel.guesses[FRIEND].push('slate', 'crate');
  await page.waitForTimeout(2600);
  const theirs = await page.$$eval('#duelTheirBoard .duel-row-squares', rows => rows.filter(r => r.querySelector('[data-mark]')).length);
  assert(theirs === 2, 'opponent squares appear (colors only)');
  assert(await page.$eval('#duelTheirBoard', b => !/[A-Z]/.test(b.textContent)), "opponent's letters stay hidden");
  duel.guesses[FRIEND].push('crane');
  await page.keyboard.type('slate'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.keyboard.type('crane'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  assert(await page.isVisible('#duelResult'), 'result shows when the duel ends');
  assert((await page.textContent('#duelResult')).includes("It's a draw"), 'equal guesses is a draw');
  assert((await page.textContent('#duelResult')).includes('CRANE'), 'answer is shown at the end');
  assert(!(await page.isVisible('#duelKeyboard')), 'keyboard hides at the end');
  await page.screenshot({ path: out + '-duel.png' });
  await page.click('#duelCloseButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#duelList')).includes('Draw with @ethan'), 'finished duel shows in the list');

  // Someone challenges me: accept from the banner
  m.serverState.duels.push({ id: 'duel-in', challenger: FRIEND, opponent: m.ME, answer: 'crane', status: 'pending', winner: null, created_at: new Date().toISOString(), finished_at: null, guesses: { [FRIEND]: ['crane'], [m.ME]: [] } });
  await page.evaluate(() => loadPlayTab()); await page.waitForTimeout(500);
  assert((await page.textContent('#duelList .duel-row.open')).includes('@ethan challenged you'), 'incoming challenge shows a banner');
  await page.click('#duelList [data-action="accept"]'); await page.waitForTimeout(700);
  assert(m.serverState.duels[1].status === 'active' && await page.isVisible('#duelScreen'), 'accepting starts the duel');
  await page.click('#duelGiveUpButton'); await page.waitForTimeout(500);
  assert((await page.textContent('#duelResult')).includes('@ethan wins'), 'giving up hands them the win');
  await page.click('#duelCloseButton'); await page.waitForTimeout(400);

  // Tile Drop: hard-drop until the stack tops out, then the score is saved
  await page.click('#tileDropButton'); await page.waitForTimeout(400);
  assert(await page.isVisible('#tileDropScreen'), 'Tile Drop opens');
  const well = await page.$eval('#tileCanvas', c => ({ w: c.clientWidth, h: c.clientHeight }));
  assert(await page.$eval('.tile-controls', c => c.getBoundingClientRect().bottom <= innerHeight), 'controls fit on screen');
  assert(well.w > 150 && Math.abs(well.h / well.w - 2) < 0.05, 'board is 1:2 and fills the screen');
  assert(await page.isVisible('#tileHint'), 'tap guide shows when the game starts');
  await page.screenshot({ path: out + '-hint.png' });
  assert(await page.$$eval('.tile-controls button', bs => bs.map(b => b.dataset.tile).join(',')) === 'rotate,drop', 'only Rotate and Drop buttons');
  const box = await page.$eval('#tileCanvas', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const pieceAt = () => page.evaluate(() => ({ x: tileGame.state.piece.x, y: tileGame.state.piece.y }));
  const tapBoard = async part => { await page.mouse.click(box.x + box.w * part, box.y + box.h * 0.5); await page.waitForTimeout(50); };
  let before = await pieceAt(); await tapBoard(0.15);
  assert((await pieceAt()).x === before.x - 1, 'tapping the left side moves left');
  await page.waitForTimeout(600);
  assert(!(await page.isVisible('#tileHint')), 'guide fades after the first tap');
  before = await pieceAt(); await tapBoard(0.85);
  assert((await pieceAt()).x === before.x + 1, 'tapping the right side moves right');
  await page.evaluate(() => tileGame.pause());
  before = await pieceAt(); await page.evaluate(() => tileGame.resume()); await tapBoard(0.5);
  assert((await pieceAt()).y >= before.y + 1 && (await pieceAt()).y <= before.y + 2, 'tapping the middle moves down a row, not all the way');
  for (let i = 0; i < 40 && !(await page.isVisible('#tileOver')); i += 1) await page.click('[data-tile="drop"]');
  await page.waitForTimeout(600);
  assert(await page.isVisible('#tileOver'), 'game ends when the stack reaches the top');
  const saved = m.requests.filter(r => r.url.endsWith('/rpc/submit_arcade_score')).map(r => JSON.parse(r.body));
  assert(saved.length === 1 && saved[0].p_score > 0 && saved[0].p_game === 'tile_drop', 'score is submitted once');
  assert((await page.textContent('#tileOver')).includes('#'), 'game over shows your rank');
  await page.screenshot({ path: out + '-tiledrop.png' });
  await page.click('#tileOver .play-go.secondary'); await page.waitForTimeout(500);
  assert(await page.isVisible('#leaderboardModal'), 'leaderboard opens over the game');
  const rows = await page.$$eval('#leaderboardList .leaderboard-row', rs => rs.map(r => r.textContent));
  assert(rows.length === 3 && rows[0].includes('@ethan') && rows[0].includes('👑'), 'leaderboard ranks scores');
  assert(await page.$$eval('#leaderboardScopes [data-server]', bs => bs.map(b => b.textContent).join(',')) === 'Everyone,Work Crew', 'leaderboard can filter by server');
  await page.screenshot({ path: out + '-leaderboard.png' });

  assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); m.server.close();
});
