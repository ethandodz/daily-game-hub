const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111';
m.tables.daily_scores.length = 0;
let id = 1;
const add = (g, n, numeric, unit, completed = true) => m.tables.daily_scores.push({ id: id++, user_id: ME, game_id: g, play_date: m.day(n), numeric_score: numeric, score_unit: unit, completed, result_text: null });
add('wordle', 0, 3, 'guesses'); add('wordle', 1, 4, 'guesses'); add('wordle', 2, 7, 'guesses', false); add('wordle', 3, 2, 'guesses');
add('krillion', 0, 300, 'points'); add('krillion', 1, 420, 'points');
add('connections', 0, 1, 'mistakes'); add('framed', 0, null, null);
m.server.listen(0, async () => {
  const browser = await m.chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const { page, errors, ctx } = await m.setup(browser, { ...m.devices['iPhone 13'], colorScheme: scheme });
    await page.goto(`http://localhost:${m.server.address().port}/`); await page.waitForTimeout(2000);
    await page.click('[data-tab-button="activity"]'); await page.waitForTimeout(1200);
    if (scheme === 'dark') {
      const cells = await page.$$eval('#activityCalendar .calendar-cell', c => c.map(x => x.className));
      assert(cells.length === 112, '16 weeks of days (' + cells.length + ')');
      assert(cells.filter(c => c.includes('today')).length === 1 && cells.find(c => c.includes('today')).includes('level-2'), 'today outlined, 4 games = level 2');
      assert(cells.some(c => c.includes('future')) || new Date().getDay() === 0, 'rest of this week left blank');
      await page.waitForTimeout(800);
      await page.$eval('#activityCalendar .calendar-cell.today', c => c.click());
      assert((await page.textContent('#activityCalendarNote')).endsWith(': 4 games'), 'tap a day shows its count: ' + await page.textContent('#activityCalendarNote'));
      const rows = await page.$$eval('#activityGames tbody tr', r => r.map(x => [...x.children].map(c => c.textContent)));
      const row = n => rows.find(r => r[0] === n) || [];
      assert(row('Wordle').join('|') === 'Wordle|4|4|2|4', 'wordle: streak 4, avg 4 (fail counts as 7), best 2, played 4: ' + row('Wordle').join('|'));
      assert(row('Krillion').join('|') === 'Krillion|2|360|420|2', 'krillion: higher wins, best 420: ' + row('Krillion').join('|'));
      assert(row('Framed').join('|') === 'Framed|1|–|–|1', 'a result without a number: played counts, no average: ' + row('Framed').join('|'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling');
      assert(await page.evaluate(() => [...document.querySelectorAll('#activityGames, #activityCalendar')].every(e => e.getBoundingClientRect().right <= document.getElementById('activitySection').getBoundingClientRect().right + 0.5)), 'everything fits inside the Activity card');

    }
    const a = await page.locator('#activityCalendar').boundingBox();
    await page.screenshot({ path: process.argv[3] + '-' + scheme + '.png', fullPage: true, clip: { x: 0, y: a.y - 60 + await page.evaluate(() => scrollY), width: 390, height: 520 } });
    assert(errors.length === 0, scheme + ': no console errors ' + errors.join('|'));
    await ctx.close();
  }
  await browser.close(); m.server.close();
});
