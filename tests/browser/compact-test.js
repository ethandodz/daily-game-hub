// Games tab: a Home Screen of app icons; tap one to pop its card open.
const { setup, server, devices, chromium, openCard } = require('../helpers/mock.js');
const out = process.argv[3];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const GREEN = 'rgb(16, 185, 129)';
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await setup(browser, { ...devices['iPhone 13'], colorScheme: scheme });
    await page.goto(url); await page.waitForTimeout(2000);
    await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}-${scheme}-grid.png` });
    if (scheme === 'light') {
      const boxes = await page.$$eval('.game-card', c => c.filter(x => x.style.display !== 'none').slice(0, 5).map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
      assert(boxes.slice(0, 4).every(b => b[1] === boxes[0][1]) && boxes[4][1] > boxes[0][1], '4 icons per row: ' + JSON.stringify(boxes));
      const offCenter = await page.$$eval('.game-card', c => c.filter(x => x.style.display !== 'none').map(x => { const r = x.getBoundingClientRect(), i = x.querySelector('.game-icon').getBoundingClientRect(), n = x.querySelector('h3').getBoundingClientRect(); return Math.max(Math.abs((i.left + i.right) / 2 - (r.left + r.right) / 2), Math.abs((n.left + n.right) / 2 - (r.left + r.right) / 2)); }));
      assert(offCenter.every(d => d <= 1.5), 'icons and names centered in their column: ' + JSON.stringify(offCenter.map(Math.round)));
      assert(!(await page.isVisible('.game-card[data-id="connections"] .play-button')) && await page.isVisible('.game-card[data-id="connections"] h3'), 'grid shows only icon and name');
      const ring = id => page.$eval(`.game-card[data-id="${id}"] .game-icon`, i => getComputedStyle(i).boxShadow);
      assert((await ring('wordle')).includes(GREEN), 'green ring on a game played today');
      assert(!(await ring('connections')).includes(GREEN) && !(await ring('connections')).includes('148, 163, 184'), 'no ring on a game not played: ' + await ring('connections'));
      // tap an icon: its card pops forward
      const before = await page.$eval('.game-card[data-id="framed"]', x => x.getBoundingClientRect().top);
      await openCard(page, 'connections');
      const pop = await page.$eval('.game-card[data-id="connections"]', x => { const r = x.getBoundingClientRect(); return { popped: x.classList.contains('popped'), centered: Math.abs(r.left - (innerWidth - r.width) / 2) <= 1, blurred: document.body.classList.contains('card-popped'), ghost: !!document.querySelector('.game-card-ghost') }; });
      assert(pop.popped && pop.centered && pop.blurred && pop.ghost, 'tapping an icon pops its card to the middle ' + JSON.stringify(pop));
      assert(await page.$eval('.game-card[data-id="framed"]', x => x.getBoundingClientRect().top) === before, 'other icons stay where they are');
      assert(await page.isVisible('.game-card[data-id="connections"] .play-button') && await page.isVisible('.game-card[data-id="connections"] .result-button'), 'Play and Result on the popped card');
      await page.screenshot({ path: `${out}-popped.png` });
      await page.click('.game-card[data-id="connections"] .result-button'); await page.waitForTimeout(200);
      assert(await page.evaluate(() => document.getElementById('scoreModal').classList.contains('open')), 'Result opens from the popped card');
      await page.locator('[data-close="scoreModal"]').first().click(); await page.waitForTimeout(150);
      assert(await page.evaluate(() => document.querySelector('.game-card[data-id="connections"]').classList.contains('popped')), 'card stays open after closing the result window');
      // saving results from an open card (twice) must not shift the grid
      const order = () => page.$$eval('#gameGrid > *', c => c.filter(x => x.offsetParent || x.classList.contains('popped')).map(x => x.dataset.id || x.className));
      await page.evaluate(() => closePoppedCard(true));
      const startOrder = await order();
      for (const text of ['Wordle 1,585 3/6', 'Wordle 1,585 2/6']) {
        await openCard(page, 'wordle'); await page.click('.game-card[data-id="wordle"] .result-button'); await page.waitForTimeout(200);
        await page.fill('#resultText', text); await page.click('#saveScoreButton'); await page.waitForTimeout(700);
        await page.evaluate(() => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
        await page.mouse.click(20, 780); await page.waitForFunction(() => !document.querySelector('.popped')); await page.waitForTimeout(100);
      }
      const endOrder = await order();
      assert(await page.$$eval('.game-card-ghost', g => g.length) === 0 && JSON.stringify(endOrder) === JSON.stringify(startOrder), 'editing results leaves no gaps in the grid ' + JSON.stringify([startOrder, endOrder, await page.$$eval('.game-card-ghost', g => g.length)]));
      // the grid re-sorting while a card is open (as saving can do) leaves no gap behind
      await openCard(page, 'wordle');
      await page.evaluate(() => { const g = document.getElementById('gameGrid'); g.appendChild(document.querySelector('.game-card[data-id="wordle"]')); });
      await page.mouse.click(20, 780); await page.waitForFunction(() => !document.querySelector('.popped')); await page.waitForTimeout(100);
      assert(await page.$$eval('.game-card-ghost', g => g.length) === 0, 'no leftover gap after the grid re-sorts');
      await page.evaluate(() => { const g = document.getElementById('gameGrid'); g.prepend(document.querySelector('.game-card[data-id="wordle"]')); });
      // a background sync doesn't close an open card
      await openCard(page, 'connections');
      await page.evaluate(() => syncUserGameLibrary()); await page.waitForTimeout(500);
      assert(await page.evaluate(() => document.querySelector('.game-card[data-id="connections"]').classList.contains('popped')), 'open card stays open through a background sync');
      // tap outside: back to the grid
      await page.mouse.click(20, 780); await page.waitForFunction(() => !document.querySelector('.popped'));
      assert(await page.evaluate(() => !document.querySelector('.popped') && !document.body.classList.contains('card-popped') && !document.querySelector('.game-card-ghost')), 'tapping outside closes it');
      // expand from the popped card
      await openCard(page, 'wordle');
      await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(300);
      const r = await page.$eval('.game-card[data-id="wordle"]', x => { const b = x.getBoundingClientRect(); return [b.width, b.height, innerWidth, innerHeight, x.classList.contains('popped')]; });
      assert(r[0] === r[2] && r[1] === r[3] && !r[4], 'expand fills the screen');
      assert(await page.isVisible('.game-card[data-id="wordle"] .friend-results') && await page.isVisible('.game-card[data-id="wordle"] .history-button') && await page.isVisible('.game-card[data-id="wordle"] .description'), 'expanded shows description, history, friends');
      await page.screenshot({ path: `${out}-expanded.png` });
      await page.click('.game-card[data-id="wordle"] .history-button'); await page.waitForTimeout(400);
      const top = await page.evaluate(() => { const m = document.querySelector('#historyModal .modal-card').getBoundingClientRect(); const el = document.elementFromPoint(m.left + 20, m.top + 20); return !!el.closest('#historyModal'); });
      assert(top, 'History pop-up appears above expanded card');
      await page.click('[data-close="historyModal"]');
      await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(200);
      assert(!(await page.evaluate(() => document.body.classList.contains('card-open') || document.body.classList.contains('card-popped') || !!document.querySelector('.expanded, .popped'))), 'closing returns to the grid');
      // Escape closes a popped card
      await page.click('.game-card[data-id="framed"]'); await page.waitForTimeout(350); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      assert(!(await page.evaluate(() => !!document.querySelector('.popped'))), 'Escape closes the popped card');
      // played toggle and favorite from the popped card
      await openCard(page, 'framed');
      await page.click('.game-card[data-id="framed"] .complete-button'); await page.waitForTimeout(300);
      assert(await page.evaluate(() => document.querySelector('.game-card[data-id="framed"]').classList.contains('completed')), '✓ marks played from the popped card');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      assert((await ring('framed')).includes(GREEN), 'ring appears once played');
      // switching tabs closes it
      await openCard(page, 'connections'); await page.click('[data-tab-button="activity"]'); await page.click('[data-tab-button="games"]'); await page.waitForTimeout(200);
      assert(!(await page.evaluate(() => !!document.querySelector('.popped') || document.body.classList.contains('card-popped'))), 'switching tabs closes it');
      await page.screenshot({ path: `${out}-light-grid2.png` });
    }
    assert(errors.length === 0, `${scheme}: no console errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  const { ctx, page, errors } = await setup(browser, { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  await page.goto(url); await page.waitForTimeout(2000);
  await page.click('[data-filter="all"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-desktop.png` });
  await openCard(page, 'wordle');
  await page.screenshot({ path: `${out}-desktop-popped.png` });
  await page.click('.game-card[data-id="wordle"] .expand-button'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-desktop-expanded.png` });
  assert(errors.length === 0, 'desktop: no console errors');
  await browser.close(); server.close();
});
