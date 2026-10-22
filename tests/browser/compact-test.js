const { setup, server, devices, chromium } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(2000);
    await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}-${scheme}-grid.png` });
    if (scheme === 'light') {
      const boxes = await page.$$eval('.game-card', c => c.filter(x => x.style.display !== 'none').slice(0, 4).map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
      assert(boxes[0][1] === boxes[1][1] && boxes[2][1] > boxes[0][1], '2 cards per row: ' + JSON.stringify(boxes));
      assert(boxes.every(b => b[3] - b[2] <= 8 && b[3] >= b[2]), 'cards are square or slightly taller: ' + JSON.stringify(boxes));
      assert(await page.isVisible('.game-card[data-id="connections"] .play-button') && await page.isVisible('.game-card[data-id="connections"] .result-button'), 'Play and Result visible on compact card');
      assert(!(await page.isVisible('.game-card[data-id="wordle"] .friend-results')), 'details hidden on compact card');
      // quick result from compact card
      await page.click('.game-card[data-id="connections"] .result-button'); await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.getElementById('scoreModal').classList.contains('open')), 'Result opens from compact card');
      await page.locator('[data-close="scoreModal"]').first().click();
      // expand
      await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(300);
      const r = await page.$eval('.game-card[data-id="wordle"]', x => { const b = x.getBoundingClientRect(); return [b.width, b.height, innerWidth, innerHeight]; });
      assert(r[0] === r[2] && r[1] === r[3], 'expanded card fills the screen');
      assert(await page.isVisible('.game-card[data-id="wordle"] .friend-results') && await page.isVisible('.game-card[data-id="wordle"] .history-button') && await page.isVisible('.game-card[data-id="wordle"] .description'), 'expanded shows description, history, friends');
      await page.screenshot({ path: `${out}-expanded.png` });
      await page.click('.game-card[data-id="wordle"] .history-button'); await page.waitForTimeout(400);
      const top = await page.evaluate(() => { const m = document.querySelector('#historyModal .modal-card').getBoundingClientRect(); const el = document.elementFromPoint(m.left + 20, m.top + 20); return !!el.closest('#historyModal'); });
      assert(top, 'History pop-up appears above expanded card');
      await page.click('[data-close="historyModal"]');
      await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(200);
      assert(!(await page.evaluate(() => document.body.classList.contains('card-open') || !!document.querySelector('.expanded'))), 'close button returns to grid');
      await page.click('.game-card[data-id="framed"] .expand-button'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
      assert(!(await page.evaluate(() => !!document.querySelector('.expanded'))), 'Escape closes expanded card');
      // played toggle still in compact
      await page.click('.game-card[data-id="framed"] .complete-button'); await page.waitForTimeout(300);
      assert(await page.evaluate(() => document.querySelector('.game-card[data-id="framed"]').classList.contains('completed')), '✓ marks played from compact card');
      await page.click('.game-card[data-id="framed"] .favorite-button'); await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}-light-grid2.png` });
    }
    assert(errors.length === 0, `${scheme}: no console errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  const { ctx, page, errors } = await setup(browser, { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-desktop.png` });
  await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-desktop-expanded.png` });
  assert(errors.length === 0, 'desktop: no console errors');
  await browser.close(); server.close();
});
