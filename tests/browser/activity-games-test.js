const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111';
// 8 games, more than 1000 results in total (paging), different play counts.
m.tables.daily_scores.length = 0;
const games = ['wordle', 'connections', 'krillion', 'worldle', 'framed', 'immaculate', 'strands', 'globle'];
let id = 1;
for (let n = 0; n < 200; n++) games.forEach((g, i) => { if (n % (i + 1) === 0 || i < 5) m.tables.daily_scores.push({ id: id++, user_id: ME, game_id: g, play_date: m.day(n), numeric_score: g === 'krillion' ? 300 + (n % 7) : (n % 4) + 1, score_unit: null, completed: true }); });
const total = m.tables.daily_scores.length;
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const { page, errors, ctx } = await m.setup(browser, { ...m.devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: scheme });
    await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2000);
    await page.evaluate(() => localStorage.removeItem('dailyGameHubActivityShowAll'));
    await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(1500);
    const rows = () => page.$$eval('#activityGames tbody tr', r => r.map(x => x.children[0].textContent));
    if (scheme === 'dark') {
      assert(total > 1000 && await page.textContent('#statResults') === String(total), `all ${total} results counted (more than one 1000-row page)`);
      const top = await rows();
      assert(top.length === 5, 'shows the top 5: ' + top.join(', '));
      assert((await page.textContent('#activityGamesToggle')).trim() === 'Show all 8 games ▾' && (await page.textContent('#activityGamesNote')) === 'top 5 by played', 'Show all button and note');
      await page.screenshot({ path: process.argv[3] + '-top5.png' });
      await page.click('#activityGamesToggle'); await page.waitForTimeout(200);
      assert((await rows()).length === 8 && (await page.textContent('#activityGamesToggle')).trim() === 'Show top 5 ▴', 'Show all lists every game');
      await page.click('[data-tab-button="games"]'); await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(1200);
      assert((await rows()).length === 8, 'Show all is remembered');
      await page.click('#activityGamesToggle'); await page.waitForTimeout(200);
      assert((await rows()).length === 5, 'Show top 5 collapses again');
      // iPhone 13 Home Screen app: 844px tall, ~47px status bar, ~96px tab bar.
      const bottom = await page.$eval('#activityGamesToggle', b => b.getBoundingClientRect().bottom + scrollY);
      assert(bottom + 47 <= 844 - 96, 'top 5 + Show all fit above the tab bar on an iPhone 13 (ends at ' + Math.round(bottom + 47) + 'px of 748)');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling');
    }
    assert(errors.length === 0, scheme + ': no console errors ' + errors.join('|'));
    await ctx.close();
  }
  await browser.close(); m.server.close();
});
