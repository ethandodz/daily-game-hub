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
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && innerWidth === 390), 'Play tab does not scroll sideways');
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

  // The clock runs from the challenge
  assert(/^⏱ 0:0\d$/.test((await page.textContent('#duelClock')).trim()), 'clock is running');

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
  assert((await page.textContent('#duelResult')).includes('You win!'), 'same number of guesses: the faster player wins');
  assert(/Your time 0:\d\d · @ethan 0:30/.test(await page.textContent('#duelResult')), 'both times are shown at the end');
  assert((await page.textContent('#duelClock')).includes('✓'), 'your clock stops when you solve it');
  assert((await page.textContent('#duelResult')).includes('CRANE'), 'answer is shown at the end');
  assert(!(await page.isVisible('#duelKeyboard')), 'keyboard hides at the end');
  await page.screenshot({ path: out + '-duel.png' });
  await page.click('#duelCloseButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#duelList')).includes('You beat @ethan'), 'finished duel shows at the top until you look at it');
  assert(!(await page.isVisible('#playHistory')), 'no History yet');
  await page.screenshot({ path: out + '-list-fresh.png', fullPage: true });
  await page.click('#duelList .duel-row:has-text("You beat @ethan") [data-action="dismiss"]'); await page.waitForTimeout(200);
  assert(!(await page.textContent('#duelList')).includes('You beat @ethan') && (await page.textContent('#duelHistory')).includes('You beat @ethan'), '✕ moves it to History');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('dailyGameHubSeenGames')).length === 1), 'remembered on this device');

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
  assert(await page.evaluate(() => TileSound.playing), 'music starts with the game');
  await page.click('#tileSoundButton');
  assert(!(await page.evaluate(() => TileSound.playing)) && (await page.textContent('#tileSoundButton')).trim() === '🔇', 'sound button turns the music off');
  assert(await page.evaluate(() => localStorage.getItem('dailyGameHubTileSound')) === 'off', 'sound choice is remembered');
  await page.click('#tileSoundButton');
  assert(await page.evaluate(() => TileSound.playing) && (await page.textContent('#tileSoundButton')).trim() === '🔊', 'and back on');
  const well = await page.$eval('#tileCanvas', c => ({ w: c.clientWidth, h: c.clientHeight }));
  assert(await page.$eval('.tile-controls', c => c.getBoundingClientRect().bottom <= innerHeight), 'controls fit on screen');
  assert(well.w > 150 && Math.abs(well.h / well.w - 2) < 0.05, 'board is 1:2 and fills the screen');
  assert(await page.isVisible('#tileHint'), 'tap guide shows when the game starts');
  await page.screenshot({ path: out + '-hint.png' });
  assert(await page.$$eval('.tile-controls button', bs => bs.map(b => b.dataset.tile).join(',')) === 'rotate,drop', 'only Rotate and Drop buttons');
  const box = await page.$eval('#tileWell', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const pieceAt = () => page.evaluate(() => ({ x: tileGame.state.piece.x, y: tileGame.state.piece.y }));
  const tapBoard = async part => { await page.mouse.click(Math.min(Math.max(box.x + box.w * part, 1), box.x + box.w - 1), box.y + box.h * 0.5); await page.waitForTimeout(50); };
  assert(box.x <= 0 && box.x + box.w >= await page.evaluate(() => innerWidth), 'tap area reaches both edges of the screen');
  let before = await pieceAt(); await tapBoard(0);
  assert((await pieceAt()).x === before.x - 1, 'tapping the left side moves left');
  await page.waitForTimeout(600);
  assert(!(await page.isVisible('#tileHint')), 'guide fades after the first tap');
  before = await pieceAt(); await tapBoard(1);
  assert((await pieceAt()).x === before.x + 1, 'tapping the right side moves right');
  await page.evaluate(() => tileGame.pause());
  before = await pieceAt(); await page.evaluate(() => tileGame.resume()); await tapBoard(0.5);
  assert((await pieceAt()).y >= before.y + 1 && (await pieceAt()).y <= before.y + 2, 'tapping the middle moves down a row, not all the way');
  await page.click('#tilePauseButton');
  assert(await page.isVisible('#tilePaused') && await page.evaluate(() => tileGame.state.paused && !TileSound.playing), 'pause stops the game and music');
  const pausedAt = await page.evaluate(() => tileGame.state.piece.x);
  await page.mouse.click(5, 400); await page.waitForTimeout(100);
  assert(await page.evaluate(x => tileGame.state.piece.x === x, pausedAt), 'taps do nothing while paused');
  await page.click('#tileResumeButton');
  assert(!(await page.isVisible('#tilePaused')) && await page.evaluate(() => !tileGame.state.paused && TileSound.playing), 'resume picks up where you left off');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert(await page.isVisible('#tilePaused'), 'leaving the app pauses the game');
  await page.screenshot({ path: out + '-paused.png' });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert(await page.isVisible('#tilePaused'), 'and waits for Resume when you come back');
  await page.click('#tileResumeButton');
  for (let i = 0; i < 40 && !(await page.isVisible('#tileOver')); i += 1) await page.click('[data-tile="drop"]');
  await page.waitForTimeout(600);
  assert(await page.isVisible('#tileOver'), 'game ends when the stack reaches the top');
  assert(!(await page.evaluate(() => TileSound.playing)), 'music stops at game over');
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
