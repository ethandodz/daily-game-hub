const { serverState, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111';
const missing = Boolean(process.env.NO_ACHIEVEMENTS);
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const { page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: 'dark' });
  await page.goto(url); await page.waitForTimeout(1800);
  await page.click('[data-tab-button="account"]'); await page.waitForTimeout(700);
  const text = sel => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
  if (missing) {
    // Before the achievements database file is run, everything else still works.
    assert(!(await page.isVisible('#achievementsSection')) && !(await page.isVisible('#myCoinsButton')), 'not set up yet: no achievements or coins shown');
    await page.click('#editCardButton'); await page.waitForTimeout(200);
    assert(!(await page.isVisible('#showcaseField')), 'not set up yet: no badge picker');
    await page.click('#iconChoices [data-icon="🐼"]'); await page.click('#saveCardButton'); await page.waitForTimeout(500);
    const saved = serverState.cards.find(c => c.user_id === ME);
    assert(saved && saved.icon === '🐼' && !('showcase' in saved), 'not set up yet: card saves without badges ' + JSON.stringify(saved));
    assert(errors.every(e => /Achievements failed|Coins failed|Shop failed|404/.test(e)), 'only the expected missing-feature errors ' + errors.join('|'));
    await browser.close(); server.close(); return;
  }
  // Coins
  assert(await text('#myCoinsButton') === '🪙 1,240', 'coins on card: ' + await text('#myCoinsButton'));
  await page.click('#myCoinsButton'); await page.waitForTimeout(200);
  assert(await text('#coinsTitle') === '🪙 1,240', 'coins window title');
  const coinRows = await page.$$eval('#coinHistory .coin-row', r => r.map(x => [...x.children].map(c => c.textContent).join(' ')));
  assert(coinRows.length === 3 && coinRows[0] === 'Badge Badge: Winner Silver +50' && coinRows[1].endsWith('Won Wordle +15'), 'coin history: ' + coinRows.join(' | '));
  await page.screenshot({ path: out + '-coins.png' });
  await page.click('[data-close="coinsModal"]');
  // Achievements
  assert(await page.isVisible('#achievementsSection') && !(await page.isVisible('#achievementList')), 'achievements shown, folded');
  assert(await text('#achievementsCount') === '5 of 15', 'achievement tiers count: ' + await text('#achievementsCount'));
  assert(await page.isVisible('#myShowcaseHint'), 'hint to pick badges');
  await page.click('#achievementsSection summary'); await page.waitForTimeout(200);
  const rows = await page.$$eval('.achievement-row', r => r.map(x => x.querySelector('b').textContent + '|' + x.querySelector('.achievement-tier').textContent + '|' + x.querySelector('.achievement-count').textContent + '|' + x.querySelectorAll('.tier-dots i.on').length + '|' + x.classList.contains('locked')));
  assert(rows[0] === 'Winner|Silver|31 / 50 for Gold|2|false', 'tiered achievement: ' + rows[0]);
  assert(rows[3] === 'Krillionaire|Locked|0 / 1 for Bronze|0|true', 'locked achievement: ' + rows[3]);
  assert(rows[4] === 'Founder|Unlocked|Complete|0|false', 'one-tier achievement: ' + rows[4]);
  await page.screenshot({ path: out + '-achievements.png', fullPage: true });
  // Pick badges
  await page.click('#editCardButton'); await page.waitForTimeout(200);
  const choices = await page.$$eval('#showcaseChoices [data-badge]', b => b.map(x => x.dataset.badge));
  assert(choices.join() === 'winner,on_fire,sharpshooter,founder', 'only unlocked badges offered: ' + choices.join());
  for (const id of ['winner', 'on_fire', 'founder', 'sharpshooter']) await page.click(`#showcaseChoices [data-badge="${id}"]`);
  assert(await text('#showcaseCount') === '3/3' && (await text('#cardStatus')).includes('3 badges'), 'no more than 3 badges');
  await page.screenshot({ path: out + '-pick.png' });
  await page.click('#saveCardButton'); await page.waitForTimeout(500);
  const saved = serverState.cards.find(c => c.user_id === ME);
  assert(saved && saved.showcase.join() === 'winner,on_fire,founder', 'badges saved: ' + JSON.stringify(saved && saved.showcase));
  const tiles = await page.$$eval('#myShowcase .badge-tile', t => t.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(tiles.join(' | ') === '👑WinnerSilver | 🔥On FireBronze | 🏰FounderUnlocked', 'badges on card: ' + tiles.join(' | '));
  assert(!(await page.isVisible('#myShowcaseHint')), 'hint gone once badges picked');
  await page.click('#achievementsSection summary'); await page.waitForTimeout(150);
  await page.screenshot({ path: out + '-card.png' });
  // Someone else's card
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(400);
  await page.click('#openJoinServerButton'); await page.fill('#joinCodeInput', 'JOIN42'); await page.click('#joinServerButton'); await page.waitForTimeout(1200);
  await page.click('[data-social-panel="members"]'); await page.waitForTimeout(200);
  await page.locator('#serverMembers .player-link', { hasText: '@ethan' }).click(); await page.waitForTimeout(600);
  const theirs = await page.$$eval('#playerCardBody .badge-tile', t => t.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert(theirs.join(' | ') === '💎KrillionaireSilver | 🔥On FireSilver', 'their badges (locked picks hidden): ' + theirs.join(' | '));
  assert(await text('#playerCardBody .coins-pill') === '🪙 980', 'their coins');
  await page.screenshot({ path: out + '-player.png' });
  assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  await browser.close(); server.close();
});
