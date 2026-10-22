const { setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(2000);
    const visibleView = () => page.evaluate(() => [...document.querySelectorAll('[data-tab-view]')].filter(v => !v.classList.contains('hidden')).map(v => v.dataset.tabView).join(','));
    for (const tab of ['games', 'social', 'activity', 'account']) {
      await page.click(`[data-tab-button="${tab}"]`); await page.waitForTimeout(300);
      if (scheme === 'light') assert(await visibleView() === tab, `${tab} tab shows only its view`);
      await page.screenshot({ path: `${out}-${scheme}-${tab}.png` });
    }
    if (scheme === 'light') {
      assert(await page.inputValue('#usernameInput') === 'laur', 'username loads into Account tab');
      assert(await page.evaluate(() => getComputedStyle(document.getElementById('randomButton')).display) === 'none', 'Random hidden off Games tab');
      // per-tab scroll memory
      await page.click('[data-tab-button="games"]'); const target = await page.evaluate(() => { window.scrollTo(0, 900); return scrollY; }); await page.waitForTimeout(300);
      await page.click('[data-tab-button="social"]'); await page.waitForTimeout(200);
      assert(await page.evaluate(() => scrollY) < 50, 'Social opens at its own scroll position');
      await page.click('[data-tab-button="games"]'); await page.waitForTimeout(200);
      const y = await page.evaluate(() => scrollY);
      assert(target > 100 && Math.abs(y - target) < 5, `Games scroll restored (${y} of ${target})`);
      // features still work inside tabs
      await page.click('#arrangeGamesButton'); await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.getElementById('arrangeModal').classList.contains('open')), 'Arrange Games opens');
      await page.click('[data-close="arrangeModal"]');
      await page.locator('[data-result]').first().click(); await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.getElementById('scoreModal').classList.contains('open')), 'Enter/Edit Result opens');
      await page.locator('[data-close="scoreModal"]').first().click();
      // library sync while on another tab must not move that tab's scroll
      await page.click('[data-tab-button="account"]'); await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(200);
      const before = await page.evaluate(() => scrollY);
      await page.evaluate(() => syncUserGameLibrary()); await page.waitForTimeout(800);
      assert(await page.evaluate(() => scrollY) === before, 'background sync leaves other tabs alone');
      // tab persists across reload
      await page.reload(); await page.waitForTimeout(1500);
      assert(await visibleView() === 'account', 'reload reopens last tab');
      // sign out
      await page.click('#openSettingsButton'); await page.click('#signOutButton'); await page.waitForTimeout(500);
      assert(await visibleView() === 'games', 'sign out returns to Games');
      assert(await page.isVisible('#signedOutHome') && !(await page.isVisible('.games-tools')), 'signed-out welcome shown, tools hidden');
      await page.screenshot({ path: `${out}-signedout.png` });
      await page.click('[data-tab-button="account"]'); await page.waitForTimeout(200);
      assert(await page.isVisible('#accountLoginButton') && !(await page.isVisible('#signedInView')), 'Account tab shows Log In when signed out');
      await page.click('#accountLoginButton'); await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.getElementById('accountModal').classList.contains('open')), 'Log In opens sign-in window');
      await page.screenshot({ path: `${out}-login.png` });
    }
    assert(errors.length === 0, `${scheme}: no console errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  const { ctx, page, errors } = await setup(browser, { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('[data-tab-button="games"]'); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}-desktop.png` });
  assert(errors.length === 0, 'desktop: no console errors ' + errors.join(' | '));
  await browser.close(); server.close();
});
