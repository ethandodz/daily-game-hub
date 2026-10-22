const { setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(2000);
    await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}-${scheme}-activity.png`, fullPage: true });
    await page.click('[data-tab-button="social"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}-${scheme}-social.png`, fullPage: true });
    if (scheme === 'light') {
      await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(800);
      const t = id => page.textContent('#' + id);
      assert(await t('statPlayedToday') === '2' && (await t('statPlayedTodaySub')) === 'of 6 games', `played today ${await t('statPlayedToday')} ${await t('statPlayedTodaySub')}`);
      assert(await t('statTopStreak') === '🔥 5' && await t('statTopStreakSub') === 'Wordle', `top streak ${await t('statTopStreak')} ${await t('statTopStreakSub')}`);
      assert(await t('statResults') === '15', `results ${await t('statResults')}`);
      const table = await page.$$eval('#activityGames tbody tr', rows => rows.map(r => [...r.children].map(c => c.textContent)));
      const W = table.find(r => r[0] === 'Wordle'), C = table.find(r => r[0] === 'Connections');
      assert(W && W[1] === '5' && C && C[1] === '2', 'table shows current streaks: ' + JSON.stringify(table));
      assert(table[0][0] === 'Connections' && Number(table[0][4]) >= Number(table[1][4]), 'most played game first: ' + table.map(r => r[0] + ' ' + r[4]).join(', '));
      assert(!(await page.$('#activityStreaks')) && !(await page.$('#activityRecent')), 'old Streaks and Recent Results lists are gone');
      await page.locator('#activityGames tbody tr', { hasText: 'Wordle' }).click(); await page.waitForTimeout(500);
      assert(await page.evaluate(() => document.getElementById('historyModal').classList.contains('open')) && (await page.textContent('#historyTitle')).includes('Wordle'), 'tapping a game opens its History');
      await page.click('[data-close="historyModal"]');
      await page.click('[data-tab-button="social"]'); await page.waitForTimeout(300);
      const groups = await page.$$eval('#friendScores .social-game', g => g.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      assert(groups.length === 2 && groups[0].includes('Wordle') && groups[0].includes('@ethan') && groups[1].includes('Connections') && groups[1].includes('🔥 4 days'), 'social groups: ' + groups.join(' | '));
      await page.click('[data-tab-button="games"]'); await page.waitForTimeout(300);
      assert(await page.locator('.game-card[data-id="wordle"] .friend-results.visible').count() === 1, 'friend results still under game cards');
      await page.click('[data-tab-button="account"]'); await page.click('#openSettingsButton'); await page.click('#signOutButton'); await page.waitForTimeout(300);
      await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(300);
      assert((await page.textContent('#activityStatus')).includes('Log in'), 'signed-out Activity asks to log in');
      assert(!(await page.isVisible('#friendResultsSection')), 'signed-out Social hides results card');
    }
    assert(errors.length === 0, `${scheme}: no console errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); server.close();
});
