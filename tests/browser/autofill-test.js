const m = require('../helpers/mock.js');
const assert = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const label = process.argv[4] || '';
m.server.listen(0, async () => {
  const url = `http://localhost:${m.server.address().port}/`;
  const browser = await m.chromium.launch();
  const { page, errors } = await m.setup(browser, { viewport: { width: 1366, height: 860 } });
  await page.goto(url); await page.waitForTimeout(2000);
  const shown = () => page.$$eval('.game-card', cs => cs.filter(c => c.getBoundingClientRect().height > 0).length);
  console.log(label, 'after load:', await shown(), 'games shown');
  // browser autofill: value set without the page being told
  await page.$eval('#searchInput', i => { i.value = 'laur@example.com'; });
  await page.click('[data-filter="favorites"]'); await page.waitForTimeout(300);
  const fav = await shown();
  await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
  const all = await shown();
  console.log(label, 'click Favorites:', fav, '| click All:', all, '| empty message:', JSON.stringify(await page.$eval('#emptyMessage', e => e.style.display === 'block' ? e.textContent.trim() : '')));
  if (label === 'FIXED') {
    assert(fav === 4 && all === 6, 'autofilled email ignored: favorites 4, all 6');
    assert(await page.inputValue('#searchInput') === '', 'search box cleared');
    await page.fill('#searchInput', 'conn'); await page.waitForTimeout(200);
    assert(await shown() === 1 && await page.isVisible('#clearSearchButton'), 'typing a search filters and shows ✕');
    await page.fill('#searchInput', 'zzz'); await page.waitForTimeout(200);
    assert((await page.textContent('#emptyMessage')).startsWith('No games match “zzz”'), 'empty message names the search');
    await page.screenshot({ path: process.argv[3] + '-search.png', clip: { x: 0, y: 0, width: 1366, height: 520 } });
    await page.click('#clearSearchButton'); await page.waitForTimeout(200);
    assert(await shown() === 6 && !(await page.isVisible('#clearSearchButton')), '✕ clears the search and shows all games');
    assert(errors.length === 0, 'no console errors ' + errors.join('|'));
  }
  await browser.close(); m.server.close();
});
