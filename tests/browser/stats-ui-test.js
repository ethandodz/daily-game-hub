const snap = async (page, file) => { const a = await page.locator('.stats-periods').boundingBox(); const b = await page.locator('#statsChartWrap').boundingBox(); const y0 = a.y - 50 + await page.evaluate(() => scrollY); await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: y0, width: 390, height: b.y + b.height - a.y + 70 } }); };
const { day, today, serverState, tables, requests, setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ME = '11111111-1111-1111-1111-111111111111', ETHAN = '22222222-2222-2222-2222-222222222222', MAYA = '33333333-3333-3333-3333-333333333333', SAM = '44444444-4444-4444-4444-444444444444';
const START = 200;
serverState.servers.push({ id: 'srv-stats', name: 'Stats Club', owner_id: ME, invite_code: 'STAT22', start_date: day(START), created_at: day(START) });
for (const u of [ME, ETHAN, MAYA, SAM]) serverState.members.push({ server_id: 'srv-stats', user_id: u, role: u === ME ? 'owner' : 'member', joined_at: day(START) });
['wordle', 'krillion', 'connections'].forEach((g, i) => serverState.games.push({ server_id: 'srv-stats', game_key: g, sort_order: i + 1, score_direction: null }));
// replace fixtures with a clean, known history
tables.daily_scores.length = 0;
let id = 1;
const add = (user_id, game_id, play_date, numeric_score, completed = true) => tables.daily_scores.push({ id: id++, user_id, game_id, play_date, numeric_score, completed, result_text: null, score_unit: { wordle: 'guesses', krillion: 'points', connections: 'mistakes' }[game_id] });
for (let n = START; n >= 0; n--) {
  const d = day(n);
  for (const u of [ME, ETHAN, MAYA]) {
    add(u, 'wordle', d, u === ME ? 2 : u === ETHAN ? 4 : (n % 3 === 0 ? 7 : 5), !(u === MAYA && n % 3 === 0));
    add(u, 'krillion', d, u === MAYA ? 500 : 200 + (n % 50));
    add(u, 'connections', d, (n + [ME, ETHAN, MAYA].indexOf(u)) % 4);
  }
  if (n % 2 === 0) add(SAM, 'wordle', d, 3);
}
const finished = START; // days start..yesterday
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const { page, errors, ctx } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(1500);
    const before = requests.length;
    await page.click('[data-tab-button="social"]'); await page.waitForTimeout(1500);
    if (await page.locator('#serverSwitcher .filter-button:not(.active):has-text("Stats Club")').count()) { await page.click('#serverSwitcher .filter-button:has-text("Stats Club")'); await page.waitForTimeout(1500); }
    await page.click('[data-social-panel="stats"]'); await page.waitForTimeout(400);
    const pages = requests.slice(before).filter(r => r.url.includes('daily_scores') && r.url.includes('offset='));
    const rowsTotal = tables.daily_scores.filter(r => r.play_date < today).length;
    const lb = () => page.$$eval('#statsLeaderboard .stats-row', rs => rs.map(r => ({ top: [...r.querySelector('.stats-row-top').children].map(c => c.textContent.trim()).join(' '), sub: r.querySelector('.stats-row-sub').textContent })));
    if (scheme === 'dark') {
      assert(pages.length === Math.ceil(rowsTotal / 1000) && pages.some(p => p.url.includes('offset=1000')), `loads ${rowsTotal} results in pages of 1000 (${pages.length} requests)`);
      // default: this month
      const monthStart = new Date(); monthStart.setDate(1);
      const expectDays = Math.min(new Date().getDate() - 1, finished);
      assert((await page.textContent('#statsRange')).endsWith(expectDays + ' finished days'), 'this month range: ' + await page.textContent('#statsRange'));
      let rows = await lb();
      assert(rows.length === 4 && rows[0].top.startsWith('👑') && rows.every(r => r.sub.includes('win rate')), 'leaderboard: 4 players, leader crowned: ' + rows.map(r => r.top).join(' | '));
      const avgs = await page.$$eval('#statsAverages .stats-row', rs => rs.map(r => ({ game: r.querySelector('.board-name').textContent, rule: r.querySelector('.activity-sub').textContent, vals: [...r.querySelectorAll('.stats-average-item')].map(i => i.textContent.trim()) })));
      const A = n => avgs.find(a => a.game === n);
      assert(await page.isVisible('#statsAveragesTitle') && avgs.length === 3, 'all games: average by game for 3 games');
      assert(A('Wordle').vals[0] === '👑 you 2' && A('Wordle').vals[1] === '@sam 3' && A('Wordle').vals[2] === '@ethan 4' && A('Wordle').rule === 'guesses · lower wins', 'wordle averages best first: ' + A('Wordle').vals.join(' | '));
      assert(A('Krillion').vals[0] === '👑 @maya 500' && A('Krillion').rule === 'points · higher wins', 'krillion averages, higher first: ' + A('Krillion').vals.join(' | '));
      assert(A('Wordle').vals.some(v => /@maya 5\.\d/.test(v)), 'maya wordle average includes fails as 7: ' + A('Wordle').vals.join(' | '));
      await snap(page, out + '-averages-clip.png');
      // single game: wordle
      await page.selectOption('#statsGame', 'wordle'); await page.waitForTimeout(300);
      rows = await lb();
      assert(!(await page.isVisible('#statsAveragesTitle')) && await page.locator('#statsAverages .stats-row').count() === 0, 'single game: per-game averages list hidden (average is in each row)');
      const me = rows.find(r => r.top.includes('(you)'));
      assert(me.top.startsWith('👑') && me.top.endsWith(expectDays + ' wins') && me.sub.startsWith('100% win rate') && me.sub.includes('avg 2 · best 2 · worst 2'), 'wordle: I win every day: ' + me.top + ' / ' + me.sub);
      const maya = rows.find(r => r.top.includes('@maya'));
      assert(maya.sub.includes('worst 7') && maya.sub.includes('0% win rate'), 'wordle: maya fails count as 7: ' + maya.sub);
      const sam = rows.find(r => r.top.includes('@sam'));
      assert(/played \d+ \((4\d|5\d)%\)/.test(sam.sub), 'sam plays every other day (~50%): ' + sam.sub);
      const h2h = await page.$$eval('#statsHeadToHead .stats-h2h', rs => rs.map(r => [...r.children].map(c => c.textContent).join(' ')));
      assert(h2h.length === 3 && h2h.every(x => x.includes('you lead')), 'head-to-head vs 3 members: ' + h2h.join(' | '));
      assert((await page.textContent('#statsChartTitle')) === 'Average guesses per day · lower is better', 'chart title: ' + await page.textContent('#statsChartTitle'));
      assert(await page.locator('#statsChart path.chart-line').count() === 4 && await page.locator('#statsLegend .legend-item').count() === 4, 'chart: 4 lines and legend');
      // tooltip
      await page.locator('#statsChart').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 150)); await page.waitForTimeout(150);
      const box = await page.locator('#statsChart svg').boundingBox();
      await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2); await page.waitForTimeout(150);
      const tip = await page.textContent('#statsChart .chart-tooltip');
      assert(!(await page.locator('#statsChart .chart-tooltip').evaluate(e => e.classList.contains('hidden'))) && tip.includes('@laur (you)') && tip.includes('2'), 'tooltip lists players at that day: ' + tip);
      await snap(page, out + '-wordle-clip.png');
      // krillion: higher wins
      await page.selectOption('#statsGame', 'krillion'); await page.waitForTimeout(300);
      rows = await lb();
      assert(rows[0].top.includes('@maya') && rows[0].sub.includes('best 500'), 'krillion: maya leads, best 500: ' + rows[0].top + ' / ' + rows[0].sub);
      // periods
      await page.selectOption('#statsGame', ''); 
      await page.click('[data-stats-period="week"]'); await page.waitForTimeout(300);
      const dow = (new Date().getDay() + 6) % 7;
      assert(dow === 0 ? (await page.textContent('#statsRange')).startsWith('No finished days') : (await page.textContent('#statsRange')).endsWith(dow + (dow === 1 ? ' finished day' : ' finished days')), 'this week range: ' + await page.textContent('#statsRange'));
      await page.click('[data-stats-period="all"]'); await page.waitForTimeout(300);
      assert((await page.textContent('#statsRange')).endsWith(finished + ' finished days'), 'all time = since server start: ' + await page.textContent('#statsRange'));
      assert((await page.textContent('#statsChartTitle')) === 'Wins over time', 'all games chart: wins over time');
      const xLabels = await page.$$eval('#statsChart text.chart-axis', t => t.map(x => x.textContent));
      assert(xLabels.includes('Apr 2026') && xLabels.includes('Oct 2026'), 'all time buckets by month: ' + xLabels.join(','));
      await page.click('[data-stats-period="year"]'); await page.waitForTimeout(300);
      await snap(page, out + '-all-clip.png');
    } else {
      await page.selectOption('#statsGame', 'wordle'); await page.waitForTimeout(300);
      await snap(page, out + '-light-clip.png');
    }
    assert(errors.length === 0, scheme + ': no console errors ' + errors.join('|'));
    await ctx.close();
  }
  // brand new server: no finished days
  serverState.servers.find(s => s.id === 'srv-stats').start_date = today;
  const { page, errors } = await setup(browser, { ...devices['iPhone 13'] });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.click('[data-tab-button="social"]'); await page.waitForTimeout(1200);
  if (await page.isVisible('#serverSwitcher')) { await page.click('#serverSwitcher .filter-button:has-text("Stats Club")'); await page.waitForTimeout(1000); }
  await page.click('[data-social-panel="stats"]'); await page.waitForTimeout(300);
  assert((await page.textContent('#statsRange')).startsWith('Stats start after the first full day') && !(await page.isVisible('#statsChartWrap')) && !(await page.isVisible('.stats-periods')) && !(await page.isVisible('#statsGame')), 'new server: explains stats start tomorrow, no controls');
  assert(errors.length === 0, 'new server: no console errors');
  await browser.close(); server.close();
});
