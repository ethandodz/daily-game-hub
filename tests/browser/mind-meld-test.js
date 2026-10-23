// Play tab: Mind Meld (say the same word as your friend).
const m = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const FRIEND = '22222222-2222-2222-2222-222222222222';
const ME = m.ME;
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: process.env.SCHEME || 'light' });
  page.on('dialog', d => d.accept());
  m.serverState.members.push({ server_id: 'srv-ethan', user_id: ME, role: 'member', joined_at: '2026-10-02' });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="play"]'); await page.waitForTimeout(700);
  await page.evaluate(() => { playableGames = () => VERSUS_GAMES; renderPlayGames(); });

  const row = await page.textContent('#versusGames .play-game:has([data-game="mind_meld"])');
  assert(row.includes('Mind Meld') && row.includes('TOGETHER') && row.includes('TESTING'), 'Mind Meld is listed as a together game');

  await page.click('#versusGames [data-game="mind_meld"]'); await page.waitForTimeout(300);
  await page.click(`#challengeList .challenge-row[data-friend="${FRIEND}"]`); await page.waitForTimeout(800);
  assert((await page.textContent('#versusTitle')) === 'Mind Meld with @ethan', 'game screen opens');
  assert((await page.textContent('#meldPrompt')).includes('say any word'), 'round 1: say any word');
  await page.fill('#meldInput', ' Ocean '); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert((await page.textContent('#meldStatus')).includes('You said OCEAN. Waiting for @ethan'), 'your word waits for theirs');
  assert(!(await page.isVisible('#meldForm')), 'no second word in the same round');

  // They accept and say their word: both appear on the next check
  const duel = m.serverState.duels.find(d => d.game === 'mind_meld');
  duel.status = 'active'; duel.words[FRIEND] = ['beach'];
  await page.waitForTimeout(2900);
  assert(await page.$$eval('.meld-round .meld-word', w => w.map(x => x.textContent).join(' ')) === 'OCEAN BEACH', 'both words revealed');
  const prompt = await page.textContent('#meldPrompt');
  assert(prompt.includes('Round 2') && prompt.includes('OCEAN') && prompt.includes('BEACH'), 'round 2 asks for a word linking both');
  await page.screenshot({ path: out + '-round2.png' });

  await page.fill('#meldInput', 'beach'); await page.click('#meldForm .play-go'); await page.waitForTimeout(300);
  assert((await page.textContent('#meldStatus')).includes('already said'), 'words already said are turned away');

  duel.words[FRIEND].push('sand');
  await page.waitForTimeout(2900);
  assert((await page.textContent('#meldStatus')).includes('@ethan is ready'), 'shows when they have their word in');
  await page.fill('#meldInput', 'sand'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  assert(await page.isVisible('#meldDone') && (await page.textContent('#meldDone')).includes('You both said SAND in 2 rounds'), 'matching words ends it together');
  assert(await page.$eval('.meld-round:last-child', r => r.classList.contains('match')), 'the matching round turns green');
  await page.screenshot({ path: out + '-match.png' });
  await page.click('#versusCloseButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#duelList')).includes('Mind meld with @ethan') && (await page.textContent('#duelList')).includes('SAND in 2 rounds'), 'the Play tab shows the match');

  // An invite from them
  m.serverState.duels.push({ id: 'mm-in', game: 'mind_meld', challenger: FRIEND, opponent: ME, answer: '', status: 'pending', winner: null, created_at: new Date().toISOString(), finished_at: null, guesses: { [FRIEND]: [], [ME]: [] }, plays: {}, words: { [FRIEND]: ['moon'], [ME]: [] } });
  await page.evaluate(() => loadPlayTab()); await page.waitForTimeout(600);
  assert((await page.textContent('#duelList .duel-row[data-duel="mm-in"]')).includes('@ethan wants to Mind Meld'), 'invites show on the Play tab');
  await page.click('#duelList .duel-row[data-duel="mm-in"] [data-action="accept"]'); await page.waitForTimeout(800);
  assert((await page.textContent('#meldStatus')).includes('@ethan is ready'), 'after accepting you can say your word');
  await page.click('#versusGiveUpButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#meldDone')).includes('Game over'), 'ending early has no winner');

  assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); m.server.close();
});
