// Play tab: Dial In (like Wavelength), played together.
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

  const row = await page.textContent('#versusGames .play-game:has([data-game="dial_in"])');
  assert(row.includes('Dial In') && row.includes('TOGETHER') && row.includes('Wavelength'), 'Dial In is listed as a together game');
  await page.click(`.friend-chip[data-friend="${FRIEND}"]`); await page.waitForTimeout(300);
  await page.click('#challengeList .challenge-row[data-game="dial_in"]'); await page.waitForTimeout(800);
  assert((await page.textContent('#versusTitle')) === 'Dial In with @ethan', 'game screen opens');
  assert(await page.isVisible('.versus-rules'), 'quick rules on the first round');
  assert((await page.textContent('.dial-now .round-tag')) === 'You give the clue' && await page.$$eval('.dial-now .dial-band', b => b.length) === 3, 'clue-giver sees the target zone');
  assert((await page.textContent('.dial-now .dial-ends')).includes('Cold') && (await page.textContent('.dial-now .dial-ends')).includes('Hot'), 'scale ends shown');
  await page.screenshot({ path: out + '-clue.png' });
  await page.fill('#dialClueInput', 'Lukewarm'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  assert((await page.textContent('#dialStatus')).includes('Waiting for @ethan to guess') && (await page.textContent('.dial-now .dial-clue')).includes('Lukewarm'), 'clue sent, waiting for their guess');

  // They accept and guess
  const duel = m.serverState.duels.find(d => d.game === 'dial_in');
  duel.status = 'active'; duel.dialPlay.played[0].guess = 55; duel.dialPlay.played[0].points = 3;
  await page.waitForTimeout(2900);
  assert((await page.textContent('.dial-result')).includes('3 pts') && await page.$$eval('.dial-result .dial-needle', n => n.length) === 1, 'their guess and points are shown');
  assert((await page.textContent('#dialStatus')).includes("Waiting for @ethan's clue"), 'round 2: waiting for their clue');
  assert((await page.textContent('#versusScore')) === '3 pts', 'team score at the top');

  // Their clue comes in: I guess
  duel.dialPlay.played[1] = { clue: 'Awful', guess: null };
  await page.waitForTimeout(2900);
  assert(await page.isVisible('#dialSlider') && await page.$$eval('.dial-now .dial-band', b => b.length) === 0, 'guesser gets the dial, not the target');
  await page.$eval('#dialSlider', s => { s.value = 12; s.dispatchEvent(new Event('input')); });
  assert((await page.$eval('#dialNeedle', n => n.style.left)) === '12%', 'needle follows the dial');
  await page.screenshot({ path: out + '-guess.png' });
  await page.click('#dialLockButton'); await page.waitForTimeout(500);
  assert((await page.textContent('.dial-result')).includes('🎯 4 pts') && (await page.textContent('#versusScore')) === '7 pts', 'bullseye scores 4');
  assert((await page.textContent('.dial-now .round-tag')) === 'You give the clue', 'round 3: my turn to give the clue');

  // Skip ahead to the last round
  duel.dialPlay.played[2] = { clue: 'Hammer', guess: 60, points: 0 };
  duel.dialPlay.played[3] = { clue: 'Whisper', guess: 45, points: 3 };
  duel.dialPlay.played[4] = { clue: 'Dog', guess: 50, points: 4 };
  duel.dialPlay.played[5] = { clue: 'Bicycle', guess: null };
  await page.waitForTimeout(2900);
  await page.$eval('#dialSlider', s => { s.value = 40; s.dispatchEvent(new Event('input')); });
  await page.click('#dialLockButton'); await page.waitForTimeout(600);
  const end = await page.textContent('#versusBody');
  assert(end.includes('17 / 24') && end.includes('Pretty close'), 'final team score and rating');
  assert(await page.$$eval('.dial-result', c => c.length) === 6, 'all six rounds shown at the end');
  await page.screenshot({ path: out + '-end.png' });
  await page.click('#versusCloseButton'); await page.waitForTimeout(600);
  assert((await page.textContent('#duelList')).includes('Dial In with @ethan') && (await page.textContent('#duelList')).includes('Team score 17 / 24'), 'the Play tab shows the team score');

  assert(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); m.server.close();
});
