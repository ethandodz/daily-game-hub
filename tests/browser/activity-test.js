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
      const streaks = await page.$$eval('#activityStreaks .activity-row', rows => rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
      assert(streaks.length === 2 && streaks[0].includes('Wordle') && streaks[1].includes('Connections') && streaks[1].includes('Best: 7 days') && streaks[1].includes('2 days'), 'streak list: ' + streaks.join(' | '));
      assert(!(await page.textContent('#activityRecent')).includes('16'), 'recent list limited to 14 days');
      const days = await page.$$eval('#activityRecent .activity-day', d => d.map(x => x.textContent));
      assert(days[0] === 'Today' && days[1] === 'Yesterday', 'recent grouped by day: ' + days.slice(0, 4).join(', '));
      await page.locator('#activityRecent .activity-result').first().click(); await page.waitForTimeout(500);
      assert(await page.evaluate(() => document.getElementById('historyModal').classList.contains('open')) && (await page.textContent('#historyTitle')).includes('Wordle'), 'tapping a result opens its History');
      await page.click('[data-close="historyModal"]');
      await page.click('[data-tab-button="social"]'); await page.waitForTimeout(300);
      const groups = await page.$$eval('#friendScores .social-game', g => g.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      assert(groups.length === 2 && groups[0].includes('Wordle') && groups[0].includes('@ethan') && groups[1].includes('Connections') && groups[1].includes('🔥 4 days'), 'social groups: ' + groups.join(' | '));
      await page.click('[data-tab-button="games"]'); await page.waitForTimeout(300);
      assert(await page.locator('.game-card[data-id="wordle"] .friend-results.visible').count() === 1, 'friend results still under game cards');
      await page.click('[data-tab-button="account"]'); await page.click('#signOutButton'); await page.waitForTimeout(300);
      await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(300);
      assert((await page.textContent('#activityStatus')).includes('Log in'), 'signed-out Activity asks to log in');
      assert(!(await page.isVisible('#friendResultsSection')), 'signed-out Social hides results card');
    }
    assert(errors.length === 0, `${scheme}: no console errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); server.close();
});
